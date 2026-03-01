Example replays
================

This folder contains example replay files and instructions for generating new examples.

- `sample-replay.json` — minimal example demonstrating the JSON replay format: `{ id, seed, actions, score, floor, date }`.

Generating real sample replays
-----------------------------
1. Run the app (`npm run dev`).
2. Play an arcade run to completion (or as far as you want).
3. Open the Replay Manager (top-right), select a saved run and choose Export.
4. Copy the exported JSON into this `examples/` folder and update its filename and README entry.

Notes
-----
- For server verification testing, export a completed run (that reached the final arcade floor) and include the `fingerprint` field if you want the client to compute it before submitting remotely.
- Example replays in this folder are for developer and QA usage only.
