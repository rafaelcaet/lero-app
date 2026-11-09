/** Preferências de áudio e vídeo, lembradas no navegador. */
export interface MediaPrefs {
  /** Microfone ligado ao entrar numa chamada. */
  mic: boolean;
  /** Câmera ligada ao entrar numa chamada. */
  cam: boolean;
  /** Ganho do microfone: 0 (mudo) a 2 (200%). */
  inputVolume: number;
  /** Volume das outras pessoas: 0 a 1. */
  outputVolume: number;
  /**
   * Sensibilidade do microfone: nível mínimo (0–1, na escala do medidor) para
   * transmitir. Abaixo disso o microfone fica em silêncio. 0 = sempre transmite.
   */
  micSensitivity: number;
  /** Dispositivos escolhidos ("" = padrão do sistema). */
  micDeviceId: string;
  camDeviceId: string;
  speakerDeviceId: string;
}

export const MAX_INPUT_VOLUME = 2;

const STORAGE_KEY = "lero:media-prefs";
const DEFAULT_PREFS: MediaPrefs = {
  mic: true,
  cam: true,
  inputVolume: 1,
  outputVolume: 1,
  micSensitivity: 0,
  micDeviceId: "",
  camDeviceId: "",
  speakerDeviceId: "",
};

const clamp = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

const deviceId = (v: unknown) => (typeof v === "string" && v.length <= 256 ? v : "");

export function loadMediaPrefs(): MediaPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      mic: typeof raw.mic === "boolean" ? raw.mic : DEFAULT_PREFS.mic,
      cam: typeof raw.cam === "boolean" ? raw.cam : DEFAULT_PREFS.cam,
      inputVolume: clamp(raw.inputVolume, 0, MAX_INPUT_VOLUME, DEFAULT_PREFS.inputVolume),
      outputVolume: clamp(raw.outputVolume, 0, 1, DEFAULT_PREFS.outputVolume),
      micSensitivity: clamp(raw.micSensitivity, 0, 1, DEFAULT_PREFS.micSensitivity),
      micDeviceId: deviceId(raw.micDeviceId),
      camDeviceId: deviceId(raw.camDeviceId),
      speakerDeviceId: deviceId(raw.speakerDeviceId),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveMediaPrefs(prefs: MediaPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // armazenamento indisponível: vale só nesta sessão
  }
}
