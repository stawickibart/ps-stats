# Power Soccer Stats

A browser-based rater console for collecting power soccer match statistics while watching live or recorded play.

## Features

- Editable home/away team names and player/role slots based on the sample spreadsheet layout.
- One-tap stat entry for the definitions sheet: goals, assists, saves, shots, stops, possession wins/losses, transitions, fouls, and 2-on-1s.
- 5-minute time buckets plus extra time to match the spreadsheet template.
- Set-piece tracking with type and 1-5 outcome rating.
- Tagged notes for additional metrics listed in the definitions tab.
- Local browser persistence, latest-entry audit trail, delete/undo-by-entry, and match reset.
- CSV exports for both long-form event logs and spreadsheet-style player/time summaries.
- YouTube video sync that maps video timestamps to match clock, half, and time bucket.

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
6. Optionally type a note for the next event.
7. Tap the stat button on the relevant player card.
8. Use the set-piece panel for KOr, KOb, SIr, SIp, FKI, FKD, Clp, Cls, and Cy events.
9. Export the event log or summary CSV for review or spreadsheet import. Event exports include half, match seconds, video seconds, and video URL.
