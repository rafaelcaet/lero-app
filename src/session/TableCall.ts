import type { MediaState, SignalData } from "@/shared/protocol";
import { Emitter } from "./Emitter";
import { loadMediaPrefs, MAX_INPUT_VOLUME, saveMediaPrefs } from "./mediaPrefs";
import { createNoiseGate, LEVEL_SCALE } from "./noiseGate";

export type PeerStatus = "connecting" | "connected" | "reconnecting" | "failed";

export type DeviceKind = "audioinput" | "videoinput" | "audiooutput";

export interface MediaDevice {
  id: string;
  label: string;
}

export interface CallState {
  /** Há pelo menos uma outra pessoa na mesa. */
  active: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  peerStatus: Record<string, PeerStatus>;
  /** Preferência: microfone ligado (vale também antes de ter mídia). */
  mic: boolean;
  /** Preferência: câmera ligada. */
  cam: boolean;
  hasMic: boolean;
  hasCam: boolean;
  /** Ganho do microfone (0–2). */
  inputVolume: number;
  /** Volume de quem está na mesa (0–1). */
  outputVolume: number;
  /** Nível mínimo para o microfone transmitir (0 = sempre). Veja mediaPrefs. */
  micSensitivity: number;
  /** Dispositivos disponíveis, por tipo (sem os "padrão" do sistema). */
  devices: Record<DeviceKind, MediaDevice[]>;
  /** O navegador só revela os nomes dos dispositivos depois de permitir câmera/microfone. */
  devicesLabeled: boolean;
  /** Dispositivos escolhidos ("" = padrão do sistema). */
  micDeviceId: string;
  camDeviceId: string;
  speakerDeviceId: string;
  /** O navegador permite escolher a saída de áudio (setSinkId; o Safari não permite). */
  canPickSpeaker: boolean;
  error: string | null;
}

export const INITIAL_CALL_STATE: CallState = {
  active: false,
  localStream: null,
  remoteStreams: {},
  peerStatus: {},
  mic: true,
  cam: true,
  hasMic: false,
  hasCam: false,
  inputVolume: 1,
  outputVolume: 1,
  micSensitivity: 0,
  devices: { audioinput: [], videoinput: [], audiooutput: [] },
  devicesLabeled: false,
  micDeviceId: "",
  camDeviceId: "",
  speakerDeviceId: "",
  canPickSpeaker: false,
  error: null,
};

const DEVICE_FALLBACK_NAME: Record<DeviceKind, string> = {
  audioinput: "Microfone",
  videoinput: "Câmera",
  audiooutput: "Saída de áudio",
};

/**
 * Cadeia de áudio do microfone: fonte → ganho → (medidor) → noise gate → destino.
 * A trilha enviada às outras pessoas sai do destino, então trocar de microfone
 * só troca a fonte, sem renegociar as conexões.
 */
interface MicChain {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  analyser: AnalyserNode;
  /** Noise gate (sensibilidade). null até carregar ou se o navegador não suportar. */
  gate: AudioWorkletNode | null;
  destination: MediaStreamAudioDestinationNode;
  samples: Uint8Array<ArrayBuffer>;
  /** Trilhas originais do getUserMedia (paradas ao liberar). */
  rawTracks: MediaStreamTrack[];
}

type CallEvents = {
  change: CallState;
  media: MediaState;
};

interface Peer {
  pc: RTCPeerConnection;
  /** Serializa operações de sinalização deste par. */
  chain: Promise<void>;
  pendingCandidates: RTCIceCandidateInit[];
  tracksAdded: boolean;
  isOfferer: boolean;
  restartTimer: ReturnType<typeof setTimeout> | null;
  restarts: number;
}

/** Usado se o servidor não enviar nenhum servidor ICE. */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/** Mantém câmera/microfone ligados por um tempo depois de levantar (sentar de novo é instantâneo). */
const MEDIA_RELEASE_DELAY_MS = 30_000;
/** "disconnected" costuma se recuperar sozinho; só reinicia o ICE se persistir. */
const DISCONNECT_GRACE_MS = 3_000;
const MAX_ICE_RESTARTS = 3;

/** Limite de banda do vídeo por pessoa: deixa folga para o áudio não picotar. */
const VIDEO_MAX_BITRATE = 350_000;
const AUDIO_MAX_BITRATE = 48_000;

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};
const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 480 },
  height: { ideal: 270 },
  frameRate: { ideal: 24, max: 30 },
};

/**
 * Chamada em malha (mesh) entre as pessoas sentadas na mesma mesa.
 *
 * - A mídia é capturada assim que você senta (mesmo sozinho), então quando alguém
 *   chega a conexão começa na hora; e fica ligada por um tempo depois de levantar.
 * - Quem tem o menor id faz a oferta, o que evita colisão de ofertas.
 * - Se a conexão cair, o ofertante reinicia o ICE automaticamente.
 * - Ligar/desligar microfone e câmera só altera `track.enabled` (sem renegociar).
 */
export class TableCall extends Emitter<CallEvents> {
  private state: CallState = INITIAL_CALL_STATE;
  private readonly peers = new Map<string, Peer>();
  private mediaPromise: Promise<MediaStream | null> | null = null;
  /** Invalida capturas de mídia em andamento quando a mídia é liberada. */
  private mediaToken = 0;
  private releaseTimer: ReturnType<typeof setTimeout> | null = null;
  private micChain: MicChain | null = null;

  constructor(
    private readonly getSelfId: () => string | null,
    private readonly getIceServers: () => RTCIceServer[],
    private readonly sendSignal: (to: string, data: SignalData) => void,
  ) {
    super();
    if (typeof window === "undefined") return;
    this.state = {
      ...this.state,
      ...loadMediaPrefs(),
      canPickSpeaker: typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype,
    };
    navigator.mediaDevices?.addEventListener?.("devicechange", this.onDeviceChange);
    void this.refreshDevices();
  }

  getState() {
    return this.state;
  }

  /**
   * Sincroniza com a mesa atual.
   * @param seated se você está sentado numa mesa (prepara a mídia)
   * @param peerIds outras pessoas na mesma mesa
   */
  sync(seated: boolean, peerIds: string[]) {
    if (seated) this.prepareMedia();
    else this.scheduleMediaRelease();

    const wanted = new Set(seated ? peerIds : []);
    for (const id of [...this.peers.keys()]) if (!wanted.has(id)) this.closePeer(id);
    for (const id of wanted) if (!this.peers.has(id)) this.createPeer(id);

    if (this.state.active !== wanted.size > 0) this.update({ active: wanted.size > 0 });
  }

  handleSignal(from: string, data: SignalData) {
    // Ignora sinais atrasados de quem já saiu; só uma oferta cria um par novo.
    const isOffer = data.kind === "description" && data.description.type === "offer";
    const peer = this.peers.get(from) ?? (isOffer ? this.createPeer(from) : null);
    if (!peer) return;
    this.enqueue(peer, async () => {
      if (data.kind === "candidate") {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate);
        else peer.pendingCandidates.push(data.candidate);
        return;
      }

      const { description } = data;
      if (description.type === "offer") {
        const stream = await this.mediaPromise;
        await peer.pc.setRemoteDescription(description);
        this.addLocalTracks(peer, stream);
        await peer.pc.setLocalDescription(await peer.pc.createAnswer());
        this.sendSignal(from, { kind: "description", description: peer.pc.localDescription!.toJSON() });
      } else {
        await peer.pc.setRemoteDescription(description);
      }
      // Negociação concluída: agora o navegador aceita ajustar bitrate/prioridade.
      await this.tuneSenders(peer);

      for (const candidate of peer.pendingCandidates.splice(0)) {
        await peer.pc.addIceCandidate(candidate);
      }
    });
  }

  toggleMic() {
    this.setTrackEnabled("audio", !this.state.mic);
  }

  toggleCam() {
    this.setTrackEnabled("video", !this.state.cam);
  }

  setInputVolume(volume: number) {
    const inputVolume = Math.min(MAX_INPUT_VOLUME, Math.max(0, volume));
    if (this.micChain) this.micChain.gain.gain.setTargetAtTime(inputVolume, this.micChain.context.currentTime, 0.02);
    this.update({ inputVolume });
    this.savePrefs();
  }

  setOutputVolume(volume: number) {
    this.update({ outputVolume: Math.min(1, Math.max(0, volume)) });
    this.savePrefs();
  }

  /** Sensibilidade do microfone: abaixo deste nível (0–1) não transmite. 0 desliga. */
  setMicSensitivity(value: number) {
    const micSensitivity = Math.min(1, Math.max(0, value));
    const gate = this.micChain?.gate;
    if (gate) gate.parameters.get("threshold")!.setValueAtTime(micSensitivity, this.micChain!.context.currentTime);
    this.update({ micSensitivity });
    this.savePrefs();
  }

  /** Escolhe microfone, câmera ou saída de áudio ("" = padrão do sistema). Vale na hora, mesmo em chamada. */
  setDevice(kind: DeviceKind, id: string) {
    const key = kind === "audioinput" ? "micDeviceId" : kind === "videoinput" ? "camDeviceId" : "speakerDeviceId";
    if (this.state[key] === id) return;
    this.update({ [key]: id, error: null });
    this.savePrefs();
    if (kind === "audioinput") void this.switchDevice("audio");
    else if (kind === "videoinput") void this.switchDevice("video");
    // A saída é aplicada por cada vídeo (VideoTile) a partir de `speakerDeviceId`.
  }

  /**
   * Pede permissão de câmera/microfone só para o navegador revelar os nomes dos
   * dispositivos (antes de sentar numa mesa). As trilhas são paradas na hora.
   */
  async requestDeviceAccess() {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.update({ error: "Câmera e microfone exigem HTTPS ou localhost." });
      return;
    }
    let stream: MediaStream | null = null;
    for (const constraints of [{ audio: true, video: true }, { audio: true }, { video: true }]) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch {
        // tenta a próxima combinação
      }
    }
    stream?.getTracks().forEach((t) => t.stop());
    if (!stream) this.update({ error: "Sem acesso à câmera/microfone. Libere nas permissões do navegador." });
    await this.refreshDevices();
  }

  /** Nível atual do microfone (0–1), já com o ganho aplicado e antes do noise gate. 0 sem microfone. */
  getInputLevel(): number {
    const mic = this.micChain;
    if (!mic || !this.state.mic) return 0;
    mic.analyser.getByteTimeDomainData(mic.samples);
    let sum = 0;
    for (const v of mic.samples) sum += ((v - 128) / 128) ** 2;
    return Math.min(1, Math.sqrt(sum / mic.samples.length) * LEVEL_SCALE);
  }

  dispose() {
    navigator.mediaDevices?.removeEventListener?.("devicechange", this.onDeviceChange);
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.releaseMedia();
    this.clear();
  }

  // --- dispositivos ------------------------------------------------------

  private readonly onDeviceChange = () => void this.refreshDevices();

  /** Atualiza a lista. Se o dispositivo escolhido sumiu (ex.: fone desconectado), volta ao padrão. */
  private async refreshDevices() {
    let infos: MediaDeviceInfo[];
    try {
      infos = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
    } catch {
      return;
    }
    const devices: CallState["devices"] = { audioinput: [], videoinput: [], audiooutput: [] };
    for (const info of infos) {
      const kind = info.kind as DeviceKind;
      // Sem permissão o id vem vazio; "default"/"communications" (Chrome) repetem um dispositivo real.
      if (!devices[kind] || !info.deviceId || info.deviceId === "default" || info.deviceId === "communications") continue;
      const list = devices[kind];
      list.push({ id: info.deviceId, label: info.label || `${DEVICE_FALLBACK_NAME[kind]} ${list.length + 1}` });
    }
    const devicesLabeled = infos.some((i) => i.label);
    this.update({ devices, devicesLabeled });
    if (!devicesLabeled) return;

    const gone = (id: string, kind: DeviceKind) => id !== "" && !devices[kind].some((d) => d.id === id);
    if (gone(this.state.micDeviceId, "audioinput")) this.setDevice("audioinput", "");
    if (gone(this.state.camDeviceId, "videoinput")) this.setDevice("videoinput", "");
    if (this.state.canPickSpeaker && gone(this.state.speakerDeviceId, "audiooutput")) this.setDevice("audiooutput", "");
  }

  /** Restrições do getUserMedia com o dispositivo escolhido. */
  private constraintsFor(kind: "audio" | "video", exact: boolean): MediaTrackConstraints {
    const base = kind === "audio" ? AUDIO_CONSTRAINTS : VIDEO_CONSTRAINTS;
    const id = kind === "audio" ? this.state.micDeviceId : this.state.camDeviceId;
    // Ao entrar usa `ideal` (se o dispositivo sumiu, cai no padrão); ao trocar, `exact`.
    return id ? { ...base, deviceId: exact ? { exact: id } : { ideal: id } } : base;
  }

  /** Troca o microfone ou a câmera da chamada em andamento. Sem mídia ativa, vale na próxima vez. */
  private async switchDevice(kind: "audio" | "video") {
    const stream = await this.mediaPromise;
    if (!stream || stream !== this.state.localStream) return;
    const token = this.mediaToken;
    const old = kind === "audio" ? stream.getAudioTracks() : stream.getVideoTracks();
    // Sem trilha desse tipo (ex.: entrou sem câmera) não há como trocar sem renegociar.
    if (old.length === 0) return;

    let track: MediaStreamTrack | undefined;
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ [kind]: this.constraintsFor(kind, true) });
      track = kind === "audio" ? fresh.getAudioTracks()[0] : fresh.getVideoTracks()[0];
    } catch {
      this.update({ error: kind === "audio" ? "Não foi possível usar esse microfone." : "Não foi possível usar essa câmera." });
      return;
    }
    if (!track) return;
    // Liberou a mídia ou trocou de novo enquanto o navegador abria o dispositivo.
    if (this.mediaToken !== token || this.state.localStream !== stream) {
      track.stop();
      return;
    }

    const chain = this.micChain;
    if (kind === "audio" && chain) {
      // Só troca a fonte: a trilha enviada (saída do destino) continua a mesma.
      track.contentHint = "speech";
      chain.source.disconnect();
      chain.source = chain.context.createMediaStreamSource(new MediaStream([track]));
      chain.source.connect(chain.gain);
      chain.rawTracks.filter((t) => t.kind === "audio").forEach((t) => t.stop());
      chain.rawTracks = [...chain.rawTracks.filter((t) => t.kind !== "audio"), track];
      void this.refreshDevices();
      return;
    }

    track.contentHint = kind === "audio" ? "speech" : "motion";
    track.enabled = kind === "audio" ? this.state.mic : this.state.cam;
    for (const peer of this.peers.values()) {
      const sender = peer.pc.getSenders().find((s) => s.track && old.includes(s.track));
      await sender?.replaceTrack(track).catch((err) => console.warn("[TableCall] replaceTrack", err));
    }
    old.forEach((t) => t.stop());
    if (chain) chain.rawTracks = [...chain.rawTracks.filter((t) => !old.includes(t)), track];
    const next = new MediaStream([...stream.getTracks().filter((t) => !old.includes(t)), track]);
    // Quem entrar na mesa depois recebe o stream novo.
    this.mediaPromise = Promise.resolve(next);
    this.update({ localStream: next });
    void this.refreshDevices();
  }

  // --- mídia local -----------------------------------------------------

  private prepareMedia() {
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    if (!this.mediaPromise) this.mediaPromise = this.acquireMedia();
  }

  private scheduleMediaRelease() {
    if (!this.mediaPromise || this.releaseTimer) return;
    this.releaseTimer = setTimeout(() => this.releaseMedia(), MEDIA_RELEASE_DELAY_MS);
  }

  private async acquireMedia(): Promise<MediaStream | null> {
    const token = this.mediaToken;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.update({ error: "Câmera e microfone exigem HTTPS ou localhost." });
      return null;
    }

    const audio = this.constraintsFor("audio", false);
    const video = this.constraintsFor("video", false);
    const attempts: MediaStreamConstraints[] = [{ audio, video }, { audio }, { video }];
    let stream: MediaStream | null = null;
    for (const constraints of attempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch {
        // tenta a próxima combinação
      }
    }

    // A mídia pode ter sido liberada enquanto o navegador pedia permissão.
    if (this.mediaToken !== token) {
      stream?.getTracks().forEach((t) => t.stop());
      return null;
    }

    if (stream) stream = this.withMicChain(stream);

    // Dicas para o codificador: voz e movimento (prioriza fluidez).
    stream?.getAudioTracks().forEach((t) => (t.contentHint = "speech"));
    stream?.getVideoTracks().forEach((t) => (t.contentHint = "motion"));

    // Aplica as preferências (ex.: entrar com a câmera desligada).
    stream?.getAudioTracks().forEach((t) => (t.enabled = this.state.mic));
    stream?.getVideoTracks().forEach((t) => (t.enabled = this.state.cam));

    const hasMic = !!stream?.getAudioTracks().length;
    const hasCam = !!stream?.getVideoTracks().length;
    this.update({
      localStream: stream,
      hasMic,
      hasCam,
      error: stream ? null : "Sem acesso à câmera/microfone. Você ainda pode ouvir, ver e usar o chat.",
    });
    this.emitMedia();
    // Com a permissão dada, o navegador revela os nomes dos dispositivos.
    void this.refreshDevices();
    return stream;
  }

  /**
   * Passa o microfone por um GainNode (volume de entrada) e um AnalyserNode
   * (medidor). Devolve um stream com a trilha de áudio processada + o vídeo.
   * Sem Web Audio, devolve o stream original.
   */
  private withMicChain(stream: MediaStream): MediaStream {
    const [rawAudio] = stream.getAudioTracks();
    if (!rawAudio || typeof AudioContext === "undefined") return stream;
    try {
      const context = new AudioContext();
      const source = context.createMediaStreamSource(new MediaStream([rawAudio]));
      const gain = context.createGain();
      gain.gain.value = this.state.inputVolume;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      const destination = context.createMediaStreamDestination();
      source.connect(gain);
      gain.connect(analyser);
      gain.connect(destination);
      void context.resume().catch(() => {});

      const chain: MicChain = {
        context,
        source,
        gain,
        analyser,
        gate: null,
        destination,
        samples: new Uint8Array(analyser.fftSize),
        rawTracks: stream.getTracks(),
      };
      this.micChain = chain;
      // O noise gate carrega em paralelo; até lá (ou sem suporte) o áudio passa direto.
      createNoiseGate(context, this.state.micSensitivity).then(
        (gate) => {
          if (this.micChain !== chain) return;
          gain.disconnect(destination);
          gain.connect(gate);
          gate.connect(destination);
          chain.gate = gate;
        },
        (err) => console.warn("[TableCall] sem noise gate (sensibilidade):", err),
      );
      return new MediaStream([...destination.stream.getAudioTracks(), ...stream.getVideoTracks()]);
    } catch {
      return stream;
    }
  }

  private releaseMedia() {
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    const hadMedia = this.mediaPromise !== null;
    this.state.localStream?.getTracks().forEach((t) => t.stop());
    this.micChain?.rawTracks.forEach((t) => t.stop());
    void this.micChain?.context.close().catch(() => {});
    this.micChain = null;
    this.mediaPromise = null;
    this.mediaToken++;
    if (hadMedia) {
      this.update({ localStream: null, hasMic: false, hasCam: false, error: null });
      this.emitMedia();
    }
  }

  /** Muda a preferência e, se houver mídia, liga/desliga a trilha (sem renegociar). */
  private setTrackEnabled(kind: "audio" | "video", enabled: boolean) {
    const stream = this.state.localStream;
    const tracks = kind === "audio" ? stream?.getAudioTracks() : stream?.getVideoTracks();
    tracks?.forEach((t) => (t.enabled = enabled));
    this.update(kind === "audio" ? { mic: enabled } : { cam: enabled });
    this.savePrefs();
    this.emitMedia();
  }

  /** O que os outros veem: ligado só se a preferência está ativa e o dispositivo existe. */
  private emitMedia() {
    const { mic, cam, hasMic, hasCam } = this.state;
    this.emit("media", { mic: mic && hasMic, cam: cam && hasCam });
  }

  private savePrefs() {
    const { mic, cam, inputVolume, outputVolume, micSensitivity, micDeviceId, camDeviceId, speakerDeviceId } = this.state;
    saveMediaPrefs({ mic, cam, inputVolume, outputVolume, micSensitivity, micDeviceId, camDeviceId, speakerDeviceId });
  }

  // --- conexões ----------------------------------------------------------

  private update(patch: Partial<CallState>) {
    this.state = { ...this.state, ...patch };
    this.emit("change", this.state);
  }

  private setPeerStatus(id: string, status: PeerStatus | null) {
    const peerStatus = { ...this.state.peerStatus };
    if (status) peerStatus[id] = status;
    else delete peerStatus[id];
    this.update({ peerStatus });
  }

  private enqueue(peer: Peer, task: () => Promise<void>) {
    peer.chain = peer.chain.then(task).catch((err) => console.warn("[TableCall]", err));
  }

  private createPeer(id: string): Peer {
    const servers = this.getIceServers();
    const pc = new RTCPeerConnection({
      iceServers: servers.length > 0 ? servers : FALLBACK_ICE_SERVERS,
      // Começa a coletar candidatos antes da oferta: conexão mais rápida.
      iceCandidatePoolSize: 2,
    });
    const selfId = this.getSelfId();
    const peer: Peer = {
      pc,
      chain: Promise.resolve(),
      pendingCandidates: [],
      tracksAdded: false,
      isOfferer: !!selfId && selfId < id,
      restartTimer: null,
      restarts: 0,
    };
    this.peers.set(id, peer);
    this.setPeerStatus(id, "connecting");

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) this.sendSignal(id, { kind: "candidate", candidate: candidate.toJSON() });
    };
    pc.ontrack = (event) => {
      if (this.peers.get(id) !== peer) return;
      const current = this.state.remoteStreams[id];
      const stream = event.streams[0] ?? current ?? new MediaStream();
      if (!stream.getTracks().includes(event.track)) stream.addTrack(event.track);
      this.update({ remoteStreams: { ...this.state.remoteStreams, [id]: stream } });
    };
    pc.onconnectionstatechange = () => this.handleConnectionState(id, peer);

    if (peer.isOfferer) {
      this.enqueue(peer, async () => {
        const stream = await this.mediaPromise;
        if (this.peers.get(id) !== peer) return;
        this.addLocalTracks(peer, stream);
        await pc.setLocalDescription(await pc.createOffer());
        this.sendSignal(id, { kind: "description", description: pc.localDescription!.toJSON() });
      });
    }
    return peer;
  }

  private handleConnectionState(id: string, peer: Peer) {
    if (this.peers.get(id) !== peer) return;
    const { connectionState } = peer.pc;

    if (connectionState === "connected") {
      if (peer.restartTimer) clearTimeout(peer.restartTimer);
      peer.restartTimer = null;
      peer.restarts = 0;
      this.setPeerStatus(id, "connected");
    } else if (connectionState === "disconnected") {
      this.setPeerStatus(id, "reconnecting");
      if (!peer.restartTimer) {
        peer.restartTimer = setTimeout(() => {
          peer.restartTimer = null;
          if (peer.pc.connectionState !== "connected") this.restartIce(id, peer);
        }, DISCONNECT_GRACE_MS);
      }
    } else if (connectionState === "failed") {
      this.restartIce(id, peer);
    }
  }

  /** Renegocia os caminhos de rede (ICE restart). Só o ofertante inicia. */
  private restartIce(id: string, peer: Peer) {
    if (peer.restarts >= MAX_ICE_RESTARTS) {
      this.setPeerStatus(id, "failed");
      return;
    }
    peer.restarts++;
    this.setPeerStatus(id, "reconnecting");
    if (!peer.isOfferer) return; // o outro lado envia a nova oferta
    this.enqueue(peer, async () => {
      if (this.peers.get(id) !== peer) return;
      peer.pc.restartIce();
      await peer.pc.setLocalDescription(await peer.pc.createOffer({ iceRestart: true }));
      this.sendSignal(id, { kind: "description", description: peer.pc.localDescription!.toJSON() });
    });
  }

  /**
   * Adiciona as trilhas locais (uma vez por conexão). O ofertante cria transceivers
   * "recvonly" para os tipos que não tem (ex.: sem câmera), para ainda receber do outro lado.
   */
  private addLocalTracks(peer: Peer, stream: MediaStream | null) {
    if (peer.tracksAdded) return;
    peer.tracksAdded = true;
    const kinds = new Set<string>();
    for (const track of stream?.getTracks() ?? []) {
      peer.pc.addTrack(track, stream!);
      kinds.add(track.kind);
    }
    if (peer.isOfferer) {
      for (const kind of ["audio", "video"]) {
        if (!kinds.has(kind)) peer.pc.addTransceiver(kind, { direction: "recvonly" });
      }
    }
  }

  /** Prioriza o áudio e limita o vídeo, para a voz não picotar em redes mais fracas. */
  private async tuneSenders(peer: Peer) {
    for (const sender of peer.pc.getSenders()) {
      if (sender.track) await this.tuneSender(sender, sender.track.kind);
    }
  }

  private async tuneSender(sender: RTCRtpSender, kind: string) {
    try {
      const params = sender.getParameters();
      if (!params.encodings?.length) return;
      for (const encoding of params.encodings) {
        if (kind === "audio") {
          encoding.maxBitrate = AUDIO_MAX_BITRATE;
          encoding.priority = "high";
          encoding.networkPriority = "high";
        } else {
          encoding.maxBitrate = VIDEO_MAX_BITRATE;
          encoding.priority = "low";
          encoding.networkPriority = "low";
        }
      }
      await sender.setParameters(params);
    } catch {
      // Navegador não suporta algum parâmetro: segue com o padrão.
    }
  }

  private closePeer(id: string) {
    const peer = this.peers.get(id);
    if (!peer) return;
    if (peer.restartTimer) clearTimeout(peer.restartTimer);
    peer.pc.onicecandidate = peer.pc.ontrack = peer.pc.onconnectionstatechange = null;
    peer.pc.close();
    this.peers.delete(id);
    const remoteStreams = { ...this.state.remoteStreams };
    delete remoteStreams[id];
    const peerStatus = { ...this.state.peerStatus };
    delete peerStatus[id];
    this.update({ remoteStreams, peerStatus });
  }
}
