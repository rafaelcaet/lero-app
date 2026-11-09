/**
 * Noise gate do microfone (sensibilidade): silencia o áudio enquanto o nível fica
 * abaixo do limite. Roda num AudioWorklet, na thread de áudio, então continua
 * funcionando com a aba em segundo plano (timers da página ficam lentos nesse caso).
 */

export const NOISE_GATE_NAME = "lero-noise-gate";

/**
 * Nível na mesma escala do medidor das configurações (RMS × 4, limitado a 1),
 * para a marca de sensibilidade bater com a barra.
 */
export const LEVEL_SCALE = 4;

// Código do processador. Fica numa string porque roda isolado no AudioWorkletGlobalScope.
const PROCESSOR_SOURCE = `
const LEVEL_SCALE = ${LEVEL_SCALE};
// Depois de cair abaixo do limite, espera um pouco antes de fechar (não corta o fim das palavras).
const HOLD_SECONDS = 0.3;
const ATTACK_SECONDS = 0.005;
const RELEASE_SECONDS = 0.08;

class NoiseGate extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: "threshold", defaultValue: 0, minValue: 0, maxValue: 1, automationRate: "k-rate" }];
  }

  constructor() {
    super();
    this.gain = 1;
    this.hold = 0;
    this.attack = 1 - Math.exp(-1 / (ATTACK_SECONDS * sampleRate));
    this.release = 1 - Math.exp(-1 / (RELEASE_SECONDS * sampleRate));
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    const first = input[0];
    if (!first) return true;

    let sum = 0;
    for (let i = 0; i < first.length; i++) sum += first[i] * first[i];
    const level = Math.min(1, Math.sqrt(sum / first.length) * LEVEL_SCALE);
    const threshold = parameters.threshold[0];

    if (threshold <= 0 || level >= threshold) this.hold = HOLD_SECONDS * sampleRate;
    else this.hold = Math.max(0, this.hold - first.length);
    const target = this.hold > 0 ? 1 : 0;
    const coef = target > this.gain ? this.attack : this.release;

    for (let i = 0; i < first.length; i++) {
      this.gain += (target - this.gain) * coef;
      for (let c = 0; c < output.length; c++) output[c][i] = (input[c] ?? first)[i] * this.gain;
    }
    return true;
  }
}

registerProcessor("${NOISE_GATE_NAME}", NoiseGate);
`;

const loaded = new WeakMap<BaseAudioContext, Promise<void>>();

/** Cria o nó do noise gate. Rejeita se o navegador não suportar AudioWorklet. */
export async function createNoiseGate(context: AudioContext, threshold: number): Promise<AudioWorkletNode> {
  if (!context.audioWorklet) throw new Error("AudioWorklet indisponível");
  let ready = loaded.get(context);
  if (!ready) {
    const url = URL.createObjectURL(new Blob([PROCESSOR_SOURCE], { type: "text/javascript" }));
    ready = context.audioWorklet.addModule(url).finally(() => URL.revokeObjectURL(url));
    loaded.set(context, ready);
  }
  await ready;
  const node = new AudioWorkletNode(context, NOISE_GATE_NAME, {
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [1],
  });
  node.parameters.get("threshold")!.value = threshold;
  return node;
}
