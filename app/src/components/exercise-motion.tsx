"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Dumbbell, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExerciseMotionDemo({
  openGymId,
  name,
  customMedia,
  showingOwn = false,
  onToggleOwn,
  size = "sm",
  interactive = false,
  className,
}: {
  openGymId?: string;
  pattern?: string;
  equipment?: string;
  primaryMuscle?: string;
  secondaryMuscles?: string[];
  muscleWeights?: Record<string, number>;
  name?: string;
  customMedia?: { kind: "image" | "video"; dataUrl: string } | null;
  showingOwn?: boolean;
  onToggleOwn?: () => void;
  size?: "sm" | "lg";
  interactive?: boolean;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(true);
  const [clipFailed, setClipFailed] = useState(false);
  const [stillFailed, setStillFailed] = useState(false);

  useEffect(() => {
    setPlaying(true);
    setClipFailed(false);
    setStillFailed(false);
  }, [openGymId]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (playing) {
      el.muted = true;
      el.defaultMuted = true;
      el.setAttribute("muted", "");
      const p = el.play?.();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } else {
      el.pause?.();
    }
  }, [playing, openGymId]);

  const clipSrc = openGymId ? `/library-media/clip/${openGymId}.mp4` : null;
  const stillSrc = openGymId ? `/library-media/still/${openGymId}.webp` : null;

  // User-uploaded custom photo/video override
  if (customMedia && showingOwn) {
    return (
      <div
        className={cn(
          "relative overflow-hidden border border-black/15 bg-black",
          size === "lg" ? "h-[280px] w-full rounded-2xl sm:h-[320px]" : "size-12 shrink-0 rounded-xl",
          className,
        )}
      >
        {customMedia.kind === "video" ? (
          <video
            src={customMedia.dataUrl}
            autoPlay={size === "lg"}
            loop
            muted
            playsInline
            controls={size === "lg"}
            className="h-full w-full object-contain"
          />
        ) : (
          <img
            src={customMedia.dataUrl}
            alt={name ?? "Exercise demonstration"}
            className="h-full w-full object-contain"
          />
        )}
        {onToggleOwn && size === "lg" && (
          <button
            type="button"
            onClick={onToggleOwn}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-black"
          >
            <Play className="size-3" /> Animation
          </button>
        )}
      </div>
    );
  }

  // List/grid thumbnail: OpenGym <Thumb /> using crisp WebP still
  if (size === "sm") {
    if (!stillSrc || stillFailed) {
      return (
        <div
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-xl bg-panel-2 text-mist",
            className,
          )}
        >
          <Dumbbell className="size-5" />
        </div>
      );
    }
    return (
      <div
        className={cn(
          "size-12 shrink-0 overflow-hidden rounded-xl bg-white",
          className,
        )}
      >
        <img
          src={stillSrc}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setStillFailed(true)}
          className="h-full w-full select-none object-contain"
        />
      </div>
    );
  }

  // Full detail stage: OpenGym white-card animated MP4 video with tap to pause / tap to play
  const showVideo = Boolean(clipSrc && !clipFailed && playing);
  const showStill = Boolean(stillSrc && !stillFailed && (!clipSrc || clipFailed || !playing));

  const handleTogglePlay = () => {
    if (!interactive) return;
    if (clipFailed && stillFailed) {
      setClipFailed(false);
      setStillFailed(false);
      setPlaying(true);
      return;
    }
    setPlaying((p) => !p);
  };

  return (
    <div
      onClick={handleTogglePlay}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleTogglePlay();
              }
            }
          : undefined
      }
      aria-label={
        interactive
          ? `${name ?? "Exercise"} animation (${playing ? "tap to pause" : "tap to play"})`
          : undefined
      }
      className={cn(
        "relative h-[280px] w-full select-none overflow-hidden rounded-2xl bg-white sm:h-[320px]",
        interactive && "cursor-pointer",
        !showVideo && !showStill && "border border-white/10 bg-panel-2",
        className,
      )}
    >
      {showVideo && clipSrc ? (
        <video
          ref={videoRef}
          src={clipSrc}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          aria-label={name ?? "Exercise animation"}
          onError={() => setClipFailed(true)}
          className="h-full w-full bg-white object-contain"
        />
      ) : showStill && stillSrc ? (
        <img
          src={stillSrc}
          alt={name ?? "Exercise demonstration"}
          decoding="async"
          draggable={false}
          onError={() => setStillFailed(true)}
          className="h-full w-full bg-white object-contain"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-mist">
          <Dumbbell className="size-9 opacity-60" />
          <span className="text-xs">No built-in animation — add your photo or video below</span>
        </div>
      )}

      {customMedia && onToggleOwn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleOwn();
          }}
          className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-black/85"
        >
          <Camera className="size-3" /> Yours
        </button>
      )}

      {interactive && (clipSrc || stillSrc) && !(clipFailed && stillFailed) && (
        <span className="pointer-events-none absolute bottom-2.5 right-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#4B5058]/85 px-3.5 py-1.5 text-[12px] font-medium text-white shadow-sm backdrop-blur-md">
          {playing ? <Pause className="size-3 fill-current" /> : <Play className="size-3 fill-current" />}
          <span>{playing ? "tap to pause" : "tap to play"}</span>
        </span>
      )}
    </div>
  );
}
