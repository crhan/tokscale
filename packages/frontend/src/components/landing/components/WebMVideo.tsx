"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type VideoHTMLAttributes,
} from "react";

type WebMVideoProps = Omit<
  VideoHTMLAttributes<HTMLVideoElement>,
  "src" | "children"
> & {
  webmSrc: string;
  mp4FallbackSrc: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * A video component that plays WebM VP9 on all browsers, including Safari.
 *
 * - Chrome/Firefox: Uses native `<video>` with WebM source (best performance).
 * - Safari/iOS: Uses ogv.js (WASM-based VP9 decoder) to play WebM via canvas.
 *   Only loads ~444KB of WASM files on Safari.
 *
 * Falls back to MP4 if ogv.js fails to load.
 */
export function WebMVideo({
  webmSrc,
  mp4FallbackSrc,
  className,
  style,
  autoPlay,
  loop,
  muted,
  playsInline,
  ...rest
}: WebMVideoProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ogvPlayerRef = useRef<unknown>(null);
  const [useOgv, setUseOgv] = useState(false);
  const [ogvReady, setOgvReady] = useState(false);

  useEffect(() => {
    // Detect if native WebM VP9 playback is unreliable (Safari)
    const video = document.createElement("video");
    const canPlayWebM = video.canPlayType('video/webm; codecs="vp9"');

    // Safari returns "" or "maybe" but often fails to actually render VP9
    // We detect Safari specifically to use ogv.js
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
      // iOS browsers (all use WebKit)
      (/iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as Record<string, unknown>).MSStream);

    if (!isSafari && canPlayWebM) {
      // Native WebM works fine (Chrome, Firefox, Edge)
      setUseOgv(false);
      return;
    }

    // Safari detected — load ogv.js
    setUseOgv(true);

    const loadOgv = async () => {
      try {
        // Load ogv.js from public directory
        const script = document.createElement("script");
        script.src = "/ogv/ogv.js";
        script.async = true;

        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load ogv.js"));
          document.head.appendChild(script);
        });

        const OGV = (window as Record<string, unknown>).OGVLoader as {
          base: string;
        };
        if (OGV) {
          OGV.base = "/ogv";
        }

        setOgvReady(true);
      } catch {
        // ogv.js failed to load — fall back to native video with MP4
        setUseOgv(false);
      }
    };

    loadOgv();
  }, []);

  useEffect(() => {
    if (!useOgv || !ogvReady || !containerRef.current) return;

    const OGVPlayer = (window as Record<string, unknown>).OGVPlayer as new (
      options?: Record<string, unknown>,
    ) => HTMLVideoElement & { stop: () => void };

    if (!OGVPlayer) {
      setUseOgv(false);
      return;
    }

    const player = new OGVPlayer();
    player.src = webmSrc;
    player.muted = !!muted;
    player.loop = !!loop;

    // Style the ogv.js canvas to fill the container
    player.style.width = "100%";
    player.style.height = "100%";
    player.style.objectFit = "contain";

    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(player as unknown as Node);
    ogvPlayerRef.current = player;

    if (autoPlay) {
      player.play().catch(() => {
        // Autoplay may be blocked
      });
    }

    return () => {
      try {
        player.stop();
      } catch {
        // ignore cleanup errors
      }
    };
  }, [useOgv, ogvReady, webmSrc, autoPlay, loop, muted]);

  // Native video path (Chrome/Firefox, or ogv.js fallback failure)
  if (!useOgv) {
    return (
      <video
        className={className}
        style={style}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        {...rest}
      >
        <source src={webmSrc} type="video/webm" />
        <source src={mp4FallbackSrc} type="video/mp4" />
      </video>
    );
  }

  // ogv.js path (Safari) — renders into a div container
  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        ...style,
        overflow: "hidden",
      }}
    />
  );
}
