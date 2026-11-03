import type { MediaState, SignalData } from "@/shared/protocol";
import { Emitter } from "./Emitter";

export type PeerStatus = "connecting" | "connected" | "reconnecting" | "failed";

export interface CallState {
  /** Há pelo menos uma outra pessoa na mesa. */
  active: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  peerStatus: Record<string, PeerStatus>;
  mic: boolean;
  cam: boolean;
  hasMic: boolean;
  hasCam: boolean;
  error: string | null;
}

export const INITIAL_CALL_STATE: CallState = {
  active: false,
  localStream: null,
  remoteStreams: {},
  peerStatus: {},
  mic: false,
  cam: false,
  hasMic: false,
  hasCam: false,
  error: null,
};

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

  constructor(
    private readonly getSelfId: () => string | null,
    private readonly getIceServers: () => RTCIceServer[],
    private readonly sendSignal: (to: string, data: SignalData) => void,
  ) {
    super();
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

  dispose() {
    for (const id of [...this.peers.keys()]) this.closePeer(id);
    this.releaseMedia();
    this.clear();
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

    const attempts: MediaStreamConstraints[] = [
      { audio: AUDIO_CONSTRAINTS, video: VIDEO_CONSTRAINTS },
      { audio: AUDIO_CONSTRAINTS },
      { video: VIDEO_CONSTRAINTS },
    ];
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

    // Dicas para o codificador: voz e movimento (prioriza fluidez).
    stream?.getAudioTracks().forEach((t) => (t.contentHint = "speech"));
    stream?.getVideoTracks().forEach((t) => (t.contentHint = "motion"));

    const hasMic = !!stream?.getAudioTracks().length;
    const hasCam = !!stream?.getVideoTracks().length;
    this.update({
      localStream: stream,
      hasMic,
      hasCam,
      mic: hasMic,
      cam: hasCam,
      error: stream ? null : "Sem acesso à câmera/microfone. Você ainda pode ouvir, ver e usar o chat.",
    });
    this.emit("media", { mic: hasMic, cam: hasCam });
    return stream;
  }

  private releaseMedia() {
    if (this.releaseTimer) clearTimeout(this.releaseTimer);
    this.releaseTimer = null;
    const hadMedia = this.mediaPromise !== null;
    this.state.localStream?.getTracks().forEach((t) => t.stop());
    this.mediaPromise = null;
    this.mediaToken++;
    if (hadMedia) {
      this.update({ localStream: null, mic: false, cam: false, hasMic: false, hasCam: false, error: null });
      this.emit("media", { mic: false, cam: false });
    }
  }

  private setTrackEnabled(kind: "audio" | "video", enabled: boolean) {
    const stream = this.state.localStream;
    const tracks = kind === "audio" ? stream?.getAudioTracks() : stream?.getVideoTracks();
    if (!tracks?.length) return;
    tracks.forEach((t) => (t.enabled = enabled));
    this.update(kind === "audio" ? { mic: enabled } : { cam: enabled });
    this.emit("media", { mic: this.state.mic, cam: this.state.cam });
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
