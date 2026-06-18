export type TeamSide = "home" | "away";
export type PossessionOwner = TeamSide | "contested" | "out";

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
    id: "pass-dribble-left-side",
    code: "Lft",
    label: "Pass/Dribble Left",
    detail: "Pass or dribble directed to the receiving player's left side.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "pass-dribble-right-side",
    code: "Rgt",
    label: "Pass/Dribble Right",
    detail: "Pass or dribble directed to the receiving player's right side.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "touch-possession",
    code: "Tch",
    label: "Touch / Ball Possession",
    detail: "Player has possession or a meaningful touch/control action on the ball.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "pass-received",
    code: "Rec",
    label: "Pass Received",
    detail: "Player receives a pass from a teammate.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "pass-attempt",
    code: "Pas",
    label: "Pass Attempt",
    detail: "Intentional pass attempted by the player.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "pass-completed",
    code: "Pc",
    label: "Pass Completed",
    detail: "Intentional pass successfully reaches a teammate.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "misplaced-pass",
    code: "Mp",
    label: "Misplaced Pass",
    detail: "Intentional pass that fails to reach a teammate or creates a turnover risk.",
    valueType: "integer",
    tone: "negative",
    active: true,
  },
  {
    id: "forward-pass",
    code: "FwdP",
    label: "Forward Pass",
    detail: "Pass played toward the attacking goal rather than sideways or backwards.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "backward-pass",
    code: "BwdP",
    label: "Backward Pass",
    detail: "Pass played away from the attacking goal to recycle possession or escape pressure.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "progressive-pass",
    code: "ProgP",
    label: "Progressive Pass",
    detail: "Pass that significantly advances the ball toward the opponent goal or into a more dangerous area.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "progressive-carry",
    code: "ProgC",
    label: "Progressive Carry",
    detail: "Dribble/carry that significantly advances the ball toward the opponent goal or into a more dangerous area.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "dribble-attempt",
    code: "DrbA",
    label: "Dribble Attempt",
    detail: "Attempt to beat pressure or move past an opponent while carrying the ball.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "successful-dribble",
    code: "DrbS",
    label: "Successful Dribble",
    detail: "Dribble/carry successfully beats pressure or gets past an opponent without losing possession.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "key-pass",
    code: "KP",
    label: "Key Pass",
    detail: "Open-play pass that directly leads to a shot or clear scoring opportunity.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "shot-assist",
    code: "ShA",
    label: "Shot Assist",
    detail: "Pass that directly leads to a teammate's shot.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "pre-assist",
    code: "PreA",
    label: "Pre-Assist",
    detail: "Pass or action that directly leads to the assist before a goal.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "shot-on-target",
    code: "SoT",
    label: "Shot on Target",
    detail: "Shot that is on frame and would require a save or score if not stopped.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "touch-in-goal-area",
    code: "TGA",
    label: "Touch in Goal Area",
    detail: "Attacking touch or controlled possession inside the opponent goal area.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "interception",
    code: "Int",
    label: "Interception",
    detail: "Player cuts out or intercepts an opponent pass or intended ball movement.",
    valueType: "integer",
    tone: "defense",
    active: true,
  },
  {
    id: "shot-block",
    code: "Blk",
    label: "Shot Block",
    detail: "Player blocks an opponent shot before it reaches goal.",
    valueType: "integer",
    tone: "defense",
    active: true,
  },
  {
    id: "defensive-duel-won",
    code: "DDw",
    label: "Defensive Duel Won",
    detail: "Player wins a contested defensive ground/footguard challenge for the ball.",
    valueType: "integer",
    tone: "defense",
    active: true,
  },
  {
    id: "offensive-duel-won",
    code: "ODw",
    label: "Offensive Duel Won",
    detail: "Player in possession wins a contested challenge and keeps or improves possession.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "duel-lost",
    code: "DuL",
    label: "Duel Lost",
    detail: "Player loses a contested ball/footguard challenge.",
    valueType: "integer",
    tone: "negative",
    active: true,
  },
  {
    id: "foul-suffered",
    code: "FS",
    label: "Foul Suffered",
    detail: "Player is fouled or illegally impeded by an opponent.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "free-kick-won",
    code: "FKW",
    label: "Free Kick Won",
    detail: "Player action earns a direct or indirect free kick for the team.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "direct-free-kick-taken",
    code: "DFK",
    label: "Direct Free Kick Taken",
    detail: "Player takes a direct free kick, including direct attempts on goal.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "indirect-free-kick-taken",
    code: "IFK",
    label: "Indirect Free Kick Taken",
    detail: "Player takes an indirect free kick restart.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "kick-in-taken",
    code: "KI",
    label: "Kick-In Taken",
    detail: "Player takes a kick-in restart from the touch line.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "goal-kick-taken",
    code: "GK",
    label: "Goal Kick Taken",
    detail: "Player takes a goal kick restart from the goal area.",
    valueType: "integer",
    tone: "possession",
    active: true,
  },
  {
    id: "corner-taken",
    code: "CK",
    label: "Corner Taken",
    detail: "Player takes a corner kick restart.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "penalty-attempt",
    code: "PKA",
    label: "Penalty Attempt",
    detail: "Player attempts a penalty kick.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "penalty-goal",
    code: "PKG",
    label: "Penalty Goal",
    detail: "Player scores from a penalty kick.",
    valueType: "integer",
    tone: "attack",
    active: true,
  },
  {
    id: "yellow-card",
    code: "YC",
    label: "Yellow Card",
    detail: "Player is cautioned with a yellow card.",
    valueType: "integer",
    tone: "discipline",
    active: true,
  },
  {
    id: "red-card",
    code: "RC",
    label: "Red Card",
    detail: "Player is sent off with a red card.",
    valueType: "integer",
    tone: "discipline",
    active: true,
  },
  {
    id: "two-on-one-forced",
    code: "2o1F",
    label: "2-on-1 Forced",
    detail: "Player pressure or positioning helps force the opponent into a penalized 2-on-1 offense.",
    valueType: "integer",
    tone: "defense",
    active: true,
  },
  {
    id: "two-on-one-committed",
    code: "2o1C",
    label: "2-on-1 Committed",
    detail: "Player is part of a teammate pair penalized for an active-play 2-on-1 offense.",
    valueType: "integer",
    tone: "discipline",
    active: true,
  },
  {
    id: "goal-area-positioning-offense",
    code: "GAP",
    label: "Goal Area Positioning Offense",
    detail: "Player/team is involved in a penalized goal-area positioning offense.",
    valueType: "integer",
    tone: "discipline",
    active: true,
  },
  {
    id: "denied-obvious-goal-scoring-opportunity",
    code: "DOGSO",
    label: "Denied Obvious Scoring Opportunity",
    detail: "Player commits an offense judged to deny an obvious goal-scoring opportunity.",
    valueType: "integer",
    tone: "discipline",
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
