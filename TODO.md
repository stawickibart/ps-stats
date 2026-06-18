# TODO

> Note: Items in this file are informational backlog notes only. Ignore them during prompt execution unless a user explicitly asks to work on or reference TODO items. Any updates to this file require direct user confirmation.

- create rater burn in/quality tasks and tracking
- set up db behind all this and figure out where/how to host
- add accounts/users/profiles with persistent states
- look online for definitions of advanced stats like expected goals/game score/etc. for soccer players, put them through the same filter for applying to power soccer, and add them -- ensure that all advanced stats can be calculated from what is tagged in the rater flows
- add an onboarding/sample walkthrough mode
- add reset local data and clear seeded data admin controls
- add import/export for full app state JSON
- add keyboard shortcuts for rater flow
- add a post-game review checklist
- add a deployment/status note in the UI that data is local to this browser
- the rater console portion beyond the first step greying out UI is not working, there should be a what is completed vs. not UI similar to the one on the first step functioning through the whole rater console, particularly the pause event step
- need a data model for each of the tracked events, vs advanced stats, one should be calculated by the other, all places where a rater tags an advanced stats should be removed -- things like play type/type of kick should be added to the event details
- open text field should be auto consumed into a summary to populate the team profiles in the admin view
- Initial play type should always be set piece/kick off
- The current location/type of event should be inferred from the end point of the prior event/needs some logic
