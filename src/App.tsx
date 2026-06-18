import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ADVANCED_STATS,
  DEFAULT_PLAYS,
  DEFAULT_PLAYERS,
  PLAY_MEMORY_GUIDE,
  SET_PIECES,
  STAT_DEFINITIONS,
  STAT_VALUE_TYPES,
  TIME_BUCKETS,
  TeamSide,
  PlayDefinition,
  PlayType,
  PlayerSlot,
  PossessionOwner,
  PossessionSegment,
  StatDefinition,
  StatEvent,
  StatValueType,
  createEventId,
  downloadCsv,
} from "./stats";
import { YouTubeVideoPlayer } from "./YouTubeVideoPlayer";
import {
  DEFAULT_VIDEO_SYNC,
  VideoSyncState,
  bucketFromMatchSeconds,
  deriveMatchTime,
  formatClock,
  parseClockToSeconds,
  parseYouTubeVideoId,
} from "./video";

type MatchState = {
  homeTeam: string;
  awayTeam: string;
  gameDate: string;
  gameLocation: string;
  homeDivision: string;
  awayDivision: string;
  activeBucket: string;
  minute: string;
  note: string;
  nextStatValue: string;
  video: VideoSyncState;
  statDefinitions: StatDefinition[];
  plays: PlayDefinition[];
  activePossession: ActivePossession;
  possessionSelection: PossessionSelection;
  possessionSegments: PossessionSegment[];
  knowledgeBase: KnowledgeBase;
  players: PlayerSlot[];
  events: StatEvent[];
};

const STORAGE_KEY = "power-soccer-stat-rater-v1";
type UserRole = "rater" | "admin";
type AppPage = "tracker" | "admin-overview" | "settings" | "knowledge" | "game-review";
type StatTotals = Record<string, number>;
type NoticeTone = "info" | "warning" | "error" | "success";
type ActivePossession = PossessionOwner | "unset";

type AppNotice = {
  id: string;
  tone: NoticeTone;
  title: string;
  message: string;
};

type StructuredEventType =
  | ""
  | "completed-pass"
  | "failed-pass"
  | "dribble"
  | "shot"
  | "engagement"
  | "turnover"
  | "set-piece"
  | "substitution"
  | "note";

type StructuredEventForm = {
  type: StructuredEventType;
  team: TeamSide;
  primaryPlayerId: string;
  secondaryPlayerId: string;
  opponentPlayerId: string;
  outcome: string;
  direction: "" | "left" | "right";
  fieldDepth: string;
  fieldLane: string;
  fieldEndDepth: string;
  fieldEndLane: string;
  eventSource: "open-play" | "set-piece";
  sourceSetPieceCode: string;
  sourceSetPieceRating: number;
  sourcePlayId: string;
  advancedTags: string[];
  detail: string;
};

type PossessionSelection = {
  homePlayerId: string;
  awayPlayerId: string;
  contestedPlayerOneId: string;
  contestedPlayerTwoId: string;
};

type RatingScores = {
  attack: number;
  defense: number;
  possession: number;
  playstyle: number;
  discipline: number;
  overall: number;
};

type TeamKnowledge = {
  id: string;
  name: string;
  division: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  ties: number;
  goalsFor: number;
  goalsAgainst: number;
  possessionSeconds: number;
  contestedSeconds: number;
  outOfPlaySeconds: number;
  stats: StatTotals;
  playStyles: StatTotals;
  ratings: RatingScores;
  gameIds: string[];
  updatedAt: string;
};

type PlayerKnowledge = {
  id: string;
  name: string;
  teamNames: string[];
  divisions: string[];
  gamesPlayed: number;
  stats: StatTotals;
  ratings: RatingScores;
  gameIds: string[];
  updatedAt: string;
};

type GameSnapshot = {
  id: string;
  date: string;
  videoUrl: string;
  finishedAt: string;
  location: string;
  homeTeam: string;
  awayTeam: string;
  homeDivision: string;
  awayDivision: string;
  homeScore: number;
  awayScore: number;
  teamStats: Record<TeamSide, StatTotals>;
  teamPlayStyles: Record<TeamSide, StatTotals>;
  playerStats: Array<{
    playerId: string;
    playerName: string;
    team: TeamSide;
    teamName: string;
    division: string;
    role?: string;
    stats: StatTotals;
    ratings: RatingScores;
  }>;
  possession: Record<PossessionOwner, number>;
  possessionSegments: PossessionSegment[];
  events: StatEvent[];
  eventCount: number;
};

type KnowledgeBase = {
  players: PlayerKnowledge[];
  teams: TeamKnowledge[];
  games: GameSnapshot[];
};

const emptyKnowledgeBase: KnowledgeBase = {
  players: [],
  teams: [],
  games: [],
};

function defaultPossessionSelection(_players: PlayerSlot[]): PossessionSelection {
  return {
    homePlayerId: "",
    awayPlayerId: "",
    contestedPlayerOneId: "",
    contestedPlayerTwoId: "",
  };
}

function defaultStructuredEventForm(): StructuredEventForm {
  return {
    type: "",
    team: "home",
    primaryPlayerId: "",
    secondaryPlayerId: "",
    opponentPlayerId: "",
    outcome: "",
    direction: "",
    fieldDepth: "mid court",
    fieldLane: "middle",
    fieldEndDepth: "mid court",
    fieldEndLane: "middle",
    eventSource: "open-play",
    sourceSetPieceCode: SET_PIECES[0].code,
    sourceSetPieceRating: 3,
    sourcePlayId: "",
    advancedTags: [],
    detail: "",
  };
}

function centerPlayerIdForTeam(players: PlayerSlot[], team: TeamSide) {
  return (
    players.find((player) => player.team === team && player.role.toLowerCase().includes("center"))?.id ??
    players.find((player) => player.team === team && player.role.startsWith("2"))?.id ??
    players.find((player) => player.team === team)?.id ??
    ""
  );
}

const initialState: MatchState = {
  homeTeam: "Ducks",
  awayTeam: "Steamrollers",
  gameDate: new Date().toISOString().slice(0, 10),
  gameLocation: "",
  homeDivision: "104",
  awayDivision: "104",
  activeBucket: TIME_BUCKETS[0],
  minute: "0:00",
  note: "",
  nextStatValue: "",
  video: DEFAULT_VIDEO_SYNC,
  statDefinitions: STAT_DEFINITIONS,
  plays: DEFAULT_PLAYS,
  activePossession: "unset",
  possessionSelection: defaultPossessionSelection(DEFAULT_PLAYERS),
  possessionSegments: [],
  knowledgeBase: createSeedKnowledgeBase(),
  players: DEFAULT_PLAYERS,
  events: [],
};

function normalizeStats(stats?: StatDefinition[]) {
  if (!stats?.length) {
    return STAT_DEFINITIONS;
  }

  const normalized = stats.map((stat, index) => ({
    ...stat,
    id: stat.id || `${stat.code || "stat"}-${index}`,
    valueType: stat.valueType ?? "integer",
    active: stat.active ?? true,
  }));

  const existingIds = new Set(normalized.map((stat) => stat.id));
  const existingCodes = new Set(normalized.map((stat) => stat.code));
  const missingDefaults = STAT_DEFINITIONS.filter(
    (stat) => !existingIds.has(stat.id) && !existingCodes.has(stat.code),
  );

  return [...normalized, ...missingDefaults];
}

function normalizePlays(plays?: PlayDefinition[]) {
  if (
    !plays?.length ||
    plays.some((play) => play.id.startsWith("offensive-option") || play.id.startsWith("defensive-option"))
  ) {
    return DEFAULT_PLAYS;
  }

  return plays.map((play, index) => ({
    ...play,
    id: play.id || `play-${index}`,
    type: play.type ?? "offense",
    artUrl: play.artUrl ?? "",
    active: play.active ?? true,
  }));
}

function normalizePlayers(players?: PlayerSlot[]) {
  if (!players?.length) {
    return DEFAULT_PLAYERS;
  }

  const hasPreDucksDefaultIds = players.some(
    (player) =>
      player.id === "opp-c" ||
      player.id === "opp-aw" ||
      player.id === "opp-dw" ||
      player.id === "opp-g",
  );
  if (
    hasPreDucksDefaultIds ||
    players.some((player) => player.name.startsWith("Home ") || player.name.startsWith("Away "))
  ) {
    return DEFAULT_PLAYERS;
  }

  return players.map((player) => ({
    ...player,
    active: player.active ?? !player.role.toLowerCase().includes("sub"),
  }));
}

function normalizePossessionSegments(segments?: PossessionSegment[]) {
  if (!segments?.length) {
    return [];
  }

  return segments
    .filter((segment) => segment.endSeconds > segment.startSeconds)
    .map((segment, index) => ({
      ...segment,
      id: segment.id || `possession-${index}`,
      owner: segment.owner ?? "contested",
      participantPlayerIds: segment.participantPlayerIds ?? [],
      participantPlayerNames: segment.participantPlayerNames ?? [],
    }));
}

function normalizePossessionSelection(selection: PossessionSelection | undefined, players: PlayerSlot[]) {
  return {
    ...defaultPossessionSelection(players),
    ...(selection ?? {}),
  };
}

function selectedPossessionPlayerIds(owner: ActivePossession, selection: PossessionSelection) {
  if (owner === "out" || owner === "unset") {
    return [];
  }

  if (owner === "home") {
    return selection.homePlayerId ? [selection.homePlayerId] : [];
  }

  if (owner === "away") {
    return selection.awayPlayerId ? [selection.awayPlayerId] : [];
  }

  return [selection.contestedPlayerOneId, selection.contestedPlayerTwoId].filter(Boolean);
}

function participantKey(owner: ActivePossession, selection: PossessionSelection) {
  const ids = selectedPossessionPlayerIds(owner, selection);
  return owner === "contested" ? ids.slice().sort().join("|") : ids.join("|");
}

function resolvePossessionParticipants(
  owner: ActivePossession,
  selection: PossessionSelection,
  players: PlayerSlot[],
) {
  if (owner === "unset") {
    return undefined;
  }

  if (owner === "out") {
    return {
      ids: [],
      names: [],
    };
  }

  const ids = selectedPossessionPlayerIds(owner, selection);
  if (owner === "contested" && new Set(ids).size !== 2) {
    return undefined;
  }
  if (owner !== "contested" && ids.length !== 1) {
    return undefined;
  }

  const selectedPlayers = ids
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is PlayerSlot => Boolean(player));

  if (selectedPlayers.length !== ids.length) {
    return undefined;
  }

  return {
    ids: owner === "contested" ? selectedPlayers.map((player) => player.id).sort() : selectedPlayers.map((player) => player.id),
    names:
      owner === "contested"
        ? selectedPlayers.map((player) => player.name || player.role).sort()
        : selectedPlayers.map((player) => player.name || player.role),
  };
}

function normalizeId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "unknown";
}

function normalizeKnowledgeBase(knowledgeBase?: KnowledgeBase) {
  if (!knowledgeBase || (!knowledgeBase.games.length && !knowledgeBase.players.length && !knowledgeBase.teams.length)) {
    return createSeedKnowledgeBase();
  }

  return {
    players:
      knowledgeBase?.players.map((player) => ({
        ...player,
        ratings: normalizeRatings(player.ratings),
      })) ?? [],
    teams:
      knowledgeBase?.teams.map((team) => ({
        ...team,
        outOfPlaySeconds: team.outOfPlaySeconds ?? 0,
        playStyles: team.playStyles ?? {},
        ratings: normalizeRatings(team.ratings),
      })) ?? [],
    games:
      knowledgeBase?.games.map((game) => ({
        ...game,
        teamPlayStyles: game.teamPlayStyles ?? { home: {}, away: {} },
        possessionSegments: game.possessionSegments ?? [],
        events: game.events ?? [],
      })) ?? [],
  };
}

function normalizeRatings(ratings?: RatingScores) {
  return {
    attack: ratings?.attack ?? 0,
    defense: ratings?.defense ?? 0,
    possession: ratings?.possession ?? 0,
    playstyle: ratings?.playstyle ?? 0,
    discipline: ratings?.discipline ?? 0,
    overall: ratings?.overall ?? 0,
  };
}

function emptyRatings(): RatingScores {
  return {
    attack: 0,
    defense: 0,
    possession: 0,
    playstyle: 0,
    discipline: 0,
    overall: 0,
  };
}

function statValue(event: StatEvent) {
  const numeric = Number(event.statValue);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
}

function validateStatInput(valueType: StatValueType, value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (valueType === "integer" && !Number.isInteger(Number(trimmed))) {
    return "Enter a whole number for this integer stat, or leave it blank to record 1.";
  }

  if (valueType === "decimal" && !Number.isFinite(Number(trimmed))) {
    return "Enter a valid decimal number for this stat.";
  }

  if (valueType === "boolean" && !["true", "false", "yes", "no"].includes(trimmed.toLowerCase())) {
    return "Enter true/false or yes/no for this boolean stat.";
  }

  if (valueType === "time" && parseClockToSeconds(trimmed) === undefined) {
    return "Enter time values as minutes:seconds, for example 12:34.";
  }

  return undefined;
}

function addToTotals(totals: StatTotals, code: string, value: number) {
  totals[code] = (totals[code] ?? 0) + value;
}

function totalPossession(segments: PossessionSegment[]) {
  return segments.reduce<Record<PossessionOwner, number>>(
    (totals, segment) => {
      totals[segment.owner] += segment.endSeconds - segment.startSeconds;
      return totals;
    },
    { home: 0, away: 0, contested: 0, out: 0 },
  );
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculateRatings(
  stats: StatTotals,
  context?: {
    goalsAgainst?: number;
    possessionShare?: number;
    playStyleCount?: number;
    playStyleDiversity?: number;
  },
) {
  const goals = stats.G ?? 0;
  const assists = stats.A ?? 0;
  const shots = stats.Sh ?? 0;
  const shotsOnTarget = stats.SoT ?? 0;
  const opportunities = stats.Op ?? 0;
  const keyPasses = stats.KP ?? 0;
  const shotAssists = stats.ShA ?? 0;
  const preAssists = stats.PreA ?? 0;
  const progressivePasses = stats.ProgP ?? 0;
  const progressiveCarries = stats.ProgC ?? 0;
  const successfulDribbles = stats.DrbS ?? 0;
  const offensiveDuelsWon = stats.ODw ?? 0;
  const touchesInGoalArea = stats.TGA ?? 0;
  const penaltyGoals = stats.PKG ?? 0;
  const directFreeKicks = stats.DFK ?? 0;
  const corners = stats.CK ?? 0;
  const saves = stats.Sv ?? 0;
  const stops = stats.St ?? 0;
  const interceptions = stats.Int ?? 0;
  const shotBlocks = stats.Blk ?? 0;
  const defensiveDuelsWon = stats.DDw ?? 0;
  const twoOnOnesForced = stats["2o1F"] ?? 0;
  const wonPossession = stats.Wp ?? 0;
  const touches = stats.Tch ?? 0;
  const passesAttempted = stats.Pas ?? 0;
  const passesCompleted = stats.Pc ?? 0;
  const forwardPasses = stats.FwdP ?? 0;
  const backwardPasses = stats.BwdP ?? 0;
  const passesReceived = stats.Rec ?? 0;
  const misplacedPasses = stats.Mp ?? 0;
  const dribbleAttempts = stats.DrbA ?? 0;
  const duelsLost = stats.DuL ?? 0;
  const freeKicksWon = stats.FKW ?? 0;
  const indirectFreeKicks = stats.IFK ?? 0;
  const kickIns = stats.KI ?? 0;
  const goalKicks = stats.GK ?? 0;
  const positiveTransitions = stats["+"] ?? 0;
  const negativeTransitions = stats["-"] ?? 0;
  const lostPossession = stats.Lp ?? 0;
  const wastedOpportunities = stats.Wo ?? 0;
  const errors = stats.Er ?? 0;
  const fouls = stats.Fl ?? 0;
  const yellowCards = stats.YC ?? 0;
  const redCards = stats.RC ?? 0;
  const twoOnOnesCommitted = stats["2o1C"] ?? 0;
  const goalAreaPositioning = stats.GAP ?? 0;
  const dogso = stats.DOGSO ?? 0;
  const twoOnOnes = stats["2o1"] ?? stats["2on1"] ?? 0;
  const goalsAgainst = context?.goalsAgainst ?? 0;
  const possessionShare = context?.possessionShare ?? 0;
  const playStyleCount = context?.playStyleCount ?? 0;
  const playStyleDiversity = context?.playStyleDiversity ?? 0;

  const attack = clampScore(
    45 +
      goals * 10 +
      penaltyGoals * 5 +
      assists * 4 +
      shots * 1.5 +
      shotsOnTarget * 3 +
      opportunities * 3 +
      keyPasses * 3 +
      shotAssists * 2 +
      preAssists * 1.5 +
      progressivePasses * 1.5 +
      progressiveCarries * 2 +
      successfulDribbles * 2 +
      offensiveDuelsWon * 1.5 +
      touchesInGoalArea * 1.5 +
      directFreeKicks +
      corners * 0.75 +
      positiveTransitions -
      wastedOpportunities * 3,
  );
  const defense = clampScore(
    45 +
      saves * 5 +
      stops * 4 +
      interceptions * 3 +
      shotBlocks * 3 +
      defensiveDuelsWon * 2 +
      twoOnOnesForced * 2 +
      wonPossession * 2 -
      errors * 6 -
      goalsAgainst * 8 -
      goalAreaPositioning * 3,
  );
  const possession = clampScore(
    45 +
      possessionShare * 25 +
      wonPossession * 3 +
      passesCompleted * 0.8 +
      passesReceived * 0.6 +
      touches * 0.3 +
      forwardPasses * 0.8 +
      backwardPasses * 0.25 +
      progressivePasses +
      progressiveCarries +
      successfulDribbles * 1.5 +
      freeKicksWon +
      indirectFreeKicks * 0.4 +
      kickIns * 0.25 +
      goalKicks * 0.25 +
      positiveTransitions * 2 -
      misplacedPasses * 1.5 -
      Math.max(0, dribbleAttempts - successfulDribbles) * 1.5 -
      duelsLost * 1.5 -
      lostPossession * 3 -
      negativeTransitions * 3,
  );
  const playstyle = clampScore(
    45 +
      Math.min(playStyleDiversity, 6) * 5 +
      Math.min(playStyleCount, 12) * 1.5 +
      opportunities * 2 +
      keyPasses * 2 +
      progressivePasses * 1.5 +
      progressiveCarries * 1.5 +
      forwardPasses * 0.6 +
      passesAttempted * 0.2 +
      successfulDribbles +
      positiveTransitions * 2 +
      wonPossession -
      wastedOpportunities * 2 -
      negativeTransitions * 2,
  );
  const discipline = clampScore(
    80 -
      fouls * 5 -
      yellowCards * 8 -
      redCards * 18 -
      dogso * 12 -
      goalAreaPositioning * 5 -
      twoOnOnes * 3 -
      twoOnOnesCommitted * 5,
  );

  return {
    attack,
    defense,
    possession,
    playstyle,
    discipline,
    overall: clampScore(attack * 0.28 + defense * 0.26 + possession * 0.22 + playstyle * 0.14 + discipline * 0.1),
  };
}

function buildGameSnapshot(match: MatchState) {
  const id = createEventId();
  const teamStats: Record<TeamSide, StatTotals> = { home: {}, away: {} };
  const teamPlayStyles: Record<TeamSide, StatTotals> = { home: {}, away: {} };
  const playerStats = new Map<
    string,
    {
      playerId: string;
      playerName: string;
      team: TeamSide;
      teamName: string;
      division: string;
      role?: string;
      stats: StatTotals;
    }
  >();

  for (const event of match.events) {
    if (event.kind === "play" && event.playName) {
      addToTotals(teamPlayStyles[event.team], `${event.playType ?? "play"}: ${event.playName}`, 1);
      continue;
    }

    if (event.kind !== "stat" || !event.statCode) {
      continue;
    }

    const value = statValue(event);
    addToTotals(teamStats[event.team], event.statCode, value);

    if (event.playerName) {
      const playerId = normalizeId(event.playerName);
      const existing =
        playerStats.get(playerId) ??
        {
          playerId,
          playerName: event.playerName,
          team: event.team,
          teamName: event.team === "home" ? match.homeTeam : match.awayTeam,
          division: event.team === "home" ? match.homeDivision : match.awayDivision,
          role: event.playerRole,
          stats: {},
        };
      addToTotals(existing.stats, event.statCode, value);
      playerStats.set(playerId, existing);
    }
  }

  const possession = totalPossession(match.possessionSegments);
  const homeScore = teamStats.home.G ?? 0;
  const awayScore = teamStats.away.G ?? 0;
  const playerRows = Array.from(playerStats.values()).map((player) => ({
    ...player,
    ratings: calculateRatings(player.stats),
  }));

  return {
    id,
    date: match.gameDate,
    videoUrl: match.video.videoUrl,
    finishedAt: new Date().toISOString(),
    location: match.gameLocation,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeDivision: match.homeDivision,
    awayDivision: match.awayDivision,
    homeScore,
    awayScore,
    teamStats,
    teamPlayStyles,
    playerStats: playerRows,
    possession,
    possessionSegments: match.possessionSegments,
    events: match.events,
    eventCount: match.events.length,
  };
}

function mergeStats(base: StatTotals, addition: StatTotals) {
  const merged = { ...base };
  for (const [code, value] of Object.entries(addition)) {
    merged[code] = (merged[code] ?? 0) + value;
  }
  return merged;
}

function mergeKnowledgeBase(knowledgeBase: KnowledgeBase, game: GameSnapshot) {
  const games = [game, ...knowledgeBase.games.filter((existing) => existing.id !== game.id)];

  const teamsById = new Map(
    knowledgeBase.teams.map((team) => [
      team.id,
      {
        ...team,
        stats: { ...team.stats },
        playStyles: { ...(team.playStyles ?? {}) },
        gameIds: [...team.gameIds],
      },
    ]),
  );
  (["home", "away"] as TeamSide[]).forEach((side) => {
    const opponent = side === "home" ? "away" : "home";
    const name = side === "home" ? game.homeTeam : game.awayTeam;
    const division = side === "home" ? game.homeDivision : game.awayDivision;
    const goalsFor = side === "home" ? game.homeScore : game.awayScore;
    const goalsAgainst = side === "home" ? game.awayScore : game.homeScore;
    const id = `${normalizeId(name)}-${normalizeId(division)}`;
    const previous =
      teamsById.get(id) ??
      {
        id,
        name,
        division,
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        possessionSeconds: 0,
        contestedSeconds: 0,
        outOfPlaySeconds: 0,
        stats: {},
        playStyles: {},
        ratings: emptyRatings(),
        gameIds: [],
        updatedAt: game.finishedAt,
      };
    const gamesPlayed = previous.gamesPlayed + 1;
    const possessionSeconds = previous.possessionSeconds + game.possession[side];
    const contestedSeconds = previous.contestedSeconds + game.possession.contested;
    const outOfPlaySeconds = (previous.outOfPlaySeconds ?? 0) + game.possession.out;
    const possessionTotal = possessionSeconds + contestedSeconds + game.possession[opponent];
    const stats = mergeStats(previous.stats, game.teamStats[side]);
    const playStyles = mergeStats(previous.playStyles ?? {}, game.teamPlayStyles[side] ?? {});
    const playStyleCount = Object.values(playStyles).reduce((sum, value) => sum + value, 0);
    const playStyleDiversity = Object.values(playStyles).filter((value) => value > 0).length;
    const wins = previous.wins + (goalsFor > goalsAgainst ? 1 : 0);
    const losses = previous.losses + (goalsFor < goalsAgainst ? 1 : 0);
    const ties = previous.ties + (goalsFor === goalsAgainst ? 1 : 0);

    teamsById.set(id, {
      ...previous,
      name,
      division,
      gamesPlayed,
      wins,
      losses,
      ties,
      goalsFor: previous.goalsFor + goalsFor,
      goalsAgainst: previous.goalsAgainst + goalsAgainst,
      possessionSeconds,
      contestedSeconds,
      outOfPlaySeconds,
      stats,
      playStyles,
      ratings: calculateRatings(stats, {
        goalsAgainst: previous.goalsAgainst + goalsAgainst,
        possessionShare: possessionTotal > 0 ? possessionSeconds / possessionTotal : 0,
        playStyleCount,
        playStyleDiversity,
      }),
      gameIds: Array.from(new Set([game.id, ...previous.gameIds])),
      updatedAt: game.finishedAt,
    });
  });

  const playersById = new Map(
    knowledgeBase.players.map((player) => [
      player.id,
      {
        ...player,
        stats: { ...player.stats },
        gameIds: [...player.gameIds],
        teamNames: [...player.teamNames],
        divisions: [...player.divisions],
      },
    ]),
  );
  for (const player of game.playerStats) {
    const previous =
      playersById.get(player.playerId) ??
      {
        id: player.playerId,
        name: player.playerName,
        teamNames: [],
        divisions: [],
        gamesPlayed: 0,
        stats: {},
        ratings: emptyRatings(),
        gameIds: [],
        updatedAt: game.finishedAt,
      };
    const stats = mergeStats(previous.stats, player.stats);
    playersById.set(player.playerId, {
      ...previous,
      name: player.playerName,
      teamNames: Array.from(new Set([player.teamName, ...previous.teamNames])),
      divisions: Array.from(new Set([player.division, ...previous.divisions])),
      gamesPlayed: previous.gamesPlayed + 1,
      stats,
      ratings: calculateRatings(stats),
      gameIds: Array.from(new Set([game.id, ...previous.gameIds])),
      updatedAt: game.finishedAt,
    });
  }

  return {
    games,
    teams: Array.from(teamsById.values()).sort((a, b) => b.ratings.overall - a.ratings.overall),
    players: Array.from(playersById.values()).sort((a, b) => b.ratings.overall - a.ratings.overall),
  };
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function distributeGoals(totalGoals: number) {
  const homeScore = randomInt(0, totalGoals);
  return {
    home: homeScore,
    away: totalGoals - homeScore,
  };
}

function createPossessionSegments(homeSeconds: number, awaySeconds: number, contestedSeconds: number, outSeconds: number) {
  const owners: Array<{ owner: PossessionOwner; remaining: number }> = [
    { owner: "home", remaining: homeSeconds },
    { owner: "out", remaining: outSeconds },
    { owner: "away", remaining: awaySeconds },
    { owner: "contested", remaining: contestedSeconds },
  ];
  const segments: PossessionSegment[] = [];
  let cursor = 0;
  let index = 0;

  while (owners.some((entry) => entry.remaining > 0)) {
    const entry = owners[index % owners.length];
    if (entry.remaining > 0) {
      const duration = Math.min(entry.remaining, randomInt(20, 95));
      segments.push({
        id: createEventId(),
        owner: entry.owner,
        participantPlayerIds: [],
        participantPlayerNames: [],
        startSeconds: cursor,
        endSeconds: cursor + duration,
      });
      cursor += duration;
      entry.remaining -= duration;
    }
    index += 1;
  }

  return segments;
}

function createFakeGameSnapshot(index: number, homeTeam: string, awayTeam: string, location: string): GameSnapshot {
  const totalGoals = randomInt(3, 10);
  const score = distributeGoals(totalGoals);
  const homePossession = randomInt(360, 720);
  const awayPossession = randomInt(360, 720);
  const contested = randomInt(430, 520);
  const out = Math.max(0, 2400 - homePossession - awayPossession - contested);
  const homeStats: StatTotals = {
    G: score.home,
    Sh: score.home + randomInt(3, 8),
    SoT: score.home + randomInt(1, 5),
    Pc: randomInt(18, 45),
    Pas: randomInt(28, 60),
    ProgP: randomInt(3, 12),
    ProgC: randomInt(2, 10),
    Wp: randomInt(4, 14),
    Lp: randomInt(3, 12),
  };
  const awayStats: StatTotals = {
    G: score.away,
    Sh: score.away + randomInt(3, 8),
    SoT: score.away + randomInt(1, 5),
    Pc: randomInt(18, 45),
    Pas: randomInt(28, 60),
    ProgP: randomInt(3, 12),
    ProgC: randomInt(2, 10),
    Wp: randomInt(4, 14),
    Lp: randomInt(3, 12),
  };
  const date = new Date(Date.now() - index * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const events: StatEvent[] = [];
  const makeEvent = (team: TeamSide, statCode: string, statLabel: string, playerName: string, videoSeconds: number): StatEvent => ({
    id: createEventId(),
    kind: "stat",
    team,
    playerId: normalizeId(playerName),
    playerName,
    playerRole: statCode === "G" ? "2 - Center" : "3 - Near Wing",
    statCode,
    statLabel,
    statValueType: "integer",
    statValue: "1",
    bucket: bucketFromMatchSeconds(videoSeconds),
    minute: formatClock(videoSeconds),
    matchSeconds: videoSeconds,
    videoSeconds,
    note: "Seeded sample game event",
    recordedAt: new Date().toISOString(),
  });

  for (let i = 0; i < score.home; i += 1) {
    events.push(makeEvent("home", "G", "Goal", i % 2 ? "Stan" : "Ryan", randomInt(120, 2300)));
  }
  for (let i = 0; i < score.away; i += 1) {
    events.push(makeEvent("away", "G", "Goal", i % 2 ? "Jairo" : "Lola", randomInt(120, 2300)));
  }
  events.push(makeEvent("home", "Pc", "Pass Completed", "Stan", randomInt(120, 2300)));
  events.push(makeEvent("away", "Wp", "Won Possession", "Matt", randomInt(120, 2300)));

  const possessionSegments = createPossessionSegments(homePossession, awayPossession, contested, out);
  return {
    id: createEventId(),
    date,
    videoUrl: DEFAULT_VIDEO_SYNC.videoUrl,
    finishedAt: new Date().toISOString(),
    location,
    homeTeam,
    awayTeam,
    homeDivision: "104",
    awayDivision: "104",
    homeScore: score.home,
    awayScore: score.away,
    teamStats: { home: homeStats, away: awayStats },
    teamPlayStyles: {
      home: { "offense: Goal kick - Stack": randomInt(1, 4), "offense: Side kick mid - Tap-in": randomInt(1, 3) },
      away: { "offense: Goal kick - Basic": randomInt(1, 4), "defense: Side kick mid - Funnel": randomInt(1, 3) },
    },
    playerStats: [
      {
        playerId: "stan",
        playerName: "Stan",
        team: "home" as TeamSide,
        teamName: homeTeam,
        division: "104",
        role: "2 - Center",
        stats: { G: Math.max(0, Math.floor(score.home / 2)), Pas: randomInt(8, 22), Pc: randomInt(6, 18) },
        ratings: emptyRatings(),
      },
      {
        playerId: "jairo",
        playerName: "Jairo",
        team: "away" as TeamSide,
        teamName: awayTeam,
        division: "104",
        role: "2 - Center",
        stats: { G: Math.max(0, Math.floor(score.away / 2)), Pas: randomInt(8, 22), Pc: randomInt(6, 18) },
        ratings: emptyRatings(),
      },
    ].map((player) => ({ ...player, ratings: calculateRatings(player.stats) })),
    possession: { home: homePossession, away: awayPossession, contested, out },
    possessionSegments,
    events,
    eventCount: events.length,
  };
}

function createSeedKnowledgeBase() {
  const games = [
    createFakeGameSnapshot(1, "Ducks", "Steamrollers", "Madison Community Center"),
    createFakeGameSnapshot(2, "Ducks", "Lightning", "Riverside Fieldhouse"),
    createFakeGameSnapshot(3, "Steamrollers", "Ducks", "North Gym"),
    createFakeGameSnapshot(4, "Ducks", "Strikers", "Central Rec Center"),
  ];

  return games.reduce((knowledgeBase, game) => mergeKnowledgeBase(knowledgeBase, game), emptyKnowledgeBase);
}

function trimPossessionSegmentsAfter(segments: PossessionSegment[], seconds: number) {
  return segments
    .flatMap((segment) => {
      if (segment.startSeconds >= seconds) {
        return [];
      }

      if (segment.endSeconds > seconds) {
        return [{ ...segment, endSeconds: seconds }];
      }

      return [segment];
    })
    .filter((segment) => segment.endSeconds > segment.startSeconds);
}

function mergePossessionInterval(
  segments: PossessionSegment[],
  startSeconds: number,
  endSeconds: number,
  owner: PossessionOwner,
  participants: { ids: string[]; names: string[] },
) {
  const start = Math.max(0, Math.min(startSeconds, endSeconds));
  const end = Math.max(startSeconds, endSeconds);
  if (end - start < 0.05) {
    return segments;
  }

  const nextSegments: PossessionSegment[] = [];
  for (const segment of segments) {
    if (segment.endSeconds <= start || segment.startSeconds >= end) {
      nextSegments.push(segment);
      continue;
    }

    if (segment.startSeconds < start) {
      nextSegments.push({ ...segment, endSeconds: start });
    }

    if (segment.endSeconds > end) {
      nextSegments.push({ ...segment, startSeconds: end });
    }
  }

  nextSegments.push({
    id: createEventId(),
    owner,
    participantPlayerIds: participants.ids,
    participantPlayerNames: participants.names,
    startSeconds: start,
    endSeconds: end,
  });

  return nextSegments
    .filter((segment) => segment.endSeconds - segment.startSeconds >= 0.05)
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .reduce<PossessionSegment[]>((merged, segment) => {
      const previous = merged.at(-1);
      const sameParticipants =
        previous?.participantPlayerIds.join("|") === segment.participantPlayerIds.join("|");
      if (
        previous &&
        previous.owner === segment.owner &&
        sameParticipants &&
        segment.startSeconds - previous.endSeconds <= 0.1
      ) {
        previous.endSeconds = Math.max(previous.endSeconds, segment.endSeconds);
        return merged;
      }

      merged.push({ ...segment });
      return merged;
    }, []);
}

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
    const players = normalizePlayers(parsed.players);
    return {
      ...initialState,
      ...parsed,
      video: {
        ...initialState.video,
        ...(parsed.video ?? {}),
      },
      gameDate: parsed.gameDate ?? initialState.gameDate,
      gameLocation: parsed.gameLocation ?? initialState.gameLocation,
      homeDivision: parsed.homeDivision ?? initialState.homeDivision,
      awayDivision: parsed.awayDivision ?? initialState.awayDivision,
      nextStatValue: parsed.nextStatValue ?? "",
      statDefinitions: normalizeStats(parsed.statDefinitions),
      plays: normalizePlays(parsed.plays),
      activePossession: parsed.activePossession ?? "unset",
      possessionSelection: normalizePossessionSelection(parsed.possessionSelection, players),
      possessionSegments: normalizePossessionSegments(parsed.possessionSegments),
      knowledgeBase: normalizeKnowledgeBase(parsed.knowledgeBase),
      players,
      events: parsed.events ?? [],
    };
  } catch {
    return initialState;
  }
}

function App() {
  const [match, setMatch] = useState<MatchState>(() => readStoredState());
  const [role, setRole] = useState<UserRole | null>(null);
  const [page, setPage] = useState<AppPage>("tracker");
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [selectedSetPiece, setSelectedSetPiece] = useState(SET_PIECES[0].code);
  const [setPieceTeam, setSetPieceTeam] = useState<TeamSide>("home");
  const [setPieceRating, setSetPieceRating] = useState(3);
  const [startingPossessionTeam, setStartingPossessionTeam] = useState<TeamSide>("home");
  const [substitutionTeam, setSubstitutionTeam] = useState<TeamSide>("home");
  const [subOutPlayerId, setSubOutPlayerId] = useState("");
  const [subInPlayerId, setSubInPlayerId] = useState("");
  const [playTeam, setPlayTeam] = useState<TeamSide>("home");
  const [playType, setPlayType] = useState<PlayType>("offense");
  const [selectedPlayId, setSelectedPlayId] = useState(DEFAULT_PLAYS[0].id);
  const [eventForm, setEventForm] = useState<StructuredEventForm>(() => defaultStructuredEventForm());
  const [showVideoSyncDetails, setShowVideoSyncDetails] = useState(true);
  const [showMatchSetupDetails, setShowMatchSetupDetails] = useState(false);
  const [showPlayTagging, setShowPlayTagging] = useState(false);
  const [showAdvancedTags, setShowAdvancedTags] = useState(false);
  const [currentVideoSeconds, setCurrentVideoSeconds] = useState(0);
  const [currentVideoDuration, setCurrentVideoDuration] = useState(0);
  const [eventRequiredAfterPause, setEventRequiredAfterPause] = useState(false);
  const previousPossessionVideoSeconds = useRef(0);

  const onVideoTimeChange = useCallback((seconds: number) => {
    setCurrentVideoSeconds(seconds);
  }, []);

  const onVideoDurationChange = useCallback((seconds: number) => {
    setCurrentVideoDuration(seconds);
  }, []);

  const derivedVideoTime = useMemo(
    () => deriveMatchTime(match.video, currentVideoSeconds),
    [currentVideoSeconds, match.video],
  );
  const firstHalfStarted = match.video.firstHalfStartVideoSeconds !== undefined;
  const videoSyncComplete =
    match.video.firstHalfStartVideoSeconds !== undefined &&
    match.video.firstHalfEndVideoSeconds !== undefined &&
    match.video.secondHalfStartVideoSeconds !== undefined &&
    match.video.secondHalfEndVideoSeconds !== undefined;

  const notify = useCallback((tone: NoticeTone, title: string, message: string) => {
    const id = createEventId();
    setNotices((current) => [{ id, tone, title, message }, ...current].slice(0, 5));
  }, []);

  const dismissNotice = (noticeId: string) => {
    setNotices((current) => current.filter((notice) => notice.id !== noticeId));
  };

  const setupWarnings = useMemo(() => {
    const warnings: AppNotice[] = [];
    if (match.homeTeam.trim() && match.awayTeam.trim() && match.homeTeam.trim() === match.awayTeam.trim()) {
      warnings.push({
        id: "same-team-warning",
        tone: "warning",
        title: "Home and away match",
        message: "Home and away teams have the same name. Confirm this is intentional before finishing the game.",
      });
    }
    if (!match.gameDate) {
      warnings.push({
        id: "missing-date-warning",
        tone: "warning",
        title: "Missing game date",
        message: "Add a game date so finished ratings are easy to find in the knowledge base.",
      });
    }
    if (!match.gameLocation.trim()) {
      warnings.push({
        id: "missing-location-warning",
        tone: "warning",
        title: "Missing location",
        message: "Add where the game is being played before starting or finishing the rating.",
      });
    }
    if (!match.homeDivision.trim() || !match.awayDivision.trim()) {
      warnings.push({
        id: "missing-division-warning",
        tone: "warning",
        title: "Missing division",
        message: "Add both team divisions before finishing the game.",
      });
    }
    if (
      match.activePossession === "contested" &&
      match.possessionSelection.contestedPlayerOneId &&
      match.possessionSelection.contestedPlayerOneId === match.possessionSelection.contestedPlayerTwoId
    ) {
      warnings.push({
        id: "duplicate-contested-player-warning",
        tone: "error",
        title: "Invalid contested possession",
        message: "Select two different players for contested possession.",
      });
    }
    return warnings;
  }, [
    match.activePossession,
    match.awayDivision,
    match.awayTeam,
    match.gameDate,
    match.gameLocation,
    match.homeDivision,
    match.homeTeam,
    match.possessionSelection.contestedPlayerOneId,
    match.possessionSelection.contestedPlayerTwoId,
  ]);

  const activePossessionParticipants = useMemo(
    () => resolvePossessionParticipants(match.activePossession, match.possessionSelection, match.players),
    [match.activePossession, match.players, match.possessionSelection],
  );

  const isCalibrationPlaybackAllowed =
    match.video.firstHalfStartVideoSeconds === undefined ||
    (match.video.firstHalfEndVideoSeconds !== undefined && match.video.secondHalfStartVideoSeconds === undefined);

  const playbackBlockReason = useMemo(() => {
    if (isCalibrationPlaybackAllowed) {
      return "";
    }
    if (eventRequiredAfterPause) {
      return "Log at least one stat, play, set-piece, or note event before resuming after a pause.";
    }
    if (match.activePossession === "unset") {
      return "Select home possession, away possession, contested possession, or out of play before playing.";
    }
    if (!activePossessionParticipants) {
      return match.activePossession === "contested"
        ? "Select one home player and one away player for contested possession before playing."
        : "Select the player in possession before playing.";
    }
    return "";
  }, [activePossessionParticipants, eventRequiredAfterPause, isCalibrationPlaybackAllowed, match.activePossession]);

  const canPlayVideo = playbackBlockReason === "";

  const topPlaybackMessage = isCalibrationPlaybackAllowed
    ? match.video.firstHalfStartVideoSeconds === undefined
      ? "Calibration mode: video can play freely until you mark where the first half begins."
      : "Halftime calibration mode: video can play freely until you mark where the second half starts."
    : canPlayVideo
      ? "Ready to play: current time-tracking state is complete."
      : `Required before video can play: ${playbackBlockReason}`;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
  }, [match]);

  const activeStats = useMemo(
    () => match.statDefinitions.filter((stat) => stat.active),
    [match.statDefinitions],
  );

  const activePlays = useMemo(
    () => match.plays.filter((play) => play.active && play.type === playType),
    [match.plays, playType],
  );

  useEffect(() => {
    if (activePlays.length && !activePlays.some((play) => play.id === selectedPlayId)) {
      setSelectedPlayId(activePlays[0].id);
    }
  }, [activePlays, selectedPlayId]);

  useEffect(() => {
    const previousSeconds = previousPossessionVideoSeconds.current;
    previousPossessionVideoSeconds.current = currentVideoSeconds;

    const delta = currentVideoSeconds - previousSeconds;
    if (delta <= 0.05 || delta > 2.5) {
      return;
    }

    setMatch((current) => ({
      ...current,
      possessionSegments: (() => {
        if (current.activePossession === "unset") {
          return current.possessionSegments;
        }
        const participants = resolvePossessionParticipants(
          current.activePossession,
          current.possessionSelection,
          current.players,
        );
        if (!participants) {
          return current.possessionSegments;
        }
        return mergePossessionInterval(
          current.possessionSegments,
          previousSeconds,
          currentVideoSeconds,
          current.activePossession,
          participants,
        );
      })(),
    }));
  }, [currentVideoSeconds]);

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

  const addSubstitute = (team: TeamSide) => {
    const id = `${team}-sub-${createEventId()}`;
    setMatch((current) => ({
      ...current,
      players: [
        ...current.players,
        {
          id,
          team,
          name: `${team === "home" ? current.homeTeam : current.awayTeam} Sub`,
          role: "Substitute",
          active: false,
        },
      ],
    }));
  };

  const updateStatDefinition = (statId: string, patch: Partial<StatDefinition>) => {
    setMatch((current) => ({
      ...current,
      statDefinitions: current.statDefinitions.map((stat) =>
        stat.id === statId ? { ...stat, ...patch } : stat,
      ),
    }));
  };

  const addStatDefinition = () => {
    const id = createEventId();
    setMatch((current) => ({
      ...current,
      statDefinitions: [
        ...current.statDefinitions,
        {
          id,
          code: "New",
          label: "New stat",
          detail: "Describe this stat.",
          valueType: "integer",
          tone: "possession",
          active: true,
        },
      ],
    }));
  };

  const removeStatDefinition = (statId: string) => {
    setMatch((current) => ({
      ...current,
      statDefinitions: current.statDefinitions.filter((stat) => stat.id !== statId),
    }));
  };

  const updatePlayDefinition = (playId: string, patch: Partial<PlayDefinition>) => {
    setMatch((current) => ({
      ...current,
      plays: current.plays.map((play) => (play.id === playId ? { ...play, ...patch } : play)),
    }));
  };

  const addPlayDefinition = (type: PlayType) => {
    const id = createEventId();
    setMatch((current) => ({
      ...current,
      plays: [
        ...current.plays,
        {
          id,
          name: type === "offense" ? "New offensive play" : "New defensive play",
          type,
          artUrl: "",
          active: true,
        },
      ],
    }));
    setPlayType(type);
    setSelectedPlayId(id);
  };

  const removePlayDefinition = (playId: string) => {
    setMatch((current) => ({
      ...current,
      plays: current.plays.filter((play) => play.id !== playId),
    }));
  };

  const addEvent = (event: Omit<StatEvent, "id" | "bucket" | "minute" | "note" | "recordedAt">) => {
    setEventRequiredAfterPause(false);
    setMatch((current) => ({
      ...current,
      note: "",
      nextStatValue: "",
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

  const buildRecordedEvent = (
    current: MatchState,
    event: Omit<StatEvent, "id" | "bucket" | "minute" | "note" | "recordedAt">,
    noteOverride?: string,
  ): StatEvent => ({
    ...event,
    id: createEventId(),
    half: derivedVideoTime.half,
    matchSeconds: derivedVideoTime.matchSeconds,
    videoUrl: current.video.videoUrl,
    videoId: current.video.videoId,
    videoSeconds: currentVideoSeconds,
    bucket: current.video.syncEnabled ? derivedVideoTime.bucket : current.activeBucket,
    minute: current.video.syncEnabled ? derivedVideoTime.minute : current.minute,
    note: noteOverride ?? current.note,
    recordedAt: new Date().toISOString(),
  });

  const addStructuredEvents = (
    events: Array<Omit<StatEvent, "id" | "bucket" | "minute" | "note" | "recordedAt">>,
    noteOverride?: string,
  ) => {
    setEventRequiredAfterPause(false);
    setMatch((current) => ({
      ...current,
      note: "",
      nextStatValue: "",
      events: [
        ...events.map((event) => buildRecordedEvent(current, event, noteOverride)),
        ...current.events,
      ],
    }));
  };

  const statPayloadForPlayer = (
    player: PlayerSlot,
    statCode: string,
  ): Omit<StatEvent, "id" | "bucket" | "minute" | "note" | "recordedAt"> | undefined => {
    const stat = match.statDefinitions.find((definition) => definition.code === statCode);
    if (!stat) {
      notify("error", "Unknown stat", `Could not find a stat definition for ${statCode}.`);
      return undefined;
    }

    return {
      kind: "stat",
      team: player.team,
      playerId: player.id,
      playerName: player.name,
      playerRole: player.role,
      statCode: stat.code,
      statLabel: stat.label,
      statValueType: stat.valueType,
      statValue: stat.valueType === "integer" ? "1" : "",
    };
  };

  const addStatEvent = (player: PlayerSlot, statCode: string) => {
    const stat = match.statDefinitions.find((definition) => definition.code === statCode);
    if (!stat) {
      notify("error", "Unknown stat", `Could not find a stat definition for ${statCode}.`);
      return;
    }

    const validationMessage = validateStatInput(stat.valueType, match.nextStatValue);
    if (validationMessage) {
      notify("error", "Invalid stat value", validationMessage);
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
      statValueType: stat.valueType,
      statValue: match.nextStatValue || (stat.valueType === "integer" ? "1" : ""),
    });
  };

  const addSetPieceEvent = () => {
    const setPiece = SET_PIECES.find((piece) => piece.code === selectedSetPiece);
    if (!setPiece) {
      notify("error", "Unknown set piece", "Choose a valid set-piece type before adding the event.");
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

  const addPlayEvent = () => {
    const play = match.plays.find((candidate) => candidate.id === selectedPlayId);
    if (!play) {
      notify("error", "No play selected", "Choose an active play before tagging it.");
      return;
    }

    addEvent({
      kind: "play",
      team: playTeam,
      playId: play.id,
      playName: play.name,
      playType: play.type,
      playArtUrl: play.artUrl,
    });
  };

  const addSubstitutionEvent = () => {
    if (match.activePossession !== "out") {
      notify("error", "Substitution unavailable", "Substitutions can only be tagged when the ball is out of play.");
      return;
    }
    const outPlayer = match.players.find((player) => player.id === subOutPlayerId && player.team === substitutionTeam);
    const inPlayer = match.players.find((player) => player.id === subInPlayerId && player.team === substitutionTeam);
    if (!outPlayer || !inPlayer) {
      notify("error", "Incomplete substitution", "Choose both the player leaving and the substitute entering.");
      return;
    }
    if (outPlayer.id === inPlayer.id) {
      notify("error", "Invalid substitution", "Choose two different players for the substitution.");
      return;
    }

    setMatch((current) => ({
      ...current,
      players: current.players.map((player) => {
        if (player.id === outPlayer.id) return { ...player, active: false };
        if (player.id === inPlayer.id) return { ...player, active: true };
        return player;
      }),
    }));

    addEvent({
      kind: "substitution",
      team: substitutionTeam,
      substitutionOutPlayerId: outPlayer.id,
      substitutionOutPlayerName: outPlayer.name,
      substitutionInPlayerId: inPlayer.id,
      substitutionInPlayerName: inPlayer.name,
    });
    setSubOutPlayerId("");
    setSubInPlayerId("");
    notify("success", "Substitution recorded", `${inPlayer.name} entered for ${outPlayer.name}.`);
  };

  const submitStructuredEvent = () => {
    if (!eventForm.type) {
      notify("error", "Choose event type", "Select what happened before recording the event.");
      return;
    }
    const primary = match.players.find((player) => player.id === eventForm.primaryPlayerId);
    const secondary = match.players.find((player) => player.id === eventForm.secondaryPlayerId);
    const opponent = match.players.find((player) => player.id === eventForm.opponentPlayerId);
    const sourceSetPiece = SET_PIECES.find((piece) => piece.code === eventForm.sourceSetPieceCode);
    const events: Array<Omit<StatEvent, "id" | "bucket" | "minute" | "note" | "recordedAt">> = [];
    const addStat = (player: PlayerSlot | undefined, statCode: string) => {
      if (!player) {
        return;
      }
      const payload = statPayloadForPlayer(player, statCode);
      if (payload) {
        events.push(payload);
      }
    };

    if (eventForm.type !== "note" && !primary) {
      notify("error", "Missing event player", "Select the primary player involved in the event.");
      return;
    }

    if (eventForm.type === "completed-pass") {
      if (!secondary) {
        notify("error", "Missing receiver", "Select the player who received the completed pass.");
        return;
      }
      addStat(primary, "Pas");
      if (eventForm.direction === "left") addStat(primary, "Lft");
      if (eventForm.direction === "right") addStat(primary, "Rgt");
      addStat(primary, "Pc");
      addStat(secondary, "Rec");
      if (eventForm.outcome === "key-pass") addStat(primary, "KP");
      if (eventForm.outcome === "shot-assist") addStat(primary, "ShA");
      if (eventForm.outcome === "assist") addStat(primary, "A");
    }

    if (eventForm.type === "failed-pass") {
      addStat(primary, "Pas");
      addStat(primary, "Mp");
      if (eventForm.direction === "left") addStat(primary, "Lft");
      if (eventForm.direction === "right") addStat(primary, "Rgt");
      if (eventForm.outcome === "turnover") {
        addStat(primary, "Lp");
        addStat(primary, "-");
      }
    }

    if (eventForm.type === "dribble") {
      addStat(primary, "DrbA");
      if (eventForm.direction === "left") addStat(primary, "Lft");
      if (eventForm.direction === "right") addStat(primary, "Rgt");
      if (["successful", "progressive"].includes(eventForm.outcome)) addStat(primary, "DrbS");
      if (eventForm.outcome === "progressive") addStat(primary, "ProgC");
      if (eventForm.outcome === "turnover" || eventForm.outcome === "unsuccessful") {
        addStat(primary, "Lp");
        addStat(primary, "-");
      }
      if (eventForm.outcome === "foul-suffered") addStat(primary, "FS");
    }

    if (eventForm.type === "shot") {
      if (["saved", "blocked"].includes(eventForm.outcome) && !opponent) {
        notify("error", "Missing defender", "Select the opponent who saved or blocked the shot.");
        return;
      }
      addStat(primary, "Sh");
      if (["on-target", "goal", "saved", "blocked"].includes(eventForm.outcome)) addStat(primary, "SoT");
      if (eventForm.outcome === "goal") addStat(primary, "G");
      if (eventForm.outcome === "blocked") addStat(opponent, "Blk");
      if (eventForm.outcome === "saved") addStat(opponent, "Sv");
      if (secondary && eventForm.outcome === "goal") addStat(secondary, "A");
      if (secondary && eventForm.outcome !== "goal") addStat(secondary, "ShA");
    }

    if (eventForm.type === "engagement") {
      if (eventForm.outcome === "offensive-won") addStat(primary, "ODw");
      if (eventForm.outcome === "defensive-won") {
        addStat(primary, "DDw");
        addStat(primary, "Wp");
      }
      if (eventForm.outcome === "duel-lost") addStat(primary, "DuL");
      if (eventForm.outcome === "foul-committed") addStat(primary, "Fl");
      if (eventForm.outcome === "foul-suffered") addStat(primary, "FS");
      if (eventForm.outcome === "2on1-forced") addStat(primary, "2o1F");
      if (eventForm.outcome === "2on1-committed") addStat(primary, "2o1C");
      if (eventForm.outcome === "goal-area-positioning") addStat(primary, "GAP");
      if (eventForm.outcome === "dogso") addStat(primary, "DOGSO");
    }

    if (eventForm.type === "turnover") {
      addStat(primary, "Lp");
      addStat(primary, "-");
      if (eventForm.outcome === "unsuccessful-pass") addStat(primary, "Mp");
      if (eventForm.outcome === "failed-dribble") addStat(primary, "DrbA");
      if (eventForm.outcome === "lost-duel") addStat(primary, "DuL");
      if (eventForm.outcome === "2on1") addStat(primary, "2o1C");
    }

    if (eventForm.type === "note") {
      if (!eventForm.detail.trim() && !match.note.trim()) {
        notify("error", "Missing note", "Enter a note describing the event.");
        return;
      }
      events.push({
        kind: "note",
        team: eventForm.team,
        statLabel: "Event note",
      });
    }

    if (eventForm.type === "set-piece") {
      if (!primary) {
        notify("error", "Missing set-piece taker", "Select the player who took the set piece.");
        return;
      }
      const setPiece = SET_PIECES.find((piece) => piece.code === eventForm.sourceSetPieceCode);
      events.push({
        kind: "set-piece",
        team: eventForm.team,
        playerId: primary.id,
        playerName: primary.name,
        playerRole: primary.role,
        setPieceCode: setPiece?.code,
        setPieceLabel: setPiece?.label,
        setPieceRating: eventForm.sourceSetPieceRating,
      });
      const play = match.plays.find((candidate) => candidate.id === eventForm.sourcePlayId);
      if (play) {
        events.push({
          kind: "play",
          team: eventForm.team,
          playId: play.id,
          playName: play.name,
          playType: play.type,
          playArtUrl: play.artUrl,
        });
      }
      if (eventForm.outcome === "shot") addStat(primary, "ShA");
      if (eventForm.outcome === "goal") addStat(primary, "A");
      if (eventForm.outcome === "turnover") {
        addStat(primary, "Lp");
        addStat(primary, "-");
      }
    }

    if (eventForm.type === "substitution") {
      if (match.activePossession !== "out") {
        notify("error", "Substitution unavailable", "Substitutions can only be recorded when the ball is out of play.");
        return;
      }
      if (!primary || !secondary) {
        notify("error", "Incomplete substitution", "Select the player leaving and the substitute entering.");
        return;
      }
      events.push({
        kind: "substitution",
        team: eventForm.team,
        substitutionOutPlayerId: primary.id,
        substitutionOutPlayerName: primary.name,
        substitutionInPlayerId: secondary.id,
        substitutionInPlayerName: secondary.name,
      });
      setMatch((current) => ({
        ...current,
        players: current.players.map((player) => {
          if (player.id === primary.id) return { ...player, active: false };
          if (player.id === secondary.id) return { ...player, active: true };
          return player;
        }),
      }));
    }

    if (!events.length) {
      notify("error", "No event details", "Choose an event type and outcome that records at least one stat.");
      return;
    }

    const eventMetadata = {
      fieldDepth: eventForm.fieldDepth,
      fieldLane: eventForm.fieldLane,
      fieldEndDepth: eventForm.fieldEndDepth,
      fieldEndLane: eventForm.fieldEndLane,
      eventSource: eventForm.eventSource,
      eventSourceSetPieceCode: eventForm.eventSource === "set-piece" ? eventForm.sourceSetPieceCode : undefined,
      eventSourceSetPieceLabel: eventForm.eventSource === "set-piece" ? sourceSetPiece?.label : undefined,
      playId: eventForm.sourcePlayId || undefined,
      playName: match.plays.find((play) => play.id === eventForm.sourcePlayId)?.name,
    };

    const advancedNote = eventForm.advancedTags.length
      ? `${eventForm.detail || match.note} [Advanced: ${eventForm.advancedTags.join(", ")}]`
      : eventForm.detail || match.note;

    addStructuredEvents(
      events.map((event) => ({
        ...event,
        ...eventMetadata,
      })),
      advancedNote,
    );
    setEventForm((current) => ({
      ...defaultStructuredEventForm(),
      team: current.team,
    }));
    setMatch((current) => ({
      ...current,
      activePossession: "unset",
      possessionSelection: defaultPossessionSelection(current.players),
    }));
    notify("success", "Event recorded", "The event details were converted into stat entries.");
  };

  const selectPossession = (owner: PossessionOwner) => {
    const participants = resolvePossessionParticipants(owner, match.possessionSelection, match.players);
    if (!participants) {
      notify(
        "warning",
        "Complete possession details",
        owner === "contested"
          ? "Select two different players contesting possession before tracking contested possession."
          : "Select the player in possession before tracking possession.",
      );
    }

    const willOverrideFuture = match.possessionSegments.some(
      (segment) => segment.endSeconds > currentVideoSeconds + 0.1,
    );
    const shouldTrimFuture =
      willOverrideFuture &&
      (owner !== match.activePossession ||
        participantKey(owner, match.possessionSelection) !==
          participantKey(match.activePossession, match.possessionSelection));

    if (shouldTrimFuture) {
      const confirmed = window.confirm(
        "Changing possession here will remove possession tags after this video timestamp and replace them as playback continues. Is that correct?",
      );
      if (!confirmed) {
        return;
      }
    }

    setMatch((current) => ({
      ...current,
      activePossession: owner,
      possessionSegments: shouldTrimFuture
        ? trimPossessionSegmentsAfter(current.possessionSegments, currentVideoSeconds)
        : current.possessionSegments,
    }));
    if ((owner === "home" || owner === "away") && participants?.ids[0]) {
      setEventForm((current) => ({
        ...current,
        team: owner,
        primaryPlayerId: participants.ids[0],
      }));
    }
    previousPossessionVideoSeconds.current = currentVideoSeconds;
  };

  const updatePossessionSelection = (patch: Partial<PossessionSelection>) => {
    const nextSelection = {
      ...match.possessionSelection,
      ...patch,
    };
    const selectionChangedForActiveOwner =
      participantKey(match.activePossession, nextSelection) !==
      participantKey(match.activePossession, match.possessionSelection);
    const willOverrideFuture =
      selectionChangedForActiveOwner &&
      match.possessionSegments.some((segment) => segment.endSeconds > currentVideoSeconds + 0.1);

    if (willOverrideFuture) {
      const confirmed = window.confirm(
        "Changing the selected possession player here will remove possession tags after this video timestamp and replace them as playback continues. Is that correct?",
      );
      if (!confirmed) {
        return;
      }
    }

    setMatch((current) => ({
      ...current,
      possessionSelection: nextSelection,
      possessionSegments: willOverrideFuture
        ? trimPossessionSegmentsAfter(current.possessionSegments, currentVideoSeconds)
        : current.possessionSegments,
    }));
    const participants = resolvePossessionParticipants(match.activePossession, nextSelection, match.players);
    if ((match.activePossession === "home" || match.activePossession === "away") && participants?.ids[0]) {
      setEventForm((current) => ({
        ...current,
        team: match.activePossession as TeamSide,
        primaryPlayerId: participants.ids[0],
      }));
    }
    previousPossessionVideoSeconds.current = currentVideoSeconds;
  };

  const handleVideoPause = () => {
    if (isCalibrationPlaybackAllowed) {
      return;
    }

    setEventRequiredAfterPause(true);
    setMatch((current) => ({
      ...current,
      activePossession: "unset",
      possessionSelection: defaultPossessionSelection(current.players),
    }));
    previousPossessionVideoSeconds.current = currentVideoSeconds;
    notify(
      "warning",
      "Video paused",
      "Time-tracking selections were cleared. Log at least one event and choose the next time-tracking state before resuming.",
    );
  };

  const handlePlaybackBlocked = () => {
    notify("error", "Playback blocked", playbackBlockReason || "Complete the required rating fields before playing.");
  };

  const loadVideo = () => {
    const videoId = parseYouTubeVideoId(match.video.videoUrl);
    if (!videoId) {
      notify("error", "Invalid video", "Paste a YouTube URL or video ID before loading the video.");
      return;
    }
    updateVideo({ videoId });
    setCurrentVideoSeconds(0);
    setEventRequiredAfterPause(false);
    previousPossessionVideoSeconds.current = 0;
    notify("success", "Video loaded", "Video sync is ready. Confirm the half and boundary anchors before rating.");
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

  const startFirstHalfWithPossession = () => {
    if (!match.gameLocation.trim()) {
      notify("error", "Missing location", "Enter where the game is being played before starting the first half.");
      return;
    }
    const homeActive = match.players.filter((player) => player.team === "home" && player.active !== false);
    const awayActive = match.players.filter((player) => player.team === "away" && player.active !== false);
    if (homeActive.length !== 4 || awayActive.length !== 4 || [...homeActive, ...awayActive].some((player) => !player.name.trim())) {
      notify("error", "Incomplete active roster", "Enter exactly four active players with names for each team before starting.");
      return;
    }
    const centerPlayerId = centerPlayerIdForTeam(match.players.filter((player) => player.active !== false), startingPossessionTeam);
    setMatch((current) => ({
      ...current,
      activePossession: startingPossessionTeam,
      possessionSelection: {
        ...defaultPossessionSelection(current.players),
        [startingPossessionTeam === "home" ? "homePlayerId" : "awayPlayerId"]: centerPlayerId,
      },
      video: {
        ...current.video,
        firstHalfStartVideoSeconds: currentVideoSeconds,
        firstHalfStartMatchClock: current.video.firstHalfStartMatchClock || "0:00",
      },
    }));
    setEventRequiredAfterPause(false);
    setEventForm((current) => ({
      ...current,
      team: startingPossessionTeam,
      primaryPlayerId: centerPlayerId,
    }));
    previousPossessionVideoSeconds.current = currentVideoSeconds;
    notify(
      "success",
      "First half started",
      `${startingPossessionTeam === "home" ? match.homeTeam : match.awayTeam} starts with center in possession.`,
    );
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

  const markSecondHalfEnd = () => {
    updateVideo({
      secondHalfEndVideoSeconds: currentVideoSeconds,
      secondHalfEndMatchClock:
        derivedVideoTime.half === "second" ? derivedVideoTime.minute : match.video.secondHalfEndMatchClock,
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
    setMatch((current) => ({
      ...initialState,
      knowledgeBase: current.knowledgeBase,
      gameDate: new Date().toISOString().slice(0, 10),
    }));
    setSelectedSetPiece(SET_PIECES[0].code);
    setSetPieceTeam("home");
    setSetPieceRating(3);
    setSubstitutionTeam("home");
    setSubOutPlayerId("");
    setSubInPlayerId("");
    setPlayTeam("home");
    setPlayType("offense");
    setSelectedPlayId(DEFAULT_PLAYS[0].id);
    setCurrentVideoSeconds(0);
    setCurrentVideoDuration(0);
    setEventRequiredAfterPause(false);
    previousPossessionVideoSeconds.current = 0;
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
        "Value Type",
        "Value",
        "Set Piece Rating",
        "Play Type",
        "Play Art URL",
        "Field Depth",
        "Field Lane",
        "Field End Depth",
        "Field End Lane",
        "Event Source",
        "Source Set Piece",
        "Substitution Out",
        "Substitution In",
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
          event.statCode ?? event.setPieceCode ?? event.playId,
          event.statLabel ?? event.setPieceLabel ?? event.playName,
          event.statValueType,
          event.statValue,
          event.setPieceRating,
          event.playType,
          event.playArtUrl,
          event.fieldDepth,
          event.fieldLane,
          event.fieldEndDepth,
          event.fieldEndLane,
          event.eventSource,
          event.eventSourceSetPieceLabel ?? event.eventSourceSetPieceCode,
          event.substitutionOutPlayerName,
          event.substitutionInPlayerName,
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
      ...activeStats.map((stat) => stat.templateCode ?? stat.code),
    ];
    const rows = match.players.flatMap((player) =>
      TIME_BUCKETS.map((bucket) => [
        teamName(player.team),
        player.name,
        player.role,
        bucket,
        ...activeStats.map(
          (stat) => statSummary.get([player.team, player.id, bucket, stat.code].join("|")) ?? "",
        ),
      ]),
    );
    downloadCsv("power-soccer-summary.csv", [header, ...rows]);
  };

  const finishGame = () => {
    if (!match.events.length) {
      notify("error", "No rating data", "Record at least one event before finishing a game.");
      return;
    }
    if (!match.gameDate || !match.gameLocation.trim() || !match.homeDivision.trim() || !match.awayDivision.trim()) {
      notify("error", "Missing game metadata", "Add a game date, location, and both team divisions before finishing.");
      return;
    }

    const confirmed = window.confirm(
      "Finish this game and update the player/team knowledge base with the current stats?",
    );
    if (!confirmed) {
      return;
    }

    setMatch((current) => {
      const game = buildGameSnapshot(current);
      return {
        ...current,
        knowledgeBase: mergeKnowledgeBase(current.knowledgeBase, game),
      };
    });
    setPage("knowledge");
    notify("success", "Knowledge base updated", "Finished game stats were added to player and team history.");
  };

  const teamName = (team: TeamSide) => (team === "home" ? match.homeTeam : match.awayTeam);
  const activePlayers = match.players.filter((player) => player.active !== false);
  const homePlayers = activePlayers.filter((player) => player.team === "home");
  const awayPlayers = activePlayers.filter((player) => player.team === "away");
  const latestEvents = match.events.slice(0, 10);

  if (!role) {
    return (
      <main className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Power soccer stat collection</p>
            <h1>Choose workspace</h1>
            <p className="hero-copy">
              Continue as a rater to tag a match video, or enter the admin workspace for setup,
              summaries, knowledge-base review, and tagged-game analysis.
            </p>
          </div>
        </header>
        <section className="role-choice-grid">
          <button
            type="button"
            className="role-card"
            onClick={() => {
              setRole("rater");
              setPage("tracker");
            }}
          >
            <span>Rater</span>
            <strong>Video + data collection</strong>
            <p>Use the video player, time tracking, event form, set pieces, and play tagging.</p>
          </button>
          <button
            type="button"
            className="role-card"
            onClick={() => {
              setRole("admin");
              setPage("admin-overview");
            }}
          >
            <span>Admin</span>
            <strong>Setup + review tools</strong>
            <p>Manage stats/plays, view summaries, inspect tagged games, and browse the knowledge base.</p>
          </button>
        </section>
      </main>
    );
  }

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

      <nav className="page-tabs" aria-label="App pages">
        {role === "rater" ? (
          <button type="button" className="tab-button active" onClick={() => setPage("tracker")}>
            Rater workspace
          </button>
        ) : (
          <>
            <button
              type="button"
              className={page === "admin-overview" ? "tab-button active" : "tab-button"}
              onClick={() => setPage("admin-overview")}
            >
              Admin overview
            </button>
            <button
              type="button"
              className={page === "settings" ? "tab-button active" : "tab-button"}
              onClick={() => setPage("settings")}
            >
              Stats & plays settings
            </button>
            <button
              type="button"
              className={page === "knowledge" ? "tab-button active" : "tab-button"}
              onClick={() => setPage("knowledge")}
            >
              Knowledge base
            </button>
            <button
              type="button"
              className={page === "game-review" ? "tab-button active" : "tab-button"}
              onClick={() => setPage("game-review")}
            >
              Tagged game view
            </button>
          </>
        )}
        <button type="button" className="tab-button" onClick={() => setRole(null)}>
          Switch role
        </button>
      </nav>

      <NoticeCenter notices={[...notices, ...setupWarnings]} onDismiss={dismissNotice} />

      {page === "tracker" ? (
        <section className={canPlayVideo ? "playback-readiness ready" : "playback-readiness blocked"}>
          <strong>{canPlayVideo ? "Video playback ready" : "Video playback blocked"}</strong>
          <span>{topPlaybackMessage}</span>
        </section>
      ) : null}

      {page === "admin-overview" ? (
        <AdminOverviewPage
          match={match}
          activeStats={activeStats}
          teamTotals={teamTotals}
          setPieceTotals={setPieceTotals}
          latestEvents={latestEvents}
          teamName={teamName}
          onFinishGame={finishGame}
          onExportSummary={exportSummary}
          onExportEvents={exportEvents}
          onDeleteEvent={deleteEvent}
          onResetMatch={resetMatch}
        />
      ) : page === "settings" ? (
        <StatsSettingsPage
          stats={match.statDefinitions}
          plays={match.plays}
          onStatChange={updateStatDefinition}
          onStatAdd={addStatDefinition}
          onStatRemove={removeStatDefinition}
          onPlayChange={updatePlayDefinition}
          onPlayAdd={addPlayDefinition}
          onPlayRemove={removePlayDefinition}
        />
      ) : page === "knowledge" ? (
        <KnowledgeBasePage knowledgeBase={match.knowledgeBase} statDefinitions={match.statDefinitions} />
      ) : page === "game-review" ? (
        <TaggedGameViewPage knowledgeBase={match.knowledgeBase} teamName={teamName} />
      ) : (
        <>
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
              canPlay={canPlayVideo}
              onTimeChange={onVideoTimeChange}
              onDurationChange={onVideoDurationChange}
              onPlaybackBlocked={handlePlaybackBlocked}
              onUserPause={handleVideoPause}
            />
            {playbackBlockReason ? (
              <p className="playback-gate-message">{playbackBlockReason}</p>
            ) : (
              <p className="playback-gate-message ready">Ready to play with current time-tracking state.</p>
            )}
            {!firstHalfStarted ? (
              <section className="start-match-panel" aria-labelledby="start-match-title">
                <p className="section-kicker">Start first half</p>
                <h3 id="start-match-title">Mark kickoff and starting possession</h3>
                <p className="muted">
                  Before rating begins, mark the video timestamp where the first half starts and
                  choose the team with the ball. That team's center is assumed to be in possession.
                </p>
                <StartSetupChecklist
                  players={match.players}
                  location={match.gameLocation}
                  startingTeam={startingPossessionTeam}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                />
                <div className="start-setup-grid">
                  <label>
                    Game location
                    <input
                      value={match.gameLocation}
                      onChange={(event) => updateMatch("gameLocation", event.target.value)}
                      placeholder="Gym / venue name"
                    />
                  </label>
                  <label>
                    Home team
                    <input value={match.homeTeam} onChange={(event) => updateMatch("homeTeam", event.target.value)} />
                  </label>
                  <label>
                    Away team
                    <input value={match.awayTeam} onChange={(event) => updateMatch("awayTeam", event.target.value)} />
                  </label>
                </div>
                <RosterSetupPanel
                  players={match.players}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                  onPlayerChange={updatePlayer}
                  onAddSubstitute={addSubstitute}
                />
                <label>
                  Team with ball
                  <select
                    value={startingPossessionTeam}
                    onChange={(event) => setStartingPossessionTeam(event.target.value as TeamSide)}
                  >
                    <option value="home">{match.homeTeam}</option>
                    <option value="away">{match.awayTeam}</option>
                  </select>
                </label>
                <button type="button" className="primary-action" onClick={startFirstHalfWithPossession}>
                  Mark 1H start at {formatClock(currentVideoSeconds)}
                </button>
              </section>
            ) : (
              <>
                <PossessionTracker
                  activePossession={match.activePossession}
                  currentVideoSeconds={currentVideoSeconds}
                  durationSeconds={currentVideoDuration}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                  players={activePlayers}
                  selection={match.possessionSelection}
                  segments={match.possessionSegments}
                  onSelect={selectPossession}
                  onSelectionChange={updatePossessionSelection}
                />
                <EventCapturePanel
                  form={eventForm}
                  homeTeam={match.homeTeam}
                  awayTeam={match.awayTeam}
                  players={match.players}
                  plays={match.plays}
                  eventRequiredAfterPause={eventRequiredAfterPause}
                  onChange={(patch) => setEventForm((current) => ({ ...current, ...patch }))}
                  onSubmit={submitStructuredEvent}
                />
              </>
            )}
          </div>

          {firstHalfStarted ? (
          <div className="sync-column">
            {videoSyncComplete && !showVideoSyncDetails ? (
              <section className="current-time-card">
                <span>Video sync complete</span>
                <strong>{derivedVideoTime.minute}</strong>
                <p>
                  1H {formatClock(match.video.firstHalfStartVideoSeconds ?? 0)}-
                  {formatClock(match.video.firstHalfEndVideoSeconds ?? 0)} / 2H{" "}
                  {formatClock(match.video.secondHalfStartVideoSeconds ?? 0)}-
                  {formatClock(match.video.secondHalfEndVideoSeconds ?? 0)}
                </p>
                <button type="button" onClick={() => setShowVideoSyncDetails(true)}>
                  Edit sync
                </button>
              </section>
            ) : (
            <>
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
              <label>
                2nd-half end clock
                <input
                  value={match.video.secondHalfEndMatchClock}
                  onChange={(event) => updateVideo({ secondHalfEndMatchClock: event.target.value })}
                  placeholder="40:00"
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
              <button type="button" onClick={markSecondHalfEnd}>
                Mark 2H end at {formatClock(currentVideoSeconds)}
              </button>
            </div>

            <div className="anchor-list">
              <AnchorRow label="1H start" seconds={match.video.firstHalfStartVideoSeconds} />
              <AnchorRow label="1H end" seconds={match.video.firstHalfEndVideoSeconds} />
              <AnchorRow label="2H start" seconds={match.video.secondHalfStartVideoSeconds} />
              <AnchorRow label="2H end" seconds={match.video.secondHalfEndVideoSeconds} />
            </div>
            {videoSyncComplete ? (
              <button type="button" onClick={() => setShowVideoSyncDetails(false)}>
                Collapse sync controls
              </button>
            ) : null}
            </>
            )}
          </div>
          ) : null}
        </div>
      </section>

      {firstHalfStarted ? (
      <>
      {!showMatchSetupDetails ? (
        <section className="panel setup-summary-panel">
          <div>
            <p className="section-kicker">Match setup</p>
            <h2>
              {match.homeTeam} vs {match.awayTeam}
            </h2>
            <p className="muted">
              {match.gameDate} / {match.gameLocation || "No location"} / Divisions {match.homeDivision}-
              {match.awayDivision}
            </p>
          </div>
          <button type="button" onClick={() => setShowMatchSetupDetails(true)}>
            Edit match setup
          </button>
        </section>
      ) : (
      <section className="panel setup-panel" aria-labelledby="setup-title">
        <div>
          <p className="section-kicker">Match setup</p>
          <h2 id="setup-title">Context for every tap</h2>
        </div>
        <div className="setup-grid">
          <label>
            Location
            <input
              value={match.gameLocation}
              onChange={(event) => updateMatch("gameLocation", event.target.value)}
              placeholder="Gym / venue name"
            />
          </label>
          <label>
            Game date
            <input
              type="date"
              value={match.gameDate}
              onChange={(event) => updateMatch("gameDate", event.target.value)}
            />
          </label>
          <label>
            Home
            <input
              value={match.homeTeam}
              onChange={(event) => updateMatch("homeTeam", event.target.value)}
            />
          </label>
          <label>
            Home division
            <input
              value={match.homeDivision}
              onChange={(event) => updateMatch("homeDivision", event.target.value)}
              placeholder="104"
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
            Away division
            <input
              value={match.awayDivision}
              onChange={(event) => updateMatch("awayDivision", event.target.value)}
              placeholder="104"
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
        <label>
          Value for next stat
          <input
            value={match.nextStatValue}
            onChange={(event) => updateMatch("nextStatValue", event.target.value)}
            placeholder="Optional: used for string/decimal/time stats; integer stats default to 1"
          />
        </label>
        <button type="button" onClick={() => setShowMatchSetupDetails(false)}>
          Collapse match setup
        </button>
      </section>
      )}

      </>
      ) : null}

      {role === "admin" ? (
        <>
      <section className="columns secondary-columns">
        <section className="panel" aria-labelledby="summary-title">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Live summary</p>
              <h2 id="summary-title">Team stat totals</h2>
            </div>
            <div className="action-row">
              <button type="button" className="primary-action" onClick={finishGame}>
                Finish game & update knowledge base
              </button>
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
                  {activeStats.map((stat) => (
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
                    {activeStats.map((stat) => (
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

        <EventLog
          events={latestEvents}
          title="Latest entries"
          description="Most recent stats, plays, set pieces, and notes."
          teamName={teamName}
          onDelete={deleteEvent}
          onReset={resetMatch}
        />
      </section>

      <section className="panel definitions-panel" aria-labelledby="definitions-title">
        <p className="section-kicker">Definitions tab</p>
        <h2 id="definitions-title">Stat reference</h2>
        <div className="definition-list">
          {match.statDefinitions.map((stat) => (
            <div key={stat.id} className={`definition-item tone-${stat.tone}`}>
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

      <EventLog
        events={match.events}
        title="Full event log"
        description="All plays, stats, set pieces, and notes recorded for this match."
        teamName={teamName}
        onDelete={deleteEvent}
      />
        </>
      ) : null}
        </>
      )}
    </main>
  );
}

type PlayerTeamPanelProps = {
  title: string;
  players: PlayerSlot[];
  stats: StatDefinition[];
  onPlayerChange: (playerId: string, patch: Partial<PlayerSlot>) => void;
  onStat: (player: PlayerSlot, statCode: string) => void;
};

type EventCapturePanelProps = {
  form: StructuredEventForm;
  homeTeam: string;
  awayTeam: string;
  players: PlayerSlot[];
  plays: PlayDefinition[];
  eventRequiredAfterPause: boolean;
  onChange: (patch: Partial<StructuredEventForm>) => void;
  onSubmit: () => void;
};

type RosterSetupPanelProps = {
  players: PlayerSlot[];
  homeTeam: string;
  awayTeam: string;
  onPlayerChange: (playerId: string, patch: Partial<PlayerSlot>) => void;
  onAddSubstitute: (team: TeamSide) => void;
};

type StartSetupChecklistProps = {
  players: PlayerSlot[];
  location: string;
  startingTeam: TeamSide;
  homeTeam: string;
  awayTeam: string;
};

type SubstitutionPanelProps = {
  team: TeamSide;
  players: PlayerSlot[];
  homeTeam: string;
  awayTeam: string;
  disabled: boolean;
  outPlayerId: string;
  inPlayerId: string;
  onTeamChange: (team: TeamSide) => void;
  onOutChange: (playerId: string) => void;
  onInChange: (playerId: string) => void;
  onSubmit: () => void;
};

type AnchorRowProps = {
  label: string;
  seconds?: number;
};

const STAT_TONES: StatDefinition["tone"][] = [
  "attack",
  "defense",
  "possession",
  "negative",
  "discipline",
];

function AnchorRow({ label, seconds }: AnchorRowProps) {
  return (
    <div className="anchor-row">
      <span>{label}</span>
      <strong>{seconds === undefined ? "Not marked" : formatClock(seconds)}</strong>
    </div>
  );
}

type NoticeCenterProps = {
  notices: AppNotice[];
  onDismiss: (noticeId: string) => void;
};

function NoticeCenter({ notices, onDismiss }: NoticeCenterProps) {
  if (!notices.length) {
    return null;
  }

  return (
    <section className="notice-center" aria-label="Notifications">
      {notices.map((notice) => (
        <article className={`notice-card notice-${notice.tone}`} key={notice.id}>
          <div>
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
          </div>
          {!notice.id.endsWith("-warning") ? (
            <button type="button" onClick={() => onDismiss(notice.id)} aria-label={`Dismiss ${notice.title}`}>
              Dismiss
            </button>
          ) : null}
        </article>
      ))}
    </section>
  );
}

type PossessionTrackerProps = {
  activePossession: ActivePossession;
  currentVideoSeconds: number;
  durationSeconds: number;
  homeTeam: string;
  awayTeam: string;
  players: PlayerSlot[];
  selection: PossessionSelection;
  segments: PossessionSegment[];
  onSelect: (owner: PossessionOwner) => void;
  onSelectionChange: (patch: Partial<PossessionSelection>) => void;
};

function possessionLabel(owner: ActivePossession, homeTeam: string, awayTeam: string) {
  if (owner === "home") {
    return homeTeam;
  }
  if (owner === "away") {
    return awayTeam;
  }
  if (owner === "out") {
    return "Out of play";
  }
  if (owner === "unset") {
    return "No selection";
  }
  return "Contested";
}

function PossessionTracker({
  activePossession,
  currentVideoSeconds,
  durationSeconds,
  homeTeam,
  awayTeam,
  players,
  selection,
  segments,
  onSelect,
  onSelectionChange,
}: PossessionTrackerProps) {
  const timelineDuration = Math.max(
    durationSeconds,
    currentVideoSeconds + 1,
    ...segments.map((segment) => segment.endSeconds),
    1,
  );
  const totals = segments.reduce(
    (accumulator, segment) => {
      accumulator[segment.owner] += segment.endSeconds - segment.startSeconds;
      return accumulator;
    },
    { home: 0, away: 0, contested: 0, out: 0 },
  );
  const homePlayers = players.filter((player) => player.team === "home");
  const awayPlayers = players.filter((player) => player.team === "away");
  const selectedParticipants = resolvePossessionParticipants(activePossession, selection, players);

  return (
    <section className="possession-panel" aria-labelledby="possession-title">
      <div>
        <p className="section-kicker">Possession timer</p>
        <h3 id="possession-title">Tag possession while the video plays</h3>
        <p className="muted">
          Current selection is applied to every second of forward playback until another option is
          chosen. Rewinding into tagged time and changing the selection asks before overriding.
        </p>
      </div>
      <div className="possession-buttons">
        {(["home", "away", "contested", "out"] as PossessionOwner[]).map((owner) => (
          <button
            type="button"
            key={owner}
            className={
              owner === activePossession
                ? `possession-button possession-${owner} active`
                : `possession-button possession-${owner}`
            }
            onClick={() => onSelect(owner)}
          >
            <strong>{possessionLabel(owner, homeTeam, awayTeam)}</strong>
            <span>{formatClock(totals[owner])}</span>
          </button>
        ))}
      </div>
      {activePossession !== "out" && activePossession !== "unset" ? (
        <div className="possession-player-grid">
          {activePossession === "home" ? (
            <label>
              {homeTeam} player in possession
              <select
                value={selection.homePlayerId}
                onChange={(event) => onSelectionChange({ homePlayerId: event.target.value })}
                required
              >
                {homePlayers.map((player) => (
                  <option value={player.id} key={player.id}>
                    {player.name} ({player.role})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {activePossession === "away" ? (
            <label>
              {awayTeam} player in possession
              <select
                value={selection.awayPlayerId}
                onChange={(event) => onSelectionChange({ awayPlayerId: event.target.value })}
                required
              >
                {awayPlayers.map((player) => (
                  <option value={player.id} key={player.id}>
                    {player.name} ({player.role})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {activePossession === "contested" ? (
            <>
              <label>
                {homeTeam} contesting player
                <select
                  value={selection.contestedPlayerOneId}
                  onChange={(event) => onSelectionChange({ contestedPlayerOneId: event.target.value })}
                  required
                >
                  {homePlayers.map((player) => (
                    <option value={player.id} key={player.id}>
                      {player.name} ({player.role})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {awayTeam} contesting player
                <select
                  value={selection.contestedPlayerTwoId}
                  onChange={(event) => onSelectionChange({ contestedPlayerTwoId: event.target.value })}
                  required
                >
                  {awayPlayers.map((player) => (
                    <option value={player.id} key={player.id}>
                      {player.name} ({player.role})
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
        </div>
      ) : null}
      <p className={selectedParticipants ? "possession-context" : "possession-context warning"}>
        Active possession context:{" "}
        {selectedParticipants
          ? `${possessionLabel(activePossession, homeTeam, awayTeam)}${
              selectedParticipants.names.length ? ` - ${selectedParticipants.names.join(" vs ")}` : ""
            }`
          : "Select the required player context before playing/tagging possession."}
      </p>
      <div className="possession-timeline" aria-label="Possession timeline">
        {segments.map((segment) => (
          <div
            className={`possession-segment possession-${segment.owner}`}
            key={segment.id}
            title={`${possessionLabel(segment.owner, homeTeam, awayTeam)} ${formatClock(
              segment.startSeconds,
            )}-${formatClock(segment.endSeconds)} ${segment.participantPlayerNames.join(" vs ")}`}
            style={{
              left: `${(segment.startSeconds / timelineDuration) * 100}%`,
              width: `${((segment.endSeconds - segment.startSeconds) / timelineDuration) * 100}%`,
            }}
          />
        ))}
        <div
          className="possession-cursor"
          style={{ left: `${Math.min(100, (currentVideoSeconds / timelineDuration) * 100)}%` }}
        />
      </div>
      <div className="possession-legend">
        <span className="legend-item possession-home">{homeTeam}</span>
        <span className="legend-item possession-away">{awayTeam}</span>
        <span className="legend-item possession-contested">Contested</span>
        <span className="legend-item possession-out">Out of play</span>
        <span>Cursor: {formatClock(currentVideoSeconds)}</span>
      </div>
    </section>
  );
}

type EventLogProps = {
  events: StatEvent[];
  title: string;
  description: string;
  teamName: (team: TeamSide) => string;
  onDelete: (eventId: string) => void;
  onReset?: () => void;
};

function eventCode(event: StatEvent) {
  if (event.kind === "stat") {
    return event.statCode ?? "STAT";
  }
  if (event.kind === "play") {
    return event.playType === "defense" ? "DEF" : "OFF";
  }
  if (event.kind === "set-piece") {
    return event.setPieceCode ?? "SET";
  }
  if (event.kind === "substitution") {
    return "SUB";
  }
  return "NOTE";
}

function eventTitle(event: StatEvent, teamName: (team: TeamSide) => string) {
  if (event.kind === "stat") {
    return `${event.playerName ?? teamName(event.team)} - ${event.statLabel ?? event.statCode}`;
  }
  if (event.kind === "play") {
    return `${teamName(event.team)} - ${event.playName ?? "Play"}`;
  }
  if (event.kind === "set-piece") {
    return `${teamName(event.team)} - ${event.setPieceLabel ?? event.setPieceCode}`;
  }
  if (event.kind === "substitution") {
    return `${teamName(event.team)} - ${event.substitutionInPlayerName ?? "Sub"} for ${
      event.substitutionOutPlayerName ?? "player"
    }`;
  }
  return `${teamName(event.team)} - ${event.statLabel ?? "Note"}`;
}

function EventLog({ events, title, description, teamName, onDelete, onReset }: EventLogProps) {
  return (
    <section className="panel event-log-panel" aria-labelledby={`${title.replaceAll(" ", "-")}-title`}>
      <div className="section-heading-row">
        <div>
          <p className="section-kicker">Event log</p>
          <h2 id={`${title.replaceAll(" ", "-")}-title`}>{title}</h2>
          <p className="muted">{description}</p>
        </div>
        {onReset ? (
          <button type="button" className="danger" onClick={onReset}>
            Reset match
          </button>
        ) : null}
      </div>
      {events.length === 0 ? (
        <p className="empty-state">No events yet. Tap a player stat, tag a play, or add a note.</p>
      ) : (
        <div className="event-list">
          {events.map((event) => (
            <article className={`event-card event-kind-${event.kind}`} key={event.id}>
              <div className="event-main">
                <span className="event-code">{eventCode(event)}</span>
                <div>
                  <strong>
                    {eventTitle(event, teamName)} <small>{event.kind}</small>
                  </strong>
                  <p>
                    {event.bucket} / {event.minute}
                    {event.half ? ` / ${event.half}` : ""}
                    {event.videoSeconds !== undefined ? ` / video ${formatClock(event.videoSeconds)}` : ""}
                    {event.fieldDepth && event.fieldLane
                      ? ` / ${event.fieldDepth} ${event.fieldLane}${
                          event.fieldEndDepth && event.fieldEndLane
                            ? ` -> ${event.fieldEndDepth} ${event.fieldEndLane}`
                            : ""
                        }`
                      : ""}
                    {event.statValue ? ` / value ${event.statValue}` : ""}
                    {event.setPieceRating ? ` / outcome ${event.setPieceRating}` : ""}
                    {event.note ? ` - ${event.note}` : ""}
                  </p>
                  {event.playArtUrl ? (
                    <a href={event.playArtUrl} target="_blank" rel="noreferrer">
                      Open play art
                    </a>
                  ) : null}
                </div>
              </div>
              <button type="button" onClick={() => onDelete(event.id)}>
                Delete
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

const EVENT_TYPE_OPTIONS: Array<{ value: Exclude<StructuredEventType, "">; label: string }> = [
  { value: "completed-pass", label: "Completed pass" },
  { value: "failed-pass", label: "Failed pass" },
  { value: "dribble", label: "Dribble / carry" },
  { value: "shot", label: "Shot" },
  { value: "turnover", label: "Turnover" },
  { value: "engagement", label: "Engagement / duel" },
  { value: "set-piece", label: "Set piece" },
  { value: "substitution", label: "Substitution" },
  { value: "note", label: "Other / note" },
];

const COMMON_EVENT_TYPES: Array<Exclude<StructuredEventType, "" | "note" | "substitution" | "set-piece">> = [
  "completed-pass",
  "failed-pass",
  "dribble",
  "shot",
  "turnover",
  "engagement",
];

const UNCOMMON_EVENT_TYPES: Array<Exclude<StructuredEventType, "">> = ["set-piece", "substitution", "note"];

function isCommonEventType(value: Exclude<StructuredEventType, "">): value is (typeof COMMON_EVENT_TYPES)[number] {
  return (COMMON_EVENT_TYPES as Array<Exclude<StructuredEventType, "">>).includes(value);
}

const FIELD_DEPTH_OPTIONS = [
  { value: "own goal-line", label: "Own goal-line" },
  { value: "own box", label: "Own goal area" },
  { value: "own above box", label: "Own build-up" },
  { value: "mid court", label: "Mid court" },
  { value: "opposition above box", label: "Attacking build-up" },
  { value: "opposition box", label: "Opp. goal area" },
  { value: "opposition goal line", label: "Opp. goal-line" },
];

const FIELD_LANE_OPTIONS = [
  { value: "left sideline", label: "Left sideline" },
  { value: "left channel", label: "Left channel" },
  { value: "middle", label: "Middle" },
  { value: "right channel", label: "Right channel" },
  { value: "right sideline", label: "Right sideline" },
];

const OUTCOME_OPTIONS: Record<Exclude<StructuredEventType, "">, Array<{ value: string; label: string }>> = {
  "completed-pass": [
    { value: "completed", label: "Completed" },
    { value: "key-pass", label: "Key pass / big chance" },
    { value: "shot-assist", label: "Led to shot" },
    { value: "assist", label: "Assist" },
  ],
  "failed-pass": [
    { value: "misplaced", label: "Misplaced" },
    { value: "turnover", label: "Turnover" },
  ],
  dribble: [
    { value: "successful", label: "Successful" },
    { value: "progressive", label: "Progressive carry" },
    { value: "unsuccessful", label: "Unsuccessful" },
    { value: "turnover", label: "Turnover" },
    { value: "foul-suffered", label: "Foul suffered" },
  ],
  shot: [
    { value: "goal", label: "Goal" },
    { value: "on-target", label: "On target" },
    { value: "saved", label: "Saved" },
    { value: "blocked", label: "Blocked" },
    { value: "near-miss", label: "Near miss" },
  ],
  engagement: [
    { value: "offensive-won", label: "Offensive duel won" },
    { value: "defensive-won", label: "Defensive duel won" },
    { value: "duel-lost", label: "Duel lost" },
    { value: "foul-committed", label: "Foul committed" },
    { value: "foul-suffered", label: "Foul suffered" },
    { value: "2on1-forced", label: "2-on-1 forced" },
    { value: "2on1-committed", label: "2-on-1 committed" },
    { value: "goal-area-positioning", label: "Goal-area positioning" },
    { value: "dogso", label: "DOGSO" },
  ],
  turnover: [
    { value: "unsuccessful-pass", label: "Unsuccessful pass" },
    { value: "failed-dribble", label: "Failed dribble" },
    { value: "lost-duel", label: "Lost duel" },
    { value: "2on1", label: "2-on-1" },
    { value: "other", label: "Other" },
  ],
  "set-piece": [
    { value: "retained", label: "Retained possession" },
    { value: "shot", label: "Led to shot" },
    { value: "goal", label: "Led to goal" },
    { value: "turnover", label: "Turnover" },
    { value: "out", label: "Out of play" },
  ],
  substitution: [{ value: "substitution", label: "Substitution" }],
  note: [{ value: "note", label: "Note only" }],
};

function playerOptionLabel(player: PlayerSlot) {
  return `${player.name} (${player.role})`;
}

type CourtAreaPickerProps = {
  title: string;
  depth: string;
  lane: string;
  onSelect: (depth: string, lane: string) => void;
};

function optionLabel(options: Array<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? value;
}

function CourtAreaPicker({ title, depth, lane, onSelect }: CourtAreaPickerProps) {
  return (
    <div className="court-picker">
      <div className="section-heading-row compact">
        <div>
          <p className="section-kicker">{title}</p>
          <strong>
            {optionLabel(FIELD_DEPTH_OPTIONS, depth)} / {optionLabel(FIELD_LANE_OPTIONS, lane)}
          </strong>
        </div>
      </div>
      <div className="court-map" role="grid" aria-label={`${title} court selector`}>
        {FIELD_DEPTH_OPTIONS.map((depthOption, depthIndex) =>
          FIELD_LANE_OPTIONS.map((laneOption, laneIndex) => {
            const isSelected = depth === depthOption.value && lane === laneOption.value;
            const isGoalArea =
              depthOption.value === "own box" || depthOption.value === "opposition box";
            const isGoalLine =
              depthOption.value === "own goal-line" || depthOption.value === "opposition goal line";
            const isCenter = depthOption.value === "mid court";
            return (
              <button
                type="button"
                className={[
                  "court-cell",
                  isSelected ? "selected" : "",
                  isGoalArea ? "goal-area" : "",
                  isGoalLine ? "goal-line" : "",
                  isCenter ? "center-line" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                key={`${depthOption.value}-${laneOption.value}`}
                onClick={() => onSelect(depthOption.value, laneOption.value)}
                style={{
                  gridColumn: depthIndex + 1,
                  gridRow: laneIndex + 1,
                }}
                aria-label={`${depthOption.label}, ${laneOption.label}`}
                title={`${depthOption.label}, ${laneOption.label}`}
              >
                {laneOption.value === "middle" ? depthOption.label : ""}
              </button>
            );
          }),
        )}
      </div>
      <div className="court-label-row">
        <span>Own goal</span>
        <span>Attack direction</span>
        <span>Opposition goal</span>
      </div>
    </div>
  );
}

function StartSetupChecklist({ players, location, startingTeam, homeTeam, awayTeam }: StartSetupChecklistProps) {
  const homeActive = players.filter((player) => player.team === "home" && player.active !== false);
  const awayActive = players.filter((player) => player.team === "away" && player.active !== false);
  const checks = [
    {
      label: "Game location",
      complete: Boolean(location.trim()),
      detail: location.trim() || "not set",
    },
    {
      label: `${homeTeam} active players`,
      complete: homeActive.length === 4 && homeActive.every((player) => player.name.trim()),
      detail: `${homeActive.length}/4 active`,
    },
    {
      label: `${awayTeam} active players`,
      complete: awayActive.length === 4 && awayActive.every((player) => player.name.trim()),
      detail: `${awayActive.length}/4 active`,
    },
    {
      label: "Starting possession",
      complete: true,
      detail: startingTeam === "home" ? homeTeam : awayTeam,
    },
  ];

  return (
    <div className="start-checklist">
      {checks.map((check) => (
        <div className={check.complete ? "start-check complete" : "start-check"} key={check.label}>
          <strong>{check.complete ? "✓" : "!"}</strong>
          <span>{check.label}</span>
          <small>{check.detail}</small>
        </div>
      ))}
    </div>
  );
}

function RosterSetupPanel({
  players,
  homeTeam,
  awayTeam,
  onPlayerChange,
  onAddSubstitute,
}: RosterSetupPanelProps) {
  const renderTeam = (team: TeamSide, label: string) => {
    const teamPlayers = players.filter((player) => player.team === team);
    const activeCount = teamPlayers.filter((player) => player.active !== false).length;
    return (
      <div className="roster-setup-team" key={team}>
        <div className="section-heading-row compact">
          <div>
            <strong>{label}</strong>
            <p className="muted">{activeCount}/4 active players selected</p>
          </div>
          <button type="button" onClick={() => onAddSubstitute(team)}>
            Add substitute
          </button>
        </div>
        <div className="roster-row-list">
          {teamPlayers.map((player) => (
            <article className="roster-row" key={player.id}>
              <label>
                Active
                <input
                  type="checkbox"
                  checked={player.active !== false}
                  onChange={(event) => onPlayerChange(player.id, { active: event.target.checked })}
                />
              </label>
              <label>
                Player
                <input
                  value={player.name}
                  onChange={(event) => onPlayerChange(player.id, { name: event.target.value })}
                />
              </label>
              <label>
                Position / role
                <input
                  value={player.role}
                  onChange={(event) => onPlayerChange(player.id, { role: event.target.value })}
                />
              </label>
            </article>
          ))}
        </div>
      </div>
    );
  };

  return (
    <section className="roster-setup-panel" aria-label="Active players and substitutes">
      {renderTeam("home", homeTeam)}
      {renderTeam("away", awayTeam)}
    </section>
  );
}

function SubstitutionPanel({
  team,
  players,
  homeTeam,
  awayTeam,
  disabled,
  outPlayerId,
  inPlayerId,
  onTeamChange,
  onOutChange,
  onInChange,
  onSubmit,
}: SubstitutionPanelProps) {
  const teamPlayers = players.filter((player) => player.team === team);
  const activePlayers = teamPlayers.filter((player) => player.active !== false);
  const substitutePlayers = teamPlayers.filter((player) => player.active === false);

  return (
    <section className={disabled ? "substitution-panel disabled" : "substitution-panel"} aria-label="Substitution">
      <div>
        <p className="section-kicker">Substitution</p>
        <h3>Change active player</h3>
        <p className="muted">
          Substitutions are available when the current time-tracking state is out of play.
        </p>
      </div>
      <div className="event-step-grid">
        <label>
          Team
          <select value={team} onChange={(event) => onTeamChange(event.target.value as TeamSide)} disabled={disabled}>
            <option value="home">{homeTeam}</option>
            <option value="away">{awayTeam}</option>
          </select>
        </label>
        <label>
          Player leaving
          <select value={outPlayerId} onChange={(event) => onOutChange(event.target.value)} disabled={disabled}>
            <option value="">Select active player</option>
            {activePlayers.map((player) => (
              <option value={player.id} key={player.id}>
                {playerOptionLabel(player)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Player entering
          <select value={inPlayerId} onChange={(event) => onInChange(event.target.value)} disabled={disabled}>
            <option value="">Select substitute</option>
            {substitutePlayers.map((player) => (
              <option value={player.id} key={player.id}>
                {playerOptionLabel(player)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="button" onClick={onSubmit} disabled={disabled} className="primary-action">
        Record substitution
      </button>
    </section>
  );
}

function EventCapturePanel({
  form,
  homeTeam,
  awayTeam,
  players,
  plays,
  eventRequiredAfterPause,
  onChange,
  onSubmit,
}: EventCapturePanelProps) {
  const [showCourtMap, setShowCourtMap] = useState(false);
  const [showUncommonEvents, setShowUncommonEvents] = useState(false);
  const teamRoster = players.filter((player) => player.team === form.team);
  const teamPlayers = teamRoster.filter((player) => player.active !== false);
  const substitutePlayers = teamRoster.filter((player) => player.active === false);
  const opponentPlayers = players.filter((player) => player.team !== form.team && player.active !== false);
  const outcomeOptions = form.type ? OUTCOME_OPTIONS[form.type] : [];
  const needsReceiver = form.type === "completed-pass" || form.type === "shot" || form.type === "substitution";
  const needsOpponent =
    form.type === "shot" && ["saved", "blocked"].includes(form.outcome);
  const showDirection = form.type === "completed-pass" || form.type === "failed-pass" || form.type === "dribble";
  const setPiecePlays = plays.filter((play) => play.active);

  return (
    <section className="panel event-capture-panel" aria-labelledby="event-capture-title">
      <div>
        <p className="section-kicker">Paused-video event</p>
        <h2 id="event-capture-title">What just happened?</h2>
        <p className="muted">
          Enter the event from the paused video. The app converts your choices into the underlying
          stat entries automatically.
        </p>
      </div>
      {eventRequiredAfterPause ? (
        <p className="event-required-banner">
          Required after pause: log at least one event here before the video can resume.
        </p>
      ) : null}
      <div className="quick-event-grid">
        {EVENT_TYPE_OPTIONS.filter((option) => isCommonEventType(option.value)).map((option) => (
          <button
            type="button"
            className={form.type === option.value ? "quick-event-button active" : "quick-event-button"}
            key={option.value}
            onClick={() =>
              onChange({
                type: option.value,
                outcome: OUTCOME_OPTIONS[option.value][0].value,
                eventSource: option.value === "set-piece" ? "set-piece" : "open-play",
                primaryPlayerId: "",
                secondaryPlayerId: "",
                opponentPlayerId: "",
                direction: "",
                advancedTags: [],
              })
            }
          >
            {option.label}
          </button>
        ))}
      </div>
      {!showUncommonEvents ? (
        <button type="button" onClick={() => setShowUncommonEvents(true)}>
          Show uncommon / advanced event types
        </button>
      ) : (
        <div className="quick-event-grid uncommon">
          {EVENT_TYPE_OPTIONS.filter((option) => UNCOMMON_EVENT_TYPES.includes(option.value)).map((option) => (
            <button
              type="button"
              className={form.type === option.value ? "quick-event-button active" : "quick-event-button"}
              key={option.value}
              onClick={() =>
                onChange({
                  type: option.value,
                  outcome: OUTCOME_OPTIONS[option.value][0].value,
                  eventSource: option.value === "set-piece" ? "set-piece" : "open-play",
                  primaryPlayerId: "",
                  secondaryPlayerId: "",
                  opponentPlayerId: "",
                  direction: "",
                  advancedTags: [],
                })
              }
            >
              {option.label}
            </button>
          ))}
          <button type="button" onClick={() => setShowUncommonEvents(false)}>
            Hide uncommon
          </button>
        </div>
      )}
      {!form.type ? (
        <p className="empty-state">Choose what happened to reveal the event details.</p>
      ) : (
      <>
      <div className="event-step-grid">
        <label>
          1. Event type
          <select
            value={form.type}
            onChange={(event) => {
              const nextType = event.target.value as Exclude<StructuredEventType, "">;
              onChange({
                type: nextType,
                outcome: OUTCOME_OPTIONS[nextType][0].value,
                eventSource: nextType === "set-piece" ? "set-piece" : "open-play",
                primaryPlayerId: "",
                secondaryPlayerId: "",
                opponentPlayerId: "",
                direction: "",
                advancedTags: [],
              });
            }}
          >
            {EVENT_TYPE_OPTIONS.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Team
          <select
            value={form.team}
            onChange={(event) =>
              onChange({
                team: event.target.value as TeamSide,
                primaryPlayerId: "",
                secondaryPlayerId: "",
                opponentPlayerId: "",
              })
            }
          >
            <option value="home">{homeTeam}</option>
            <option value="away">{awayTeam}</option>
          </select>
        </label>
        <label>
          2. Outcome
          <select value={form.outcome} onChange={(event) => onChange({ outcome: event.target.value })}>
            {outcomeOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!showCourtMap ? (
        <div className="court-summary-card">
          <div>
            <p className="section-kicker">Court area</p>
            <strong>
              {optionLabel(FIELD_DEPTH_OPTIONS, form.fieldDepth)} /{" "}
              {optionLabel(FIELD_LANE_OPTIONS, form.fieldLane)}
              {" -> "}
              {optionLabel(FIELD_DEPTH_OPTIONS, form.fieldEndDepth)} /{" "}
              {optionLabel(FIELD_LANE_OPTIONS, form.fieldEndLane)}
            </strong>
          </div>
          <button type="button" onClick={() => setShowCourtMap(true)}>
            Change court area
          </button>
        </div>
      ) : (
      <>
        <div className="court-picker-layout">
        <CourtAreaPicker
          title="Event start"
          depth={form.fieldDepth}
          lane={form.fieldLane}
          onSelect={(fieldDepth, fieldLane) => onChange({ fieldDepth, fieldLane })}
        />
        <CourtAreaPicker
          title="Event end"
          depth={form.fieldEndDepth}
          lane={form.fieldEndLane}
          onSelect={(fieldEndDepth, fieldEndLane) => onChange({ fieldEndDepth, fieldEndLane })}
        />
      </div>
      <button type="button" onClick={() => setShowCourtMap(false)}>
        Collapse court map
      </button>
      </>
      )}
      <div className="event-step-grid">
        <button
          type="button"
          onClick={() => onChange({ fieldEndDepth: form.fieldDepth, fieldEndLane: form.fieldLane })}
        >
          Same start/end area
        </button>
        <label>
          Source
          <select value={form.eventSource} onChange={(event) => onChange({ eventSource: event.target.value as "open-play" | "set-piece" })}>
            <option value="open-play">Open play</option>
            <option value="set-piece">Set piece</option>
          </select>
        </label>
        {form.eventSource === "set-piece" ? (
          <label>
            Set-piece type
            <select value={form.sourceSetPieceCode} onChange={(event) => onChange({ sourceSetPieceCode: event.target.value })}>
              {SET_PIECES.map((piece) => (
                <option value={piece.code} key={piece.code}>
                  {piece.code} - {piece.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {form.eventSource === "set-piece" ? (
          <label>
            Play run
            <select value={form.sourcePlayId} onChange={(event) => onChange({ sourcePlayId: event.target.value })}>
              <option value="">No play tagged</option>
              {setPiecePlays.map((play) => (
                <option value={play.id} key={play.id}>
                  {play.type} - {play.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {form.eventSource === "set-piece" ? (
          <label>
            Set-piece rating
            <select
              value={form.sourceSetPieceRating}
              onChange={(event) => onChange({ sourceSetPieceRating: Number(event.target.value) })}
            >
              {[1, 2, 3, 4, 5].map((rating) => (
                <option value={rating} key={rating}>
                  {rating}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      {form.type !== "note" ? (
        <div className="event-player-panel">
          <p className="section-kicker">Player involvement</p>
          <div className="event-step-grid">
          <label>
            {form.type === "substitution"
              ? "Player leaving"
              : form.type === "set-piece"
                ? "Set-piece taker"
                : "Primary player"}
            <select value={form.primaryPlayerId} onChange={(event) => onChange({ primaryPlayerId: event.target.value })}>
              <option value="">Select player</option>
              {teamPlayers.map((player) => (
                <option value={player.id} key={player.id}>
                  {playerOptionLabel(player)}
                </option>
              ))}
            </select>
          </label>
          {needsReceiver ? (
            <label>
              {form.type === "completed-pass"
                ? "Receiving player"
                : form.type === "substitution"
                  ? "Player entering"
                  : "Assisting player (optional)"}
              <select
                value={form.secondaryPlayerId}
                onChange={(event) => onChange({ secondaryPlayerId: event.target.value })}
              >
                <option value="">{form.type === "substitution" ? "Select substitute" : "None / unknown"}</option>
                {(form.type === "substitution" ? substitutePlayers : teamPlayers).map((player) => (
                  <option value={player.id} key={player.id}>
                    {playerOptionLabel(player)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {needsOpponent || form.type === "engagement" ? (
            <label>
              Opponent involved {needsOpponent ? "" : "(optional)"}
              <select
                value={form.opponentPlayerId}
                onChange={(event) => onChange({ opponentPlayerId: event.target.value })}
              >
                <option value="">None / unknown</option>
                {opponentPlayers.map((player) => (
                  <option value={player.id} key={player.id}>
                    {playerOptionLabel(player)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {showDirection ? (
            <label>
              Direction
              <select value={form.direction} onChange={(event) => onChange({ direction: event.target.value as "" | "left" | "right" })}>
                <option value="">Not tagged</option>
                <option value="left">To player's left</option>
                <option value="right">To player's right</option>
              </select>
            </label>
          ) : null}
          </div>
        </div>
      ) : null}

      <label>
        Event detail
        <textarea
          value={form.detail}
          onChange={(event) => onChange({ detail: event.target.value })}
          placeholder="Example: turnover from unsuccessful pass, Bart to Lola, pressure by Opp C..."
        />
      </label>
      <div className="advanced-chip-panel">
        <p className="section-kicker">Optional advanced details</p>
        <div className="tag-grid">
          {ADVANCED_STATS.map((tag) => {
            const active = form.advancedTags.includes(tag);
            return (
              <button
                type="button"
                className={active ? "tag-button active" : "tag-button"}
                key={tag}
                onClick={() =>
                  onChange({
                    advancedTags: active
                      ? form.advancedTags.filter((value) => value !== tag)
                      : [...form.advancedTags, tag],
                  })
                }
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      <div className="action-row">
        <button type="button" className="primary-action" onClick={onSubmit}>
          Record event
        </button>
      </div>
      </>
      )}
    </section>
  );
}

type AdminOverviewPageProps = {
  match: MatchState;
  activeStats: StatDefinition[];
  teamTotals: Map<string, number>;
  setPieceTotals: Map<string, number>;
  latestEvents: StatEvent[];
  teamName: (team: TeamSide) => string;
  onFinishGame: () => void;
  onExportSummary: () => void;
  onExportEvents: () => void;
  onDeleteEvent: (eventId: string) => void;
  onResetMatch: () => void;
};

function AdminOverviewPage({
  match,
  activeStats,
  teamTotals,
  setPieceTotals,
  latestEvents,
  teamName,
  onFinishGame,
  onExportSummary,
  onExportEvents,
  onDeleteEvent,
  onResetMatch,
}: AdminOverviewPageProps) {
  return (
    <>
      <section className="columns secondary-columns">
        <section className="panel" aria-labelledby="summary-title">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Admin overview</p>
              <h2 id="summary-title">Team stat totals</h2>
            </div>
            <div className="action-row">
              <button type="button" className="primary-action" onClick={onFinishGame}>
                Finish game & update knowledge base
              </button>
              <button type="button" onClick={onExportSummary}>
                Export summary CSV
              </button>
              <button type="button" onClick={onExportEvents}>
                Export event CSV
              </button>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  {activeStats.map((stat) => (
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
                    {activeStats.map((stat) => (
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

        <EventLog
          events={latestEvents}
          title="Latest entries"
          description="Most recent stats, plays, set pieces, and notes."
          teamName={teamName}
          onDelete={onDeleteEvent}
          onReset={onResetMatch}
        />
      </section>

      <section className="panel definitions-panel" aria-labelledby="definitions-title">
        <p className="section-kicker">Definitions tab</p>
        <h2 id="definitions-title">Stat reference</h2>
        <div className="definition-list">
          {match.statDefinitions.map((stat) => (
            <div key={stat.id} className={`definition-item tone-${stat.tone}`}>
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

      <EventLog
        events={match.events}
        title="Full event log"
        description="All plays, stats, set pieces, and notes recorded for this match."
        teamName={teamName}
        onDelete={onDeleteEvent}
      />
    </>
  );
}

type TaggedGameViewPageProps = {
  knowledgeBase: KnowledgeBase;
  teamName: (team: TeamSide) => string;
};

function gameFlowKind(event: StatEvent) {
  if (event.kind === "substitution") return "substitution";
  if (event.kind === "set-piece" || event.eventSource === "set-piece") return "set-piece";
  if (event.statCode === "G") return "goal";
  if (event.statCode === "Sh" || event.statCode === "SoT") return "shot";
  if (event.statCode === "Lp" || event.statCode === "-") return "turnover";
  return "event";
}

function GameFlowVisualization({ game }: { game: GameSnapshot }) {
  const timelineDuration = Math.max(2400, ...game.events.map((event) => event.videoSeconds ?? event.matchSeconds ?? 0), 1);
  const flowEvents = game.events
    .filter((event) => event.videoSeconds !== undefined || event.matchSeconds !== undefined)
    .slice()
    .sort((a, b) => (a.videoSeconds ?? a.matchSeconds ?? 0) - (b.videoSeconds ?? b.matchSeconds ?? 0));

  if (!flowEvents.length) {
    return <p className="empty-state">No timed events were saved for this game.</p>;
  }

  return (
    <div className="game-flow-visualization">
      <div className="game-flow-track" aria-label="Game event flow timeline">
        {flowEvents.map((event) => {
          const seconds = event.videoSeconds ?? event.matchSeconds ?? 0;
          const kind = gameFlowKind(event);
          return (
            <span
              className={`game-flow-marker marker-${kind} marker-${event.team}`}
              key={event.id}
              style={{ left: `${Math.min(100, (seconds / timelineDuration) * 100)}%` }}
              title={`${formatClock(seconds)} ${event.playerName ?? ""} ${
                event.statLabel ?? event.setPieceLabel ?? event.playName ?? event.kind
              }`}
            />
          );
        })}
      </div>
      <div className="game-flow-legend">
        <span className="marker-goal">Goal</span>
        <span className="marker-shot">Shot</span>
        <span className="marker-turnover">Turnover</span>
        <span className="marker-set-piece">Set piece</span>
        <span className="marker-substitution">Substitution</span>
      </div>
    </div>
  );
}

function TaggedGameTimeline({
  game,
}: {
  game: GameSnapshot;
}) {
  const timelineDuration = Math.max(...game.possessionSegments.map((segment) => segment.endSeconds), 1);
  const gameTeamName = (team: TeamSide) => (team === "home" ? game.homeTeam : game.awayTeam);

  return (
    <section className="panel">
      <p className="section-kicker">Tagged game review</p>
      <h2>
        {game.homeTeam} vs {game.awayTeam}
      </h2>
      <h3>Game flow</h3>
      <GameFlowVisualization game={game} />
      <h3>Possession timeline</h3>
      {game.possessionSegments.length ? (
        <>
          <div className="possession-timeline review" aria-label="Tagged game possession timeline">
            {game.possessionSegments.map((segment) => (
              <div
                className={`possession-segment possession-${segment.owner}`}
                key={segment.id}
                title={`${possessionLabel(segment.owner, game.homeTeam, game.awayTeam)} ${formatClock(
                  segment.startSeconds,
                )}-${formatClock(segment.endSeconds)} ${segment.participantPlayerNames.join(" vs ")}`}
                style={{
                  left: `${(segment.startSeconds / timelineDuration) * 100}%`,
                  width: `${((segment.endSeconds - segment.startSeconds) / timelineDuration) * 100}%`,
                }}
              />
            ))}
          </div>
          <div className="possession-legend">
            <span className="legend-item possession-home">{game.homeTeam}</span>
            <span className="legend-item possession-away">{game.awayTeam}</span>
            <span className="legend-item possession-contested">Contested</span>
            <span className="legend-item possession-out">Out of play</span>
          </div>
        </>
      ) : (
        <p className="empty-state">No possession timeline was saved for this game.</p>
      )}
      <EventLog
        events={game.events}
        title="Tagged event log"
        description="Events saved when this game was finished."
        teamName={gameTeamName}
        onDelete={() => undefined}
      />
    </section>
  );
}

function TaggedGameViewPage({ knowledgeBase }: TaggedGameViewPageProps) {
  const [selectedGameId, setSelectedGameId] = useState("");
  const selectedGame =
    knowledgeBase.games.find((game) => game.id === selectedGameId) ?? knowledgeBase.games[0];

  useEffect(() => {
    if (knowledgeBase.games.length && !knowledgeBase.games.some((game) => game.id === selectedGameId)) {
      setSelectedGameId(knowledgeBase.games[0].id);
    }
  }, [knowledgeBase.games, selectedGameId]);

  return (
    <section className="knowledge-page">
      <section className="panel">
        <p className="section-kicker">Tagged game view</p>
        <h2>Review rater-tagged games</h2>
        <p className="muted">
          Select a finished game to review only its tagged possession timeline and event log.
        </p>
        {knowledgeBase.games.length ? (
          <label>
            Game
            <select value={selectedGame?.id ?? ""} onChange={(event) => setSelectedGameId(event.target.value)}>
              {knowledgeBase.games.map((game) => (
                <option value={game.id} key={game.id}>
                  {game.date} - {game.homeTeam} {game.homeScore} / {game.awayScore} {game.awayTeam}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="empty-state">No finished games yet. Finish a rater session to create a tagged game.</p>
        )}
      </section>
      {selectedGame ? <TaggedGameTimeline game={selectedGame} /> : null}
    </section>
  );
}

type StatsSettingsPageProps = {
  stats: StatDefinition[];
  plays: PlayDefinition[];
  onStatChange: (statId: string, patch: Partial<StatDefinition>) => void;
  onStatAdd: () => void;
  onStatRemove: (statId: string) => void;
  onPlayChange: (playId: string, patch: Partial<PlayDefinition>) => void;
  onPlayAdd: (type: PlayType) => void;
  onPlayRemove: (playId: string) => void;
};

type KnowledgeBasePageProps = {
  knowledgeBase: KnowledgeBase;
  statDefinitions: StatDefinition[];
};

function statLabel(code: string, statDefinitions: StatDefinition[]) {
  return statDefinitions.find((stat) => stat.code === code || stat.templateCode === code)?.label ?? code;
}

const RATING_DIMENSIONS: Array<{
  key: keyof RatingScores;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    key: "attack",
    label: "Offensive capability",
    shortLabel: "Offense",
    description:
      "Goals, assists, shots on target, opportunities, key passes, shot assists, progressive passes/carries, successful dribbles, and dangerous set pieces minus wasted chances.",
  },
  {
    key: "defense",
    label: "Defensive capability",
    shortLabel: "Defense",
    description:
      "Saves, defensive stops, interceptions, shot blocks, defensive duels won, possession wins, and forced 2-on-1s minus errors, goals against, and goal-area positioning offenses.",
  },
  {
    key: "possession",
    label: "Possession control",
    shortLabel: "Poss.",
    description:
      "Tagged possession share, completed/received passes, touches, forward/progressive actions, successful dribbles, and restarts won minus misplaced passes, failed dribbles, duel losses, and lost/negative transitions.",
  },
  {
    key: "playstyle",
    label: "Playstyle execution",
    shortLabel: "Style",
    description:
      "Play-tag diversity and volume for teams, plus forward passing, progressive actions, dribble usage, opportunity creation, and transition patterns.",
  },
  {
    key: "discipline",
    label: "Discipline",
    shortLabel: "Disc.",
    description: "Avoiding fouls, cards, DOGSO, 2-on-1 committed calls, and goal-area positioning offenses.",
  },
];

function ratingLabel(key: keyof RatingScores) {
  if (key === "overall") {
    return "Overall";
  }
  return RATING_DIMENSIONS.find((dimension) => dimension.key === key)?.label ?? key;
}

function RatingCards({ ratings }: { ratings: RatingScores }) {
  return (
    <div className="rating-grid">
      {(["overall", ...RATING_DIMENSIONS.map((dimension) => dimension.key)] as Array<keyof RatingScores>).map((key) => (
        <div className="rating-card" key={key}>
          <span>{ratingLabel(key)}</span>
          <strong>{ratings[key]}</strong>
        </div>
      ))}
    </div>
  );
}

function RatingRadar({ ratings }: { ratings: RatingScores }) {
  const center = 120;
  const maxRadius = 88;
  const axisPoints = RATING_DIMENSIONS.map((dimension, index) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / RATING_DIMENSIONS.length;
    const valueRadius = (ratings[dimension.key] / 100) * maxRadius;
    return {
      ...dimension,
      axisX: center + Math.cos(angle) * maxRadius,
      axisY: center + Math.sin(angle) * maxRadius,
      valueX: center + Math.cos(angle) * valueRadius,
      valueY: center + Math.sin(angle) * valueRadius,
      labelX: center + Math.cos(angle) * (maxRadius + 24),
      labelY: center + Math.sin(angle) * (maxRadius + 24),
    };
  });
  const polygon = axisPoints.map((point) => `${point.valueX},${point.valueY}`).join(" ");

  return (
    <div className="radar-card">
      <div>
        <p className="section-kicker">Performance web</p>
        <h3>Capability profile</h3>
      </div>
      <svg className="radar-chart" viewBox="0 0 240 240" role="img" aria-label="Performance radar chart">
        {[0.25, 0.5, 0.75, 1].map((scale) => {
          const ring = RATING_DIMENSIONS.map((_, index) => {
            const angle = -Math.PI / 2 + (index * 2 * Math.PI) / RATING_DIMENSIONS.length;
            return `${center + Math.cos(angle) * maxRadius * scale},${center + Math.sin(angle) * maxRadius * scale}`;
          }).join(" ");
          return <polygon className="radar-ring" points={ring} key={scale} />;
        })}
        {axisPoints.map((point) => (
          <g key={point.key}>
            <line className="radar-axis" x1={center} y1={center} x2={point.axisX} y2={point.axisY} />
            <text className="radar-label" x={point.labelX} y={point.labelY}>
              {point.shortLabel}
            </text>
          </g>
        ))}
        <polygon className="radar-area" points={polygon} />
        {axisPoints.map((point) => (
          <circle className="radar-point" cx={point.valueX} cy={point.valueY} r="4" key={point.key} />
        ))}
      </svg>
    </div>
  );
}

function RatingBreakdown({ isTeam }: { isTeam: boolean }) {
  return (
    <div className="rating-breakdown">
      <p className="section-kicker">How scores are calculated</p>
      <div className="definition-list compact">
        {RATING_DIMENSIONS.map((dimension) => (
          <div key={dimension.key}>
            <strong>{dimension.label}</strong>
            <span>
              {dimension.description}
              {dimension.key === "playstyle" && isTeam
                ? " Team records also use tagged play diversity and frequency."
                : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsBreakdown({ stats, statDefinitions }: { stats: StatTotals; statDefinitions: StatDefinition[] }) {
  const rows = Object.entries(stats).sort((a, b) => a[0].localeCompare(b[0]));
  if (!rows.length) {
    return <p className="empty-state">No stat events have been saved yet.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Stat</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([code, value]) => (
            <tr key={code}>
              <th>{statLabel(code, statDefinitions)}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KnowledgeBasePage({ knowledgeBase, statDefinitions }: KnowledgeBasePageProps) {
  const [viewType, setViewType] = useState<"teams" | "players">("teams");
  const selectedList = viewType === "teams" ? knowledgeBase.teams : knowledgeBase.players;
  const [selectedId, setSelectedId] = useState("");
  const selectedRecord = selectedList.find((record) => record.id === selectedId) ?? selectedList[0];
  const relatedGames = selectedRecord
    ? knowledgeBase.games.filter((game) => selectedRecord.gameIds.includes(game.id))
    : [];

  useEffect(() => {
    if (selectedList.length && !selectedList.some((record) => record.id === selectedId)) {
      setSelectedId(selectedList[0].id);
    }
  }, [selectedId, selectedList]);

  return (
    <section className="knowledge-page">
      <section className="panel">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Knowledge base</p>
            <h2>Players, teams, and prior games</h2>
            <p className="muted">
              Finish a rating session from the tracker to snapshot the game into this local history.
              Team and player quality scores are heuristic summaries from available goals, stat
              counts, negative events, discipline, possession, and tagged playstyle patterns.
            </p>
          </div>
          <div className="action-row">
            <button
              type="button"
              className={viewType === "teams" ? "chip active" : "chip"}
              onClick={() => setViewType("teams")}
            >
              Teams
            </button>
            <button
              type="button"
              className={viewType === "players" ? "chip active" : "chip"}
              onClick={() => setViewType("players")}
            >
              Players
            </button>
          </div>
        </div>
        <div className="knowledge-summary-grid">
          <div className="mini-card">
            <strong>{knowledgeBase.games.length}</strong>
            <span>Finished games</span>
          </div>
          <div className="mini-card">
            <strong>{knowledgeBase.teams.length}</strong>
            <span>Teams</span>
          </div>
          <div className="mini-card">
            <strong>{knowledgeBase.players.length}</strong>
            <span>Players</span>
          </div>
        </div>
      </section>

      <section className="knowledge-layout">
        <section className="panel">
          <p className="section-kicker">{viewType}</p>
          <h2>Saved {viewType}</h2>
          {selectedList.length === 0 ? (
            <p className="empty-state">No {viewType} yet. Finish a game to populate this view.</p>
          ) : (
            <div className="knowledge-list">
              {selectedList.map((record) => (
                <button
                  type="button"
                  className={record.id === selectedRecord?.id ? "knowledge-row active" : "knowledge-row"}
                  key={record.id}
                  onClick={() => setSelectedId(record.id)}
                >
                  <strong>{record.name}</strong>
                  <span>
                    {record.gamesPlayed} games / overall {record.ratings.overall}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          {selectedRecord ? (
            <>
              <p className="section-kicker">Detail view</p>
              <h2>{selectedRecord.name}</h2>
              {"division" in selectedRecord ? (
                <p className="muted">
                  Division {selectedRecord.division} / {selectedRecord.gamesPlayed} games /{" "}
                  {selectedRecord.wins}-{selectedRecord.losses}-{selectedRecord.ties}
                </p>
              ) : (
                <p className="muted">
                  {selectedRecord.teamNames.join(", ") || "No team"} / Division{" "}
                  {selectedRecord.divisions.join(", ") || "unknown"} / {selectedRecord.gamesPlayed} games
                </p>
              )}
              <div className="performance-layout">
                <RatingRadar ratings={selectedRecord.ratings} />
                <div>
                  <RatingCards ratings={selectedRecord.ratings} />
                  <RatingBreakdown isTeam={"division" in selectedRecord} />
                </div>
              </div>
              {"goalsFor" in selectedRecord ? (
                <div className="knowledge-summary-grid">
                  <div className="mini-card">
                    <strong>{selectedRecord.goalsFor}</strong>
                    <span>Goals for</span>
                  </div>
                  <div className="mini-card">
                    <strong>{selectedRecord.goalsAgainst}</strong>
                    <span>Goals against</span>
                  </div>
                  <div className="mini-card">
                    <strong>{formatClock(selectedRecord.possessionSeconds)}</strong>
                    <span>Tagged possession</span>
                  </div>
                  <div className="mini-card">
                    <strong>{formatClock(selectedRecord.outOfPlaySeconds ?? 0)}</strong>
                    <span>Out of play</span>
                  </div>
                </div>
              ) : null}
              {"playStyles" in selectedRecord && Object.keys(selectedRecord.playStyles).length ? (
                <>
                  <h3>Tagged play styles</h3>
                  <StatsBreakdown stats={selectedRecord.playStyles} statDefinitions={statDefinitions} />
                </>
              ) : null}
              <h3>All saved stats</h3>
              <StatsBreakdown stats={selectedRecord.stats} statDefinitions={statDefinitions} />
              <h3>Games</h3>
              {relatedGames.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Game</th>
                        <th>Division</th>
                        <th>Score</th>
                        <th>Events</th>
                      </tr>
                    </thead>
                    <tbody>
                      {relatedGames.map((game) => (
                        <tr key={game.id}>
                          <td>{game.date}</td>
                          <td>
                            {game.homeTeam} vs {game.awayTeam}
                          </td>
                          <td>
                            {game.homeDivision} / {game.awayDivision}
                          </td>
                          <td>
                            {game.homeScore}-{game.awayScore}
                          </td>
                          <td>{game.eventCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-state">No related games found.</p>
              )}
            </>
          ) : (
            <p className="empty-state">Select a saved team or player.</p>
          )}
        </section>
      </section>
    </section>
  );
}

function StatsSettingsPage({
  stats,
  plays,
  onStatChange,
  onStatAdd,
  onStatRemove,
  onPlayChange,
  onPlayAdd,
  onPlayRemove,
}: StatsSettingsPageProps) {
  return (
    <section className="settings-page">
      <section className="panel" aria-labelledby="stat-settings-title">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Definitions</p>
            <h2 id="stat-settings-title">Editable stat definitions</h2>
            <p className="muted">
              Modify abbreviations, names, definitions, value types, display colors, and whether a
              stat appears on rater buttons.
            </p>
          </div>
          <button type="button" className="primary-action" onClick={onStatAdd}>
            Add stat
          </button>
        </div>
        <div className="editable-list">
          {stats.map((stat) => (
            <article className="editable-card" key={stat.id}>
              <div className="settings-grid">
                <label>
                  Active
                  <select
                    value={stat.active ? "yes" : "no"}
                    onChange={(event) => onStatChange(stat.id, { active: event.target.value === "yes" })}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  Abbrev
                  <input
                    value={stat.code}
                    onChange={(event) => onStatChange(stat.id, { code: event.target.value })}
                  />
                </label>
                <label>
                  Template code
                  <input
                    value={stat.templateCode ?? ""}
                    onChange={(event) =>
                      onStatChange(stat.id, { templateCode: event.target.value || undefined })
                    }
                  />
                </label>
                <label>
                  Name
                  <input
                    value={stat.label}
                    onChange={(event) => onStatChange(stat.id, { label: event.target.value })}
                  />
                </label>
                <label>
                  Value type
                  <select
                    value={stat.valueType}
                    onChange={(event) =>
                      onStatChange(stat.id, { valueType: event.target.value as StatValueType })
                    }
                  >
                    {STAT_VALUE_TYPES.map((type) => (
                      <option value={type} key={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Color group
                  <select
                    value={stat.tone}
                    onChange={(event) =>
                      onStatChange(stat.id, { tone: event.target.value as StatDefinition["tone"] })
                    }
                  >
                    {STAT_TONES.map((tone) => (
                      <option value={tone} key={tone}>
                        {tone}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Definition
                <textarea
                  value={stat.detail}
                  onChange={(event) => onStatChange(stat.id, { detail: event.target.value })}
                />
              </label>
              <div className="editable-card-footer">
                <span className={`definition-pill tone-${stat.tone}`}>
                  {stat.templateCode ?? stat.code} / {stat.valueType}
                </span>
                <button type="button" className="danger" onClick={() => onStatRemove(stat.id)}>
                  Delete stat
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="play-settings-title">
        <div className="section-heading-row">
          <div>
            <p className="section-kicker">Play library</p>
            <h2 id="play-settings-title">Editable plays and art links</h2>
            <p className="muted">
              Default play names are seeded from the linked Google Slides summaries. Update names
              and art links here as the playbook evolves.
            </p>
          </div>
          <div className="action-row">
            <button type="button" onClick={() => onPlayAdd("offense")}>
              Add offensive play
            </button>
            <button type="button" onClick={() => onPlayAdd("defense")}>
              Add defensive play
            </button>
          </div>
        </div>
        <div className="editable-list">
          {plays.map((play) => (
            <article className={`editable-card play-edit-card play-${play.type}`} key={play.id}>
              <div className="settings-grid">
                <label>
                  Active
                  <select
                    value={play.active ? "yes" : "no"}
                    onChange={(event) => onPlayChange(play.id, { active: event.target.value === "yes" })}
                  >
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
                <label>
                  Name
                  <input
                    value={play.name}
                    onChange={(event) => onPlayChange(play.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  Type
                  <select
                    value={play.type}
                    onChange={(event) => onPlayChange(play.id, { type: event.target.value as PlayType })}
                  >
                    <option value="offense">Offense</option>
                    <option value="defense">Defense</option>
                  </select>
                </label>
              </div>
              <label>
                Play art link
                <input
                  value={play.artUrl}
                  onChange={(event) => onPlayChange(play.id, { artUrl: event.target.value })}
                  placeholder="https://..."
                />
              </label>
              <label>
                Source link
                <input
                  value={play.sourceUrl ?? ""}
                  onChange={(event) =>
                    onPlayChange(play.id, { sourceUrl: event.target.value || undefined })
                  }
                  placeholder="Optional source deck or document"
                />
              </label>
              <div className="editable-card-footer">
                <span className={`play-pill play-${play.type}`}>{play.type}</span>
                <div className="action-row">
                  {play.artUrl ? (
                    <a href={play.artUrl} target="_blank" rel="noreferrer">
                      Open art
                    </a>
                  ) : null}
                  <button type="button" className="danger" onClick={() => onPlayRemove(play.id)}>
                    Delete play
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function PlayerTeamPanel({ title, players, stats, onPlayerChange, onStat }: PlayerTeamPanelProps) {
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
              {stats.map((stat) => (
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
