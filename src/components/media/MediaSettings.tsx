"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/session/Session";
import type { CallState, DeviceKind, MediaDevice } from "@/session/TableCall";
import { MAX_INPUT_VOLUME } from "@/session/mediaPrefs";
import { AudioLinesIcon, CamIcon, ChevronIcon, MicIcon, VolumeIcon } from "@/components/icons";

interface MediaSettingsProps {
  session: Session;
  call: CallState;
}

/** Liga/desliga câmera e microfone, ajusta volumes e sensibilidade e escolhe os dispositivos. */
export function MediaSettings({ session, call }: MediaSettingsProps) {
  const [open, setOpen] = useState(true);

  return (
    <section aria-label="Áudio e vídeo" className="border-t border-neutral-800">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-800/50"
      >
        <span className="font-display text-base font-semibold">Áudio e vídeo</span>
        <ChevronIcon direction={open ? "down" : "up"} size={16} className="text-neutral-500" />
      </button>

      {open && (
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <MediaToggle
              label="Microfone"
              on={call.mic}
              onClick={() => session.toggleMic()}
              icon={<MicIcon off={!call.mic} size={18} />}
            />
            <MediaToggle
              label="Câmera"
              on={call.cam}
              onClick={() => session.toggleCam()}
              icon={<CamIcon off={!call.cam} size={18} />}
            />
          </div>

          <VolumeSlider
            id="input-volume"
            label="Volume de entrada"
            icon={<MicIcon size={14} />}
            value={call.inputVolume}
            max={MAX_INPUT_VOLUME}
            onChange={(v) => session.setInputVolume(v)}
            disabled={!call.mic}
          />

          <VolumeSlider
            id="mic-sensitivity"
            label="Sensibilidade"
            icon={<AudioLinesIcon size={14} />}
            value={call.micSensitivity}
            max={1}
            step={0.01}
            valueText={call.micSensitivity === 0 ? "Sempre transmite" : undefined}
            onChange={(v) => session.setMicSensitivity(v)}
            disabled={!call.mic}
          >
            <InputLevel
              session={session}
              active={!!call.localStream && call.hasMic && call.mic}
              threshold={call.micSensitivity}
            />
            <p className="mt-1.5 text-[11px] leading-snug text-neutral-500">
              {call.micSensitivity === 0
                ? "Arraste para cortar ruídos de fundo: abaixo da marca, o microfone não transmite."
                : "Abaixo da marca, o microfone não transmite. Fale normalmente e ajuste até a barra passar da marca só com a sua voz."}
            </p>
          </VolumeSlider>

          <VolumeSlider
            id="output-volume"
            label="Volume de saída"
            icon={<VolumeIcon size={14} />}
            value={call.outputVolume}
            max={1}
            onChange={(v) => session.setOutputVolume(v)}
          />

          <DevicePicker session={session} call={call} />
        </div>
      )}
    </section>
  );
}

function MediaToggle(props: { label: string; on: boolean; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={props.on}
      onMouseDown={(e) => e.preventDefault()}
      onClick={props.onClick}
      className={`flex items-center justify-center gap-2 rounded-md px-2 py-2 text-xs font-medium transition-colors ${
        props.on ? "bg-neutral-800 text-neutral-100 hover:bg-neutral-700" : "bg-red-600/20 text-red-300 hover:bg-red-600/30"
      }`}
    >
      {props.icon}
      {props.on ? props.label : `${props.label} off`}
    </button>
  );
}

function VolumeSlider(props: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: number;
  max: number;
  step?: number;
  /** Texto no lugar da porcentagem (ex.: "Sempre transmite" no zero). */
  valueText?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
  children?: React.ReactNode;
}) {
  const percent = Math.round(props.value * 100);
  return (
    <div className={props.disabled ? "opacity-50" : ""}>
      <label htmlFor={props.id} className="mb-1.5 flex items-center justify-between text-xs text-neutral-400">
        <span className="flex items-center gap-1.5">
          {props.icon}
          {props.label}
        </span>
        <span className="tabular-nums text-neutral-300">{props.valueText ?? `${percent}%`}</span>
      </label>
      <input
        id={props.id}
        type="range"
        min={0}
        max={props.max}
        step={props.step ?? 0.05}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(Number(e.target.value))}
        // Solta o foco ao terminar de arrastar: as setas voltam a mover o personagem.
        onPointerUp={(e) => e.currentTarget.blur()}
        className="w-full accent-emerald-500"
      />
      {props.children}
    </div>
  );
}

/**
 * Barra com o nível do microfone em tempo real e a marca da sensibilidade.
 * Verde quando passa da marca (transmitindo); cinza abaixo dela.
 */
function InputLevel({ session, active, threshold }: { session: Session; active: boolean; threshold: number }) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    if (!active) {
      bar.style.width = "0%";
      return;
    }
    let frame = 0;
    const tick = () => {
      const level = session.getInputLevel();
      bar.style.width = `${Math.round(level * 100)}%`;
      bar.dataset.open = String(threshold === 0 || level >= threshold);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [session, active, threshold]);

  return (
    <div className="relative mt-2 h-1.5 rounded-full bg-neutral-800" aria-hidden title="Nível do microfone">
      <div
        ref={barRef}
        data-open="true"
        className="h-full w-0 rounded-full bg-neutral-500 transition-[width] duration-75 data-[open=true]:bg-emerald-500"
      />
      {threshold > 0 && (
        <div
          className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-amber-300"
          style={{ left: `${threshold * 100}%` }}
        />
      )}
    </div>
  );
}

const DEVICE_FIELDS: ReadonlyArray<{ kind: DeviceKind; label: string; icon: React.ReactNode; key: keyof CallState }> = [
  { kind: "audioinput", label: "Microfone", icon: <MicIcon size={14} />, key: "micDeviceId" },
  { kind: "videoinput", label: "Câmera", icon: <CamIcon size={14} />, key: "camDeviceId" },
  { kind: "audiooutput", label: "Saída de áudio", icon: <VolumeIcon size={14} />, key: "speakerDeviceId" },
];

/** Escolha de microfone, câmera e saída de áudio. */
function DevicePicker({ session, call }: MediaSettingsProps) {
  // O Safari não deixa escolher a saída: o áudio sai no padrão do sistema.
  const fields = DEVICE_FIELDS.filter((f) => f.kind !== "audiooutput" || call.canPickSpeaker);

  return (
    <div className="space-y-3 border-t border-neutral-800 pt-4">
      <h3 className="font-display text-sm font-semibold text-neutral-200">Dispositivos</h3>
      {!call.devicesLabeled ? (
        <div className="space-y-2">
          <p className="text-[11px] leading-snug text-neutral-500">
            O navegador só mostra a lista depois que você permite o acesso à câmera e ao microfone.
          </p>
          <button
            type="button"
            onClick={() => session.requestDeviceAccess()}
            className="w-full rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-display text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
          >
            Permitir acesso
          </button>
        </div>
      ) : (
        fields.map((f) => (
          <DeviceSelect
            key={f.kind}
            id={`device-${f.kind}`}
            label={f.label}
            icon={f.icon}
            devices={call.devices[f.kind]}
            value={call[f.key] as string}
            onChange={(id) => session.setMediaDevice(f.kind, id)}
          />
        ))
      )}
    </div>
  );
}

function DeviceSelect(props: {
  id: string;
  label: string;
  icon: React.ReactNode;
  devices: MediaDevice[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <label htmlFor={props.id} className="mb-1.5 flex items-center gap-1.5 text-xs text-neutral-400">
        {props.icon}
        {props.label}
      </label>
      <select
        id={props.id}
        value={props.value}
        onChange={(e) => {
          props.onChange(e.target.value);
          // Devolve o teclado ao jogo (as setas não ficam trocando de opção).
          e.currentTarget.blur();
        }}
        className="w-full truncate rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-100 outline-none focus:border-emerald-500"
      >
        <option value="">Padrão do sistema</option>
        {props.devices.map((d) => (
          <option key={d.id} value={d.id}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
  );
}
