# Rater workflow and stat taxonomy notes

## Rater workflow goals

The rater UI is designed around a repeated loop:

1. Set the next time-tracking state.
2. Play the video.
3. Pause after a meaningful event.
4. Describe the event through a compact template.
5. Choose the next possession/time-tracking state.
6. Resume video.

The app intentionally blocks playback during match action until required tracking fields are complete. This is meant to avoid unclassified viewed video time.

Calibration is treated differently. The rater can freely play/pause while finding:

- first-half start
- first-half end
- second-half start
- second-half end

## Current event template split

Common templates are shown first:

- Completed pass
- Failed pass
- Dribble / carry
- Shot
- Turnover
- Engagement / duel

Uncommon / advanced templates are hidden behind a reveal:

- Set piece
- Substitution
- Note

This split is based on expected frequency during live rating. It can be revisited after real rater feedback.

## Event details that are intentionally nested

Team plays are considered details of set pieces. They represent the play run during a restart, not a separate live-play event.

Advanced observations are considered details of an event. They are optional chips on the event form rather than separate primary actions.

Substitutions are treated as out-of-play events because substitution should only happen when the current time-tracking state is out of play.

## Court location taxonomy

The visual court picker maps a power soccer court to a 7-by-5 grid.

Depth bands:

- Own goal-line
- Own goal area
- Own build-up
- Mid court
- Attacking build-up
- Opposition goal area
- Opposition goal-line

Lane bands:

- Left sideline
- Left channel
- Middle
- Right channel
- Right sideline

The taxonomy preserves the earlier export fields (`fieldDepth`, `fieldLane`) while making the rater interact with a visual court. Events can have both a start and end court area so movement can be represented, for example a carry from left sideline in own build-up to right channel in attacking build-up.

## Possession/time tracking taxonomy

The timeline supports:

- Home possession
- Away possession
- Contested possession
- Out of play

Player context requirements:

- Home possession: one active home player
- Away possession: one active away player
- Contested: one active player from each team
- Out of play: no player

Substitution updates the active-player list, and future tagging uses only active players.

## Default teams and roster

Defaults are intentionally editable.

Ducks:

- 1 - Bart
- 2 - Stan
- 3 - Ryan
- 4 - Max

Steamrollers:

- 1 - Lucas
- 2 - Jairo
- 3 - Matt
- 4 - Lola

Positions:

- 1 - Goalie
- 2 - Center
- 3 - Near Wing
- 4 - Far Wing

At first-half start, the rater selects the team with the ball. The app assumes that team’s Center (2) has possession.

## Stat taxonomy rationale

Defaults combine:

- the original spreadsheet definitions
- DataMB-inspired concepts that transfer to power soccer
- USPSA-relevant power soccer concepts

Included examples:

- pass attempts/completions/misplaced passes
- progressive passes/carries
- successful dribbles
- key passes / shot assists
- interceptions
- shot blocks
- duels won/lost
- fouls suffered
- cards
- free kicks, kick-ins, goal kicks, corners, penalties
- 2-on-1 forced / committed
- goal-area positioning offense
- DOGSO

Intentionally excluded:

- aerial duels
- headed goals
- offsides

These do not map cleanly to power soccer rules or typical power soccer action.

## Quality-score caveat

The knowledge-base radar scores are heuristics. They are useful for directional comparison, not official performance grades.

Current dimensions:

- Offensive capability
- Defensive capability
- Possession control
- Playstyle execution
- Discipline
- Overall

The formulas reward tagged positive actions and penalize negative events, but they are only as accurate as the collected data.
