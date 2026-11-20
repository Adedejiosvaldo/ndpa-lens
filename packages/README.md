# packages

Shared libraries for the Stage 1 apps. Each one is added by its own step in `docs/stage1/tracker.md`:

- `schema`: Zod types for jobs, findings, packs and errors (Step 03)
- `scan-engine`: browser capture, preflight and discovery, taken from `apps/legacy-scanner/src/lib` (Steps 14–17)
- `vendors`: tracker and vendor list with GeoIP (Step 18)
- `checks`: checks C-01 to C-20 over stored evidence (Steps 20–21)
- `pdf`: evidence pack templates (Step 25)

New packages extend `../tsconfig.base.json`.
