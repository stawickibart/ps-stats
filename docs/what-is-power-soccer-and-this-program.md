# What is power soccer and this program?

This document is a quick ramp-up guide for future agents, contributors, and reviewers.

## What is power soccer?

Power soccer, also called powerchair football, is an indoor team sport played by athletes using powered wheelchairs. Players use footguards attached to the front of the chair to move and strike a large ball. The game is usually played on a hard indoor court, commonly a basketball-court-sized surface.

High-level characteristics relevant to this app:

- Teams have up to four active players on court, including a goalkeeper.
- Current default positions in this app are:
  - `1 - Goalie`
  - `2 - Center`
  - `3 - Near Wing`
  - `4 - Far Wing`
- The court has goal areas/boxes near each goal, touch lines/sidelines, goal lines, and a halfway/mid-court area.
- There are no soccer concepts like aerial duels, headed goals, or offsides in the same way as running soccer.
- Power soccer has important sport-specific constraints such as:
  - 2-on-1 positioning/offenses
  - goal-area positioning offenses
  - out-of-play states
  - set-piece restarts such as kick-ins, goal kicks, corner kicks, direct/indirect free kicks, and set balls
  - substitutions during stoppages/out-of-play

## What is this program?

This program is a browser-based power soccer match rating and stat collection tool.

It is currently a static React/Vite app with:

- no backend
- no database
- no authentication
- browser `localStorage` persistence
- GitHub Pages deployment
- CSV exports
- YouTube video embedding and video-time synchronization

The app is meant to let a human rater watch a match video, pause after meaningful actions, and tag structured events that are converted into lower-level stat records.

## Main user roles

The app currently has UI-only roles. There are no actual accounts or permissions yet.

### Rater

The rater workspace is for match tagging:

- load a YouTube video
- calibrate first-half and second-half timing
- select possession/time state
- pause video and record structured events
- tag court location visually
- tag substitutions while out of play
- save/finish a game into the local knowledge base

### Admin

The admin workspace is for setup and review:

- manage stat definitions
- manage play definitions
- view knowledge-base player/team/game data
- view seeded or completed tagged games
- inspect event logs and possession timelines
- export CSVs

## Rater flow in plain language

The desired rating rhythm is:

1. Select **Rater**.
2. Load the match video.
3. Before rating starts, fill in:
   - game location
   - active players
   - substitutes
   - starting team with the ball
4. Mark where the first half starts.
5. The app assumes the selected team’s Center (`2`) starts in possession.
6. Play the video.
7. Pause after an event.
8. Choose an event template:
   - completed pass
   - failed pass
   - dribble/carry
   - shot
   - turnover
   - engagement/duel
   - set piece
   - substitution
   - note
9. Fill the dynamic details requested by that event.
10. Select or confirm the next possession/time-tracking state.
11. Resume video.

The app blocks match-action playback when key state is missing so that viewed time does not go unclassified.

## Event and stat model

The rater enters high-level structured events. The app converts those into one or more `StatEvent` records.

Examples:

- Completed pass:
  - pass attempt
  - pass completed
  - pass received
  - optional left/right direction
  - optional key pass / shot assist / assist
- Failed pass turnover:
  - pass attempt
  - misplaced pass
  - lost possession
  - negative transition
- Shot saved:
  - shot
  - shot on target
  - save for the defender/goalkeeper
- Set piece:
  - set-piece event
  - set-piece type
  - set-piece rating
  - optional play run
  - optional result stats
- Substitution:
  - substitution event
  - player out
  - player in
  - updates active players for future tagging

## Court location model

The event form uses a visual court map rather than text dropdowns.

The court is represented as a 7-by-5 grid.

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

Events can have a start and end court location, so movement can be represented.

Example:

> Dribble from own build-up / left sideline to attacking build-up / right channel.

## Possession/time tracking model

The possession timeline supports:

- home possession
- away possession
- contested possession
- out of play

Required player context:

- home possession: one active home player
- away possession: one active away player
- contested: one active player from each team
- out of play: no player

When video plays forward, the current possession/time state is applied to the timeline until the state changes.

## Defaults

Default teams:

- Home: Ducks
- Away: Steamrollers

Default active players:

Ducks:

- `1 - Bart`
- `2 - Stan`
- `3 - Ryan`
- `4 - Max`

Steamrollers:

- `1 - Lucas`
- `2 - Jairo`
- `3 - Matt`
- `4 - Lola`

The app also includes editable substitute slots.

## Seed data

The app creates fake tagged games on first load so admin views are useful immediately.

Seed games are intended only as demo data:

- 40 minutes
- 3-10 total goals
- approximate time split:
  - about 20% contested
  - about 15-30% for each team
  - about 40-50% out of play
- event logs
- possession timelines
- team/player knowledge-base rollups

## Quality scores

The admin knowledge base includes heuristic ratings, not official grades.

Dimensions:

- offensive capability
- defensive capability
- possession control
- playstyle execution
- discipline
- overall

These scores depend on what raters tag. They should be treated as directional review aids.

## Important reference links shared so far

### Spreadsheet/stat collection references

- Stat definitions tab:  
  https://docs.google.com/spreadsheets/d/1H1CMzRVzcOaMIlz2OFyFIsJ5LLSwC7-FZgpa9osUCB8/edit?gid=1878705017#gid=1878705017
- Sample UI/template tab:  
  https://docs.google.com/spreadsheets/d/1H1CMzRVzcOaMIlz2OFyFIsJ5LLSwC7-FZgpa9osUCB8/edit?gid=0#gid=0

### Sample video

- YouTube sample video:  
  https://youtube.com/watch?v=2pcXGp8v4-s&feature=youtu.be

### Playbook / play defaults

- Offensive options slide:  
  https://docs.google.com/presentation/d/1wBEHBsox4MGr2oVqjm_64W5oeayWVubmGtGuTwDE9A4/edit?slide=id.g39cb69dda1a_0_733#slide=id.g39cb69dda1a_0_733
- Defensive options slide:  
  https://docs.google.com/presentation/d/1wBEHBsox4MGr2oVqjm_64W5oeayWVubmGtGuTwDE9A4/edit?slide=id.g39cb69dda1a_0_708#slide=id.g39cb69dda1a_0_708
- Court/playbook slide reference:  
  https://docs.google.com/presentation/d/1wBEHBsox4MGr2oVqjm_64W5oeayWVubmGtGuTwDE9A4/edit?slide=id.g39cb69dda1a_0_688#slide=id.g39cb69dda1a_0_688
- Court/playbook slide reference:  
  https://docs.google.com/presentation/d/1wBEHBsox4MGr2oVqjm_64W5oeayWVubmGtGuTwDE9A4/edit?slide=id.g39cb69dda1a_0_661#slide=id.g39cb69dda1a_0_661

### Rules / court references

- USPSA Laws of the Game PDF:  
  https://cdn.prod.website-files.com/673d021d84f6e2a9d8e3ca2d/6769df834c49b3d55e2c9965_USPSA%20LOTG%20Aug%202021.pdf
- Power Soccer Shop rules PDF:  
  https://powersoccershop.com/rules.pdf
- Intro article with court/rule discussion:  
  https://blakewatson.com/ihs/introducing-the-jackson-jammers/

### Soccer/stat inspiration references

- DataMB guide:  
  https://datamb.football/guide/
- DataMB midfielder radar example:  
  https://datamb.football/midfielders/

## Notes for future changes

If future agents add backend persistence, preserve the current local model concepts:

- `StatDefinition`
- `StatEvent`
- `PossessionSegment`
- `GameSnapshot`
- `TeamKnowledge`
- `PlayerKnowledge`

These are the natural boundaries for database tables or API resources.
