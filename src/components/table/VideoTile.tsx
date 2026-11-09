"use client";

import { useEffect, useRef, useState } from "react";
import type { PeerStatus } from "@/session/TableCall";

interface VideoTileProps {
  name: string;
  stream: MediaStream | null;
  mic: boolean;
  cam: boolean;
  /** Estado da conexão com esta pessoa (ausente para você mesmo). */
  status?: PeerStatus;
  /** O próprio usuário: sem áudio local (evita eco) e espelhado. */
  self?: boolean;
  /** Volume de reprodução (0–1). */
  volume?: number;
  /** Saída de áudio (id do dispositivo; "" = padrão do sistema). */
  sinkId?: string;
}

const STATUS_TEXT: Record<Exclude<PeerStatus, "connected">, string> = {
  connecting: "Conectando…",
  reconnecting: "Reconectando…",
  failed: "Sem conexão de mídia (a rede pode exigir TURN)",
};

export function VideoTile({ name, stream, mic, cam, status, self = false, volume = 1, sinkId }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Define `muted` como propriedade: o atributo do React não é confiável aqui,
    // e ouvir o próprio microfone com atraso soa como eco.
    video.muted = self;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (!stream) return;
    video.play().then(
      () => setAutoplayBlocked(false),
      // O navegador bloqueia áudio automático sem interação do usuário.
      () => setAutoplayBlocked(!self),
    );
  }, [stream, self]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = Math.min(1, Math.max(0, volume));
  }, [volume, stream]);

  useEffect(() => {
    const video = videoRef.current;
    // setSinkId não existe no Safari: lá o áudio sai sempre no padrão do sistema.
    if (self || sinkId === undefined || !video || !("setSinkId" in video)) return;
    if (video.sinkId === sinkId) return;
    video.setSinkId(sinkId).catch((err) => console.warn("[VideoTile] setSinkId", err));
  }, [sinkId, self]);

  const showVideo = cam && !!stream;
  const statusText = status && status !== "connected" ? STATUS_TEXT[status] : null;

  return (
    <div className="relative aspect-video overflow-hidden rounded-md bg-neutral-800">
      {/* O vídeo continua montado mesmo com a câmera desligada para tocar o áudio. */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={self}
        className={`h-full w-full object-cover ${self ? "-scale-x-100" : ""} ${showVideo ? "" : "invisible"}`}
      />
      {!showVideo && (
        <div className="absolute inset-0 grid place-items-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-neutral-700 text-2xl font-semibold text-neutral-200">
            {name.slice(0, 1).toUpperCase()}
          </span>
        </div>
      )}
      {statusText && (
        <div className="absolute inset-x-0 top-0 bg-black/60 px-1.5 py-0.5 text-center text-[10px] text-amber-200">
          {statusText}
        </div>
      )}
      {autoplayBlocked && (
        <button
          type="button"
          onClick={() => {
            void videoRef.current?.play().then(() => setAutoplayBlocked(false));
          }}
          className="absolute inset-0 grid place-items-center bg-black/60 text-xs font-medium text-white"
        >
          🔈 Clique para ativar o áudio
        </button>
      )}
      <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white">
        {!mic && <span aria-label="microfone desligado">🔇</span>}
        {self ? `${name} (você)` : name}
      </span>
    </div>
  );
}
