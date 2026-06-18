# Power Soccer Stats

A browser-based rater console for collecting power soccer match statistics while watching live or recorded play.

## Features

- Editable home/away team names and player/role slots based on the sample spreadsheet layout.
- One-tap stat entry for the definitions sheet: goals, assists, saves, shots, stops, possession wins/losses, transitions, left/right pass or dribble side, fouls, and 2-on-1s.
- 5-minute time buckets plus extra time to match the spreadsheet template.
- Set-piece tracking with type and 1-5 outcome rating.
- Tagged notes for additional metrics listed in the definitions tab.
- Local browser persistence, latest-entry audit trail, delete/undo-by-entry, and match reset.
- CSV exports for both long-form event logs and spreadsheet-style player/time summaries.
- YouTube video sync that maps video timestamps to match clock, half, and time bucket.
- Possession timer with home/away/contested selections, required player context, and a colored video timeline.
- Editable stat definitions with abbreviation, display name, definition, value type, color group, and active status.
- Editable play library with offensive/defensive type, play name, play art link, and source link.
- Unified event log with distinct visual treatments for stats, plays, set pieces, and notes.
- Knowledge base for finished games, teams, players, divisions, prior stats, heuristic quality scores, and radar-style capability diagrams.

## Run locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Rater workflow

1. Enter team names, current clock, and the active time bucket.
2. Load a YouTube video URL or ID in the video sync panel.
3. Choose whether the video starts in the first or second half, and enter the match clock at the start of the video.
4. As the video plays, mark the first-half start, first-half end, and second-half start when those moments occur.
5. Skip around the video as needed. When video sync is enabled, the match clock and time bucket update from the current playback position.
6. Select possession: home, away, or contested. Also select the player in possession for home/away, or the two players contesting possession for contested.
7. The active possession and selected player context are tracked while the video plays forward and appear in the timeline under the video.
8. If you rewind into already-tagged possession time and choose a different possession or player context, confirm the override before later possession tags are trimmed and replaced.
9. Optionally type a note for the next event.
10. Optionally enter a value for the next stat if the stat definition uses a value type other than a simple count.
11. Tap the stat button on the relevant player card.
12. Use the play tagging panel to record which offensive or defensive play a team is running.
13. Use the set-piece panel for KOr, KOb, SIr, SIp, FKI, FKD, Clp, Cls, and Cy events.
14. Click **Finish game & update knowledge base** to snapshot the game into player/team history.
15. Export the event log or summary CSV for review or spreadsheet import. Event exports include half, match seconds, video seconds, video URL, stat values, and play art links.

## Knowledge base

The **Knowledge base** view stores finished games locally and rolls them up into player and team records. Game metadata includes:

- game date
- home and away teams
- home and away divisions, defaulting to `104`
- score, event count, stat totals, and tagged possession

Team and player detail views show all saved stats plus heuristic quality scores for offensive capability, defensive capability, possession control, playstyle execution, discipline, and overall performance. A radar-style web diagram visualizes those dimensions. These scores are derived only from available tagged data, so they should be treated as directional review aids rather than official ratings.

## Editing stats and plays

Open **Stats & plays settings** in the app to:

- add, delete, activate, or deactivate stats
- change stat abbreviations, names, definitions, value types, and color groups
- add offensive or defensive plays
- edit play names and links to play art

The default offensive and defensive play names are seeded from the linked Google Slides summaries, with each default pointing back to the relevant slide as its play-art/source link.
