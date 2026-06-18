export type TeamSide = "home" | "away";
export type PossessionOwner = TeamSide | "contested";

export type PlayerSlot = {
  id: string;
  name: string;
  team: TeamSide;
  role: string;
};

export type StatValueType = "integer" | "decimal" | "string" | "boolean" | "time";

export type StatDefinition = {
  id: string;
  code: string;
  label: string;
  detail: string;
  valueType: StatValueType;
  tone: "attack" | "defense" | "possession" | "negative" | "discipline";
  templateCode?: string;
  active: boolean;
};

export type SetPieceType = {
  code: string;
  label: string;
  detail: string;
};

export type PlayType = "offense" | "defense";

export type PlayDefinition = {
  id: string;
  name: string;
  type: PlayType;
  artUrl: string;
  sourceUrl?: string;
  active: boolean;
};

export type PossessionSegment = {
  id: string;
  owner: PossessionOwner;
  participantPlayerIds: string[];
  participantPlayerNames: string[];
  startSeconds: number;
  endSeconds: number;
};

export type StatEvent = {
  id: string;
  kind: "stat" | "set-piece" | "note" | "play";
  team: TeamSide;
  half?: "first" | "halftime" | "second" | "unknown";
  matchSeconds?: number;
  videoUrl?: string;
  videoId?: string;
  videoSeconds?: number;
  playerId?: string;
  playerName?: string;
  playerRole?: string;
  statCode?: string;
  statLabel?: string;
  statValueType?: StatValueType;
  statValue?: string;
  setPieceCode?: string;
  setPieceLabel?: string;
  setPieceRating?: number;
  playId?: string;
  playName?: string;
  playType?: PlayType;
  playArtUrl?: string;
  bucket: string;
  minute: string;
  note: string;
  recordedAt: string;
};

export const TIME_BUCKETS = [
  "0 - 5",
  "5 - 10",
  "10 - 15",
  "15 - 20",
  "20 - 25",
  "25 - 30",
  "30 - 35",
  "35 - 40",
  "Extra",
];

export const DEFAULT_PLAYERS: PlayerSlot[] = [
  { id: "rock-c", name: "Bart", team: "home", role: "Rock C" },
  { id: "rock-aw", name: "Lola", team: "home", role: "Rock AW" },
  { id: "rock-dw", name: "Max B", team: "home", role: "Rock DW" },
  { id: "rock-g", name: "Max Z", team: "home", role: "Rock G" },
  { id: "rock-flex", name: "Tommy", team: "home", role: "Rock Flex" },
  { id: "opp-c", name: "Opp C", team: "away", role: "Opp C" },
  { id: "opp-aw", name: "Opp AW", team: "away", role: "Opp AW" },
  { id: "opp-dw", name: "Opp DW", team: "away", role: "Opp DW" },
  { id: "opp-g", name: "Opp G", team: "away", role: "Opp G" },
];

export const STAT_DEFINITIONS: StatDefinition[] = [
  {
    id: "goal",
    code: "G",
    label: "Goal",
    detail: "Goal.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "assist",
    code: "A",
    label: "Assist",
    detail: "Assist.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "shot",
    code: "Sh",
    label: "Shot",
    detail: "Shot on goal or near miss.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "opportunity-created",
    code: "Op",
    label: "Opportunity Created",
    detail:
      "Cross, pass to shot from set piece, dribble around leading to own shot, or pass to assist. Multiple players may receive an opportunity for a single shot/goal, but a player can only receive one per shot/goal.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "defensive-stop",
    code: "St",
    label: "Defensive Stop",
    detail:
      "Defensive stop in the penalty area that keeps possession, such as dribbling 5m past the box, earning a side/goal kick, or passing to a teammate with a chance to drive out.",
    valueType: "integer",
    tone: "defense",
    active: true,
  },
  {
    id: "save",
    code: "Sv",
    label: "Save",
    detail:
      "Stopping a ball that otherwise would have gone in the goal. One save per shot/follow-through engagement.",
    valueType: "integer",
    tone: "defense",
    active: true,
  },
  {
    id: "won-possession",
    code: "Wp",
    label: "Won Possession",
    detail:
      "Won possession and kept control by getting a side kick, 2-on-1, drawing a foul, or forcing the opposition to knock it out for a goal kick.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "positive-transition",
    code: "+",
    label: "Positive Transition",
    detail:
      "A pass or dribble that flips play from box to box or creates an attacking opportunity. Multiple players may receive one + for the transition.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "negative-transition",
    code: "-",
    label: "Negative Transition",
    detail:
      "A turnover or mistake that flips play from box to box or creates an attacking opportunity for the opposition.",
    valueType: "integer",
    tone: "negative",
    active: true,
  },
  {
    id: "lost-possession",
    code: "Lp",
    label: "Lost Possession",
    detail:
      "Lost possession and allowed opposition control by giving up a side kick, 2-on-1, offensive foul, or goal kick.",
    valueType: "integer",
    tone: "negative",
    active: true,
  },
  {
    id: "wasted-opportunity",
    code: "Wo",
    label: "Wasted Opportunity",
    detail:
      "Positioning mistake, missed technique, late reaction, or similar issue that wastes a good pass or opportunity.",
    valueType: "integer",
    tone: "negative",
    active: true,
  },
  {
    id: "error-leading-to-chance",
    code: "Er",
    label: "Error Leading to Chance",
    detail:
      "Error leading to a goal or clear scoring chance requiring a save, such as a positioning mistake, lost 1-on-1, turnover, foul, or 2-on-1 near goal.",
    valueType: "integer",
    tone: "negative",
    active: true,
  },
  {
    id: "foul",
    code: "Fl",
    label: "Foul",
    detail: "Foul.",
    valueType: "integer",
    tone: "discipline",
    active: true,
  },
  {
    id: "two-on-one",
    code: "2o1",
    templateCode: "2on1",
    label: "2-on-1",
    detail: "Both involved players are assigned a 2-on-1 regardless of fault.",
    valueType: "integer",
    tone: "discipline",
    active: true,
  },
];

export const STAT_VALUE_TYPES: StatValueType[] = ["integer", "decimal", "string", "boolean", "time"];

export const ADVANCED_STATS = [
  "Pass success rate",
  "Type of pass",
  "Dribble success rate",
  "Type of dribble",
  "Type of set piece",
  "Type of defense",
  "Type of possession win/loss",
  "Type of wasted opportunity",
  "Big opportunity created",
  "Big opportunity wasted/converted",
  "Subs",
  "Expected goal rate",
  "Possession %",
  "Possession distribution by quadrant",
  "Possession by player",
  "Classification",
];

export const SET_PIECES: SetPieceType[] = [
  { code: "KOr", label: "Kickoff received", detail: "Kickoff or restart received." },
  { code: "KOb", label: "Kickoff by us", detail: "Kickoff or restart taken by our team." },
  { code: "SIr", label: "Side-in received", detail: "Side-in received/defended." },
  { code: "SIp", label: "Side-in played", detail: "Side-in played by our team." },
  { code: "FKI", label: "Free kick indirect", detail: "Indirect free kick." },
  { code: "FKD", label: "Free kick direct", detail: "Direct free kick." },
  { code: "Clp", label: "Clearance played", detail: "Clearance played." },
  { code: "Cls", label: "Clearance stopped", detail: "Clearance stopped or defended." },
  { code: "Cy", label: "Corner/yardage", detail: "Corner or yardage sequence." },
];

export const PLAY_MEMORY_GUIDE = [
  { set: "GK", option1: "Outside Cover/ZigZag", option2: "Squeeze" },
  { set: "SI", option1: "Wall", option2: "1 press, 1 attack" },
  { set: "FKI", option1: "Wall/Box Shield", option2: "1 press, 1 attack" },
  { set: "FKD", option1: "Wall/Box Shield", option2: "1 press, 1 attack" },
  { set: "C", option1: "L", option2: "Center Drifts" },
];

const OFFENSIVE_OPTIONS_SLIDE =
  "https://docs.google.com/presentation/d/1wBEHBsox4MGr2oVqjm_64W5oeayWVubmGtGuTwDE9A4/edit?slide=id.g39cb69dda1a_0_733#slide=id.g39cb69dda1a_0_733";

const DEFENSIVE_OPTIONS_SLIDE =
  "https://docs.google.com/presentation/d/1wBEHBsox4MGr2oVqjm_64W5oeayWVubmGtGuTwDE9A4/edit?slide=id.g39cb69dda1a_0_708#slide=id.g39cb69dda1a_0_708";

export const DEFAULT_PLAYS: PlayDefinition[] = [
  {
    id: "offense-goal-kick-stack",
    name: "Goal kick - Stack",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-goal-kick-basic",
    name: "Goal kick - Basic",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-side-kick-own-half-basic",
    name: "Side kick own half - Basic",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-side-kick-mid-tap-in",
    name: "Side kick mid - Tap-in",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-mid-court-basic",
    name: "Mid court - Basic",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-side-kick-near-box-basic",
    name: "Side kick near box - Basic",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-side-kick-wall-basic",
    name: "Side kick wall - Basic",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-top-box-indirect-middle-basic",
    name: "Top box indirect middle - Basic",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-top-box-indirect-side-basic",
    name: "Top box indirect side - Basic",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-corner-basic",
    name: "Corner - Basic",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "offense-corner-boom-boom",
    name: "Corner - Boom-boom",
    type: "offense",
    artUrl: OFFENSIVE_OPTIONS_SLIDE,
    sourceUrl: OFFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "defense-goal-kick-50-50-or-shell",
    name: "Goal kick - 50/50 or Shell",
    type: "defense",
    artUrl: DEFENSIVE_OPTIONS_SLIDE,
    sourceUrl: DEFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "defense-side-kick-own-half-open",
    name: "Side kick own half - Open",
    type: "defense",
    artUrl: DEFENSIVE_OPTIONS_SLIDE,
    sourceUrl: DEFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "defense-side-kick-mid-funnel",
    name: "Side kick mid - Funnel",
    type: "defense",
    artUrl: DEFENSIVE_OPTIONS_SLIDE,
    sourceUrl: DEFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
  {
    id: "defense-mid-court-arrow",
    name: "Mid court - Arrow",
    type: "defense",
    artUrl: DEFENSIVE_OPTIONS_SLIDE,
    sourceUrl: DEFENSIVE_OPTIONS_SLIDE,
    active: true,
  },
];

export function createEventId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function csvEscape(value: string | number | boolean | undefined) {
  const raw = value === undefined ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number | boolean | undefined>>) {
  const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
