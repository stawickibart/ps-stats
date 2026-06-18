import { useEffect, useRef, useState } from "react";
import { formatClock } from "./video";

type YouTubePlayerProps = {
  videoId: string;
  currentVideoSeconds: number;
  onTimeChange: (seconds: number) => void;
};

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubeConstructor = new (
  element: HTMLElement,
  options: {
    videoId: string;
    playerVars?: Record<string, number>;
    events?: {
      onReady?: () => void;
    };
  },
) => YouTubePlayerInstance;

declare global {
  interface Window {
    YT?: {
      Player: YouTubeConstructor;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<void> | undefined;

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  youtubeApiPromise ??= new Promise((resolve) => {
    const previousCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousCallback?.();
      resolve();
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
  });

  return youtubeApiPromise;
}

export function YouTubeVideoPlayer({
  videoId,
  currentVideoSeconds,
  onTimeChange,
}: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    playerRef.current?.destroy();
    playerRef.current = null;

    if (!videoId || !hostRef.current) {
      return;
    }

    loadYouTubeApi().then(() => {
      if (cancelled || !window.YT?.Player || !hostRef.current) {
        return;
      }

      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId,
        playerVars: {
          controls: 1,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => setReady(true),
        },
      });
    });

    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const intervalId = window.setInterval(() => {
      const nextTime = playerRef.current?.getCurrentTime();
      if (typeof nextTime === "number" && Number.isFinite(nextTime)) {
        onTimeChange(nextTime);
      }
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [onTimeChange, ready]);

  const seekBy = (offsetSeconds: number) => {
    const target = Math.max(0, currentVideoSeconds + offsetSeconds);
    playerRef.current?.seekTo(target, true);
    onTimeChange(target);
  };

  if (!videoId) {
    return (
      <div className="video-placeholder">
        Paste a YouTube URL or video ID, then click <strong>Load video</strong>.
      </div>
    );
  }

  return (
    <div className="video-player-shell">
      <div className="video-frame" ref={hostRef} />
      <div className="video-controls">
        <button type="button" onClick={() => seekBy(-10)} disabled={!ready}>
          -10s
        </button>
        <button type="button" onClick={() => seekBy(-5)} disabled={!ready}>
          -5s
        </button>
        <span>Video {formatClock(currentVideoSeconds)}</span>
        <button type="button" onClick={() => seekBy(5)} disabled={!ready}>
          +5s
        </button>
        <button type="button" onClick={() => seekBy(10)} disabled={!ready}>
          +10s
        </button>
      </div>
    </div>
  );
}
