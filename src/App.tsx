import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADVANCED_STATS,
  DEFAULT_PLAYERS,
  PLAY_MEMORY_GUIDE,
  SET_PIECES,
  STAT_DEFINITIONS,
  TIME_BUCKETS,
  TeamSide,
  PlayerSlot,
  StatEvent,
  createEventId,
  downloadCsv,
} from "./stats";
import { YouTubeVideoPlayer } from "./YouTubeVideoPlayer";
import {
  DEFAULT_VIDEO_SYNC,
  VideoSyncState,
  deriveMatchTime,
  formatClock,
  parseYouTubeVideoId,
} from "./video";

type MatchState = {
  homeTeam: string;
  awayTeam: string;
  activeBucket: string;
  minute: string;
  note: string;
  video: VideoSyncState;
  players: PlayerSlot[];
  events: StatEvent[];
};

const STORAGE_KEY = "power-soccer-stat-rater-v1";

const initialState: MatchState = {
  homeTeam: "Rock",
  awayTeam: "Opponent",
  activeBucket: TIME_BUCKETS[0],
  minute: "0:00",
  note: "",
  video: DEFAULT_VIDEO_SYNC,
  players: DEFAULT_PLAYERS,
  events: [],
};

function readStoredState(): MatchState {
  if (typeof window === "undefined") {
    return initialState;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return initialState;
    }

    const parsed = JSON.parse(raw) as MatchState;
    return {
      ...initialState,
      ...parsed,
      video: {
        ...initialState.video,
        ...(parsed.video ?? {}),
      },
      players: parsed.players?.length ? parsed.players : initialState.players,
      events: parsed.events ?? [],
    };
  } catch {
    return initialState;
  }
}

function App() {
  const [match, setMatch] = useState<MatchState>(() => readStoredState());
  const [selectedSetPiece, setSelectedSetPiece] = useState(SET_PIECES[0].code);
  const [setPieceTeam, setSetPieceTeam] = useState<TeamSide>("home");
  const [setPieceRating, setSetPieceRating] = useState(3);
  const [currentVideoSeconds, setCurrentVideoSeconds] = useState(0);

  const onVideoTimeChange = useCallback((seconds: number) => {
    setCurrentVideoSeconds(seconds);
  }, []);

  const derivedVideoTime = useMemo(
    () => deriveMatchTime(match.video, currentVideoSeconds),
    [currentVideoSeconds, match.video],
  );

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
  }, [match]);

  useEffect(() => {
    if (!match.video.syncEnabled) {
      return;
    }

    setMatch((current) => {
      if (!current.video.syncEnabled) {
        return current;
      }

      if (current.minute === derivedVideoTime.minute && current.activeBucket === derivedVideoTime.bucket) {
        return current;
      }

      return {
        ...current,
        minute: derivedVideoTime.minute,
        activeBucket: derivedVideoTime.bucket,
      };
    });
  }, [derivedVideoTime.bucket, derivedVideoTime.minute, match.video.syncEnabled]);

  const score = useMemo(() => {
    return match.events.reduce(
      (totals, event) => {
        if (event.kind === "stat" && event.statCode === "G") {
          totals[event.team] += 1;
        }
        return totals;
      },
      { home: 0, away: 0 },
    );
  }, [match.events]);

  const statSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of match.events) {
      if (event.kind !== "stat" || !event.statCode) {
        continue;
      }
      const playerKey = event.playerId ?? "unknown";
      const key = [event.team, playerKey, event.bucket, event.statCode].join("|");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [match.events]);

  const teamTotals = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of match.events) {
      if (event.kind !== "stat" || !event.statCode) {
        continue;
      }
      const key = [event.team, event.statCode].join("|");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [match.events]);

  const setPieceTotals = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of match.events) {
      if (event.kind !== "set-piece" || !event.setPieceCode) {
        continue;
      }
      const key = [event.team, event.setPieceCode, event.setPieceRating ?? ""].join("|");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [match.events]);

  const updateMatch = <K extends keyof MatchState>(key: K, value: MatchState[K]) => {
    setMatch((current) => ({ ...current, [key]: value }));
  };

  const updateVideo = (patch: Partial<VideoSyncState>) => {
    setMatch((current) => ({
      ...current,
      video: {
        ...current.video,
        ...patch,
      },
    }));
  };

  const updatePlayer = (playerId: string, patch: Partial<PlayerSlot>) => {
    setMatch((current) => ({
      ...current,
      players: current.players.map((player) =>
        player.id === playerId ? { ...player, ...patch } : player,
      ),
    }));
  };

  const addEvent = (event: Omit<StatEvent, "id" | "bucket" | "minute" | "note" | "recordedAt">) => {
    setMatch((current) => ({
      ...current,
      note: "",
      events: [
        {
          ...event,
          id: createEventId(),
          half: derivedVideoTime.half,
          matchSeconds: derivedVideoTime.matchSeconds,
          videoUrl: current.video.videoUrl,
          videoId: current.video.videoId,
          videoSeconds: currentVideoSeconds,
          bucket: current.video.syncEnabled ? derivedVideoTime.bucket : current.activeBucket,
          minute: current.video.syncEnabled ? derivedVideoTime.minute : current.minute,
          note: current.note,
          recordedAt: new Date().toISOString(),
        },
        ...current.events,
      ],
    }));
  };

  const addStatEvent = (player: PlayerSlot, statCode: string) => {
    const stat = STAT_DEFINITIONS.find((definition) => definition.code === statCode);
    if (!stat) {
      return;
    }

    addEvent({
      kind: "stat",
      team: player.team,
      playerId: player.id,
      playerName: player.name,
      playerRole: player.role,
      statCode: stat.code,
      statLabel: stat.label,
    });
  };

  const addSetPieceEvent = () => {
    const setPiece = SET_PIECES.find((piece) => piece.code === selectedSetPiece);
    if (!setPiece) {
      return;
    }

    addEvent({
      kind: "set-piece",
      team: setPieceTeam,
      setPieceCode: setPiece.code,
      setPieceLabel: setPiece.label,
      setPieceRating,
    });
  };

  const addTaggedNote = (tag: string) => {
    addEvent({
      kind: "note",
      team: setPieceTeam,
      statLabel: tag,
    });
  };

  const loadVideo = () => {
    updateVideo({ videoId: parseYouTubeVideoId(match.video.videoUrl) });
    setCurrentVideoSeconds(0);
  };

  const selectVideoStartHalf = (half: VideoSyncState["videoStartHalf"]) => {
    updateVideo({
      videoStartHalf: half,
      videoStartMatchClock: half === "second" ? "20:00" : "0:00",
    });
  };

  const markFirstHalfStart = () => {
    updateVideo({
      firstHalfStartVideoSeconds: currentVideoSeconds,
      firstHalfStartMatchClock: match.video.firstHalfStartMatchClock || "0:00",
    });
  };

  const markFirstHalfEnd = () => {
    updateVideo({
      firstHalfEndVideoSeconds: currentVideoSeconds,
      firstHalfEndMatchClock:
        derivedVideoTime.half === "first" ? derivedVideoTime.minute : match.video.firstHalfEndMatchClock,
    });
  };

  const markSecondHalfStart = () => {
    updateVideo({
      secondHalfStartVideoSeconds: currentVideoSeconds,
      secondHalfStartMatchClock: match.video.secondHalfStartMatchClock || "20:00",
    });
  };

  const deleteEvent = (eventId: string) => {
    setMatch((current) => ({
      ...current,
      events: current.events.filter((event) => event.id !== eventId),
    }));
  };

  const resetMatch = () => {
    if (!window.confirm("Clear all entered events and restore the default match setup?")) {
      return;
    }
    setMatch(initialState);
    setSelectedSetPiece(SET_PIECES[0].code);
    setSetPieceTeam("home");
    setSetPieceRating(3);
    setCurrentVideoSeconds(0);
  };

  const exportEvents = () => {
    downloadCsv("power-soccer-events.csv", [
      [
        "Recorded At",
        "Half",
        "Minute",
        "Match Seconds",
        "Time Bucket",
        "Video Seconds",
        "Video URL",
        "Team",
        "Player",
        "Role",
        "Kind",
        "Code",
        "Label",
        "Set Piece Rating",
        "Note",
      ],
      ...match.events
        .slice()
        .reverse()
        .map((event) => [
          event.recordedAt,
          event.half,
          event.minute,
          event.matchSeconds,
          event.bucket,
          event.videoSeconds,
          event.videoUrl,
          teamName(event.team),
          event.playerName,
          event.playerRole,
          event.kind,
          event.statCode ?? event.setPieceCode,
          event.statLabel ?? event.setPieceLabel,
          event.setPieceRating,
          event.note,
        ]),
    ]);
  };

  const exportSummary = () => {
    const header = [
      "Team",
      "Player",
      "Role",
      "Time",
      ...STAT_DEFINITIONS.map((stat) => stat.templateCode ?? stat.code),
    ];
    const rows = match.players.flatMap((player) =>
      TIME_BUCKETS.map((bucket) => [
        teamName(player.team),
        player.name,
        player.role,
        bucket,
        ...STAT_DEFINITIONS.map(
          (stat) => statSummary.get([player.team, player.id, bucket, stat.code].join("|")) ?? "",
        ),
      ]),
    );
    downloadCsv("power-soccer-summary.csv", [header, ...rows]);
  };

  const teamName = (team: TeamSide) => (team === "home" ? match.homeTeam : match.awayTeam);
  const homePlayers = match.players.filter((player) => player.team === "home");
  const awayPlayers = match.players.filter((player) => player.team === "away");
  const latestEvents = match.events.slice(0, 20);

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Power soccer stat collection</p>
          <h1>Rater console</h1>
          <p className="hero-copy">
            Tap the player and stat as the play happens. The console keeps the spreadsheet-style
            time buckets, definitions, set pieces, and an exportable event log.
          </p>
        </div>
        <div className="scoreboard" aria-label="Current score">
          <div>
            <span>{match.homeTeam}</span>
            <strong>{score.home}</strong>
          </div>
          <div className="score-divider">:</div>
          <div>
            <span>{match.awayTeam}</span>
            <strong>{score.away}</strong>
          </div>
        </div>
      </header>

      <section className="panel video-sync-panel" aria-labelledby="video-title">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Video sync</p>
            <h2 id="video-title">Link video time to match time</h2>
            <p className="muted">
              Load a YouTube match video, mark the half boundaries as playback reaches them, and
              every stat entry will keep both the video timestamp and derived match clock.
            </p>
          </div>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={match.video.syncEnabled}
              onChange={(event) => updateVideo({ syncEnabled: event.target.checked })}
            />
            Use video clock for entries
          </label>
        </div>

        <div className="video-sync-grid">
          <div className="video-column">
            <label>
              YouTube URL or video ID
              <div className="inline-control">
                <input
                  value={match.video.videoUrl}
                  onChange={(event) => updateVideo({ videoUrl: event.target.value })}
                  placeholder="youtube.com/watch?v=..."
                />
                <button type="button" className="primary-action" onClick={loadVideo}>
                  Load video
                </button>
              </div>
            </label>
            <YouTubeVideoPlayer
              videoId={match.video.videoId}
              currentVideoSeconds={currentVideoSeconds}
              onTimeChange={onVideoTimeChange}
            />
          </div>

          <div className="sync-column">
            <div className="current-time-card">
              <span>Derived match time</span>
              <strong>{derivedVideoTime.minute}</strong>
              <p>{derivedVideoTime.status}</p>
            </div>

            <div className="sync-grid">
              <label>
                Video starts in
                <select
                  value={match.video.videoStartHalf}
                  onChange={(event) =>
                    selectVideoStartHalf(event.target.value as VideoSyncState["videoStartHalf"])
                  }
                >
                  <option value="first">1st half</option>
                  <option value="second">2nd half</option>
                </select>
              </label>
              <label>
                Match clock at video start
                <input
                  value={match.video.videoStartMatchClock}
                  onChange={(event) => updateVideo({ videoStartMatchClock: event.target.value })}
                  placeholder="0:00"
                />
              </label>
              <label>
                1st-half start clock
                <input
                  value={match.video.firstHalfStartMatchClock}
                  onChange={(event) => updateVideo({ firstHalfStartMatchClock: event.target.value })}
                  placeholder="0:00"
                />
              </label>
              <label>
                1st-half end clock
                <input
                  value={match.video.firstHalfEndMatchClock}
                  onChange={(event) => updateVideo({ firstHalfEndMatchClock: event.target.value })}
                  placeholder="20:00"
                />
              </label>
              <label>
                2nd-half start clock
                <input
                  value={match.video.secondHalfStartMatchClock}
                  onChange={(event) => updateVideo({ secondHalfStartMatchClock: event.target.value })}
                  placeholder="20:00"
                />
              </label>
            </div>

            <div className="boundary-actions">
              <button type="button" onClick={markFirstHalfStart}>
                Mark 1H start at {formatClock(currentVideoSeconds)}
              </button>
              <button type="button" onClick={markFirstHalfEnd}>
                Mark 1H end at {formatClock(currentVideoSeconds)}
              </button>
              <button type="button" onClick={markSecondHalfStart}>
                Mark 2H start at {formatClock(currentVideoSeconds)}
              </button>
            </div>

            <div className="anchor-list">
              <AnchorRow label="1H start" seconds={match.video.firstHalfStartVideoSeconds} />
              <AnchorRow label="1H end" seconds={match.video.firstHalfEndVideoSeconds} />
              <AnchorRow label="2H start" seconds={match.video.secondHalfStartVideoSeconds} />
            </div>
          </div>
        </div>
      </section>

      <section className="panel setup-panel" aria-labelledby="setup-title">
        <div>
          <p className="section-kicker">Match setup</p>
          <h2 id="setup-title">Context for every tap</h2>
        </div>
        <div className="setup-grid">
          <label>
            Home
            <input
              value={match.homeTeam}
              onChange={(event) => updateMatch("homeTeam", event.target.value)}
            />
          </label>
          <label>
            Away
            <input
              value={match.awayTeam}
              onChange={(event) => updateMatch("awayTeam", event.target.value)}
            />
          </label>
          <label>
            Match clock
            <input
              value={match.minute}
              onChange={(event) => updateMatch("minute", event.target.value)}
              placeholder="12:34"
              disabled={match.video.syncEnabled}
            />
          </label>
          <label>
            Time bucket
            <select
              value={match.activeBucket}
              onChange={(event) => updateMatch("activeBucket", event.target.value)}
              disabled={match.video.syncEnabled}
            >
              {TIME_BUCKETS.map((bucket) => (
                <option value={bucket} key={bucket}>
                  {bucket}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="bucket-row" aria-label="Quick time bucket selector">
          {TIME_BUCKETS.map((bucket) => (
            <button
              className={bucket === match.activeBucket ? "chip active" : "chip"}
              type="button"
              key={bucket}
              onClick={() => updateMatch("activeBucket", bucket)}
              disabled={match.video.syncEnabled}
            >
              {bucket}
            </button>
          ))}
        </div>
        <label className="wide-note">
          Note for next event
          <textarea
            value={match.note}
            onChange={(event) => updateMatch("note", event.target.value)}
            placeholder="Optional detail, e.g. left wall set, 2-on-1 near own box, big chance..."
          />
        </label>
      </section>

      <section className="columns">
        <PlayerTeamPanel
          title={match.homeTeam}
          players={homePlayers}
          onPlayerChange={updatePlayer}
          onStat={addStatEvent}
        />
        <PlayerTeamPanel
          title={match.awayTeam}
          players={awayPlayers}
          onPlayerChange={updatePlayer}
          onStat={addStatEvent}
        />
      </section>

      <section className="columns secondary-columns">
        <section className="panel" aria-labelledby="set-piece-title">
          <p className="section-kicker">Set pieces</p>
          <h2 id="set-piece-title">Record set-piece result</h2>
          <div className="set-piece-controls">
            <label>
              Team
              <select
                value={setPieceTeam}
                onChange={(event) => setSetPieceTeam(event.target.value as TeamSide)}
              >
                <option value="home">{match.homeTeam}</option>
                <option value="away">{match.awayTeam}</option>
              </select>
            </label>
            <label>
              Set
              <select
                value={selectedSetPiece}
                onChange={(event) => setSelectedSetPiece(event.target.value)}
              >
                {SET_PIECES.map((piece) => (
                  <option key={piece.code} value={piece.code}>
                    {piece.code} - {piece.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Outcome
              <select
                value={setPieceRating}
                onChange={(event) => setSetPieceRating(Number(event.target.value))}
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <option value={rating} key={rating}>
                    {rating}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="primary-action" onClick={addSetPieceEvent}>
              Add set piece
            </button>
          </div>
          <div className="definition-list compact">
            {SET_PIECES.map((piece) => (
              <div key={piece.code}>
                <strong>{piece.code}</strong>
                <span>{piece.detail}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="advanced-title">
          <p className="section-kicker">Extra tags</p>
          <h2 id="advanced-title">Capture advanced observations</h2>
          <p className="muted">
            The definitions tab lists these additional metrics without abbreviations. Use them as
            tagged notes when the rater needs to preserve context for later review.
          </p>
          <div className="tag-grid">
            {ADVANCED_STATS.map((tag) => (
              <button type="button" className="tag-button" key={tag} onClick={() => addTaggedNote(tag)}>
                {tag}
              </button>
            ))}
          </div>
        </section>
      </section>

      <section className="columns secondary-columns">
        <section className="panel" aria-labelledby="summary-title">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Live summary</p>
              <h2 id="summary-title">Team stat totals</h2>
            </div>
            <div className="action-row">
              <button type="button" onClick={exportSummary}>
                Export summary CSV
              </button>
              <button type="button" onClick={exportEvents}>
                Export event CSV
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  {STAT_DEFINITIONS.map((stat) => (
                    <th title={stat.label} key={stat.code}>
                      {stat.templateCode ?? stat.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["home", "away"] as TeamSide[]).map((team) => (
                  <tr key={team}>
                    <th>{teamName(team)}</th>
                    {STAT_DEFINITIONS.map((stat) => (
                      <td key={stat.code}>{teamTotals.get([team, stat.code].join("|")) ?? 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Set-piece totals</h3>
          <div className="set-piece-summary">
            {SET_PIECES.map((piece) => (
              <div key={piece.code} className="mini-card">
                <strong>{piece.code}</strong>
                <span>
                  {(["home", "away"] as TeamSide[])
                    .map((team) => {
                      const total = [1, 2, 3, 4, 5].reduce(
                        (sum, rating) =>
                          sum + (setPieceTotals.get([team, piece.code, rating].join("|")) ?? 0),
                        0,
                      );
                      return `${teamName(team)} ${total}`;
                    })
                    .join(" / ")}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="event-log-title">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Audit trail</p>
              <h2 id="event-log-title">Latest entries</h2>
            </div>
            <button type="button" className="danger" onClick={resetMatch}>
              Reset match
            </button>
          </div>
          {latestEvents.length === 0 ? (
            <p className="empty-state">No events yet. Tap a player stat to start collecting.</p>
          ) : (
            <div className="event-list">
              {latestEvents.map((event) => (
                <article className="event-card" key={event.id}>
                  <div>
                    <span className="event-code">
                      {event.statCode ?? event.setPieceCode ?? "Note"}
                    </span>
                    <strong>
                      {event.playerName ?? teamName(event.team)}{" "}
                      <small>{event.statLabel ?? event.setPieceLabel}</small>
                    </strong>
                    <p>
                      {event.bucket} / {event.minute}
                      {event.half ? ` / ${event.half}` : ""}
                      {event.videoSeconds !== undefined ? ` / video ${formatClock(event.videoSeconds)}` : ""}
                      {event.setPieceRating ? ` / outcome ${event.setPieceRating}` : ""}
                      {event.note ? ` - ${event.note}` : ""}
                    </p>
                  </div>
                  <button type="button" onClick={() => deleteEvent(event.id)}>
                    Delete
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>

      <section className="panel definitions-panel" aria-labelledby="definitions-title">
        <p className="section-kicker">Definitions tab</p>
        <h2 id="definitions-title">Stat reference</h2>
        <div className="definition-list">
          {STAT_DEFINITIONS.map((stat) => (
            <div key={stat.code} className={`definition-item tone-${stat.tone}`}>
              <strong>{stat.templateCode ?? stat.code}</strong>
              <span>
                {stat.label}: {stat.detail}
              </span>
            </div>
          ))}
        </div>
        <h3>Play memory guide</h3>
        <div className="memory-grid">
          {PLAY_MEMORY_GUIDE.map((item) => (
            <div key={item.set} className="mini-card">
              <strong>{item.set}</strong>
              <span>{item.option1}</span>
              <span>{item.option2}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

type PlayerTeamPanelProps = {
  title: string;
  players: PlayerSlot[];
  onPlayerChange: (playerId: string, patch: Partial<PlayerSlot>) => void;
  onStat: (player: PlayerSlot, statCode: string) => void;
};

type AnchorRowProps = {
  label: string;
  seconds?: number;
};

function AnchorRow({ label, seconds }: AnchorRowProps) {
  return (
    <div className="anchor-row">
      <span>{label}</span>
      <strong>{seconds === undefined ? "Not marked" : formatClock(seconds)}</strong>
    </div>
  );
}

function PlayerTeamPanel({ title, players, onPlayerChange, onStat }: PlayerTeamPanelProps) {
  return (
    <section className="panel player-panel" aria-labelledby={`${title}-players`}>
      <p className="section-kicker">Quick entry</p>
      <h2 id={`${title}-players`}>{title} players</h2>
      <div className="player-stack">
        {players.map((player) => (
          <article className="player-card" key={player.id}>
            <div className="player-fields">
              <label>
                Player
                <input
                  value={player.name}
                  onChange={(event) => onPlayerChange(player.id, { name: event.target.value })}
                />
              </label>
              <label>
                Role
                <input
                  value={player.role}
                  onChange={(event) => onPlayerChange(player.id, { role: event.target.value })}
                />
              </label>
            </div>
            <div className="stat-button-grid">
              {STAT_DEFINITIONS.map((stat) => (
                <button
                  type="button"
                  className={`stat-button tone-${stat.tone}`}
                  key={stat.code}
                  title={`${stat.label}: ${stat.detail}`}
                  onClick={() => onStat(player, stat.code)}
                >
                  <strong>{stat.templateCode ?? stat.code}</strong>
                  <span>{stat.label}</span>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default App;
