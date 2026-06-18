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
2. Optionally type a note for the next event.
3. Tap the stat button on the relevant player card.
4. Use the set-piece panel for KOr, KOb, SIr, SIp, FKI, FKD, Clp, Cls, and Cy events.
5. Export the event log or summary CSV for review or spreadsheet import.
