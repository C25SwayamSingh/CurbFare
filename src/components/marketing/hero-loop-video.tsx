"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative hero background loop.
 *
 * Reduced-motion users keep the imagery but lose the motion: the loop holds
 * its first frame instead of disappearing. Playback is driven here rather
 * than by an `autoPlay` attribute so the reduced-motion check always wins
 * the race against the browser's autoplay. A missing file fails silently —
 * the brand-colored hero block behind the element is the fallback.
 */
export function HeroLoopVideo({
  webmSrc,
  mp4Src,
}: {
  webmSrc: string;
  mp4Src: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof window.matchMedia !== "function") return;

    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (query.matches) {
        video.pause();
        video.currentTime = 0;
      } else {
        void video.play().catch(() => {
          // Autoplay blocked or file missing — the teal block stands in.
        });
      }
    };

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={ref}
      aria-hidden="true"
      loop
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      className="absolute inset-0 size-full object-cover"
    >
      <source src={webmSrc} type="video/webm" />
      <source src={mp4Src} type="video/mp4" />
    </video>
  );
}
