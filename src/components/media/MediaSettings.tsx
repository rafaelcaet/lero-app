"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@/session/Session";
import type { CallState } from "@/session/TableCall";
import { MAX_INPUT_VOLUME } from "@/session/mediaPrefs";
import { CamIcon, ChevronIcon, MicIcon, VolumeIcon } from "@/components/icons";

interface MediaSettingsProps {
  session: Session;
  call: CallState;
}

/** Liga/desliga câmera e microfone e ajusta os volumes de entrada e saída. */
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
        <div className="space-y-4 px-4 pb-4">
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
          >
            <InputLevel session={session} active={!!call.localStream && call.hasMic && call.mic} />
          </VolumeSlider>

          <VolumeSlider
            id="output-volume"
            label="Volume de saída"
            icon={<VolumeIcon size={14} />}
            value={call.outputVolume}
            max={1}
            onChange={(v) => session.setOutputVolume(v)}
          />
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
        <span className="tabular-nums text-neutral-300">{percent}%</span>
      </label>
      <input
        id={props.id}
        type="range"
        min={0}
        max={props.max}
        step={0.05}
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

/** Barra com o nível do microfone em tempo real. */
function InputLevel({ session, active }: { session: Session; active: boolean }) {
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
      bar.style.width = `${Math.round(session.getInputLevel() * 100)}%`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [session, active]);

  return (
    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-800" aria-hidden title="Nível do microfone">
      <div ref={barRef} className="h-full w-0 rounded-full bg-emerald-500 transition-[width] duration-75" />
    </div>
  );
}
