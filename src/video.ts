import { TIME_BUCKETS } from "./stats";

export type HalfStatus = "first" | "halftime" | "second" | "unknown";

export type VideoSyncState = {
  videoUrl: string;
  videoId: string;
  syncEnabled: boolean;
  videoStartHalf: "first" | "second";
  videoStartMatchClock: string;
  firstHalfStartVideoSeconds?: number;
  firstHalfStartMatchClock: string;
  firstHalfEndVideoSeconds?: number;
  firstHalfEndMatchClock: string;
  secondHalfStartVideoSeconds?: number;
  secondHalfStartMatchClock: string;
};

export type DerivedMatchTime = {
  half: HalfStatus;
  matchSeconds?: number;
  minute: string;
  bucket: string;
  status: string;
};

export const DEFAULT_VIDEO_SYNC: VideoSyncState = {
  videoUrl: "https://youtube.com/watch?v=2pcXGp8v4-s&feature=youtu.be",
  videoId: "2pcXGp8v4-s",
  syncEnabled: true,
  videoStartHalf: "first",
  videoStartMatchClock: "0:00",
  firstHalfStartMatchClock: "0:00",
  firstHalfEndMatchClock: "20:00",
  secondHalfStartMatchClock: "20:00",
};

const HALF_LABELS: Record<HalfStatus, string> = {
  first: "1st half",
  halftime: "Halftime",
  second: "2nd half",
  unknown: "Unknown",
};

export function parseYouTubeVideoId(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] ?? "";
    }

    if (url.hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/").filter(Boolean)[1] ?? "";
      }
      return url.searchParams.get("v") ?? "";
    }
  } catch {
    return trimmed;
  }

  return trimmed;
}

export function parseClockToSeconds(value: string) {
  const parts = value
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part) || part < 0)) {
    return undefined;
  }

  if (parts.length === 1) {
    return parts[0] * 60;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return undefined;
}

export function formatClock(totalSeconds: number) {
  const normalized = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function bucketFromMatchSeconds(matchSeconds?: number) {
  if (matchSeconds === undefined) {
    return TIME_BUCKETS[0];
  }

  if (matchSeconds >= 40 * 60) {
    return "Extra";
  }

  const index = Math.max(0, Math.min(TIME_BUCKETS.length - 2, Math.floor(matchSeconds / (5 * 60))));
  return TIME_BUCKETS[index];
}

export function deriveMatchTime(sync: VideoSyncState, videoSeconds: number): DerivedMatchTime {
  const firstStartClock = parseClockToSeconds(sync.firstHalfStartMatchClock) ?? 0;
  const firstEndClock = parseClockToSeconds(sync.firstHalfEndMatchClock) ?? 20 * 60;
  const secondStartClock = parseClockToSeconds(sync.secondHalfStartMatchClock) ?? 20 * 60;
  const videoStartClock =
    parseClockToSeconds(sync.videoStartMatchClock) ??
    (sync.videoStartHalf === "second" ? 20 * 60 : 0);

  let half: HalfStatus = sync.videoStartHalf;
  let matchSeconds = videoStartClock + videoSeconds;

  if (sync.firstHalfStartVideoSeconds !== undefined) {
    matchSeconds = firstStartClock + (videoSeconds - sync.firstHalfStartVideoSeconds);
    half = "first";
  }

  if (
    sync.firstHalfEndVideoSeconds !== undefined &&
    videoSeconds >= sync.firstHalfEndVideoSeconds &&
    (sync.secondHalfStartVideoSeconds === undefined || videoSeconds < sync.secondHalfStartVideoSeconds)
  ) {
    matchSeconds = firstEndClock;
    half = "halftime";
  }

  if (sync.secondHalfStartVideoSeconds !== undefined && videoSeconds >= sync.secondHalfStartVideoSeconds) {
    matchSeconds = secondStartClock + (videoSeconds - sync.secondHalfStartVideoSeconds);
    half = "second";
  }

  const normalizedMatchSeconds = Math.max(0, matchSeconds);
  const minute = half === "halftime" ? formatClock(firstEndClock) : formatClock(normalizedMatchSeconds);
  const bucket = half === "halftime" ? bucketFromMatchSeconds(firstEndClock) : bucketFromMatchSeconds(normalizedMatchSeconds);
  const status = `${HALF_LABELS[half]} / match ${minute} / video ${formatClock(videoSeconds)}`;

  return {
    half,
    matchSeconds: normalizedMatchSeconds,
    minute,
    bucket,
    status,
  };
}
