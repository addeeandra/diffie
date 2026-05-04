# Roadmap

This roadmap follows the constraints in `README.md`. Diffie should become good at one thing before it grows wider.

## Product direction

Build a browser-first PostgreSQL snapshot diff viewer that:

- runs locally
- prioritizes `INSERT INTO ... VALUES` dumps
- handles small snapshots well
- produces a good print-media result

## Phase 0 — scaffold and boundaries

Status: complete

- [x] re-initialize the repository with Vue 3 + Vite + TypeScript
- [x] keep the original prototype in `prototype/`
- [x] add baseline directory structure
- [x] wire up Vitest
- [x] add initial print stylesheet foundation
- [x] establish top-level project docs

## Phase 1 — PostgreSQL parser foundation

Status: in progress

- [x] implement statement extraction for PostgreSQL `INSERT INTO ... VALUES`
- [x] implement tuple splitting robustly
- [x] implement scalar value parsing
- [x] merge repeated inserts into a normalized snapshot shape
- [x] handle quoted identifiers and common whitespace variation
- [ ] reject or surface unsupported syntax clearly
- [x] add parser regression fixtures

## Phase 2 — diff engine

Status: in progress

- [x] implement table-level diffing
- [x] implement row-level diffing
- [x] implement cell-level change reporting
- [x] detect row keys with priority for `id` and `uuid`
- [x] support positional fallback when no stable key is available
- [x] surface warnings when fallback matching is used

## Phase 3 — first usable UI

Status: in progress

- [x] replace scaffold landing screen with import workflow
- [x] add Snapshot A / Snapshot B paste areas
- [x] add file upload and drag-and-drop
- [x] run parse + diff in a Web Worker
- [x] show parser errors and warnings clearly
- [x] render a first pass of summary cards and table diff sections

## Phase 4 — usability polish

Status: in progress

- [x] add table search
- [x] add status filters
- [x] add show / hide unchanged rows
- [x] add show changed columns only
- [x] show which key strategy was used per table
- [x] prepare print-focused UI states

## Phase 5 — print-media quality

Status: in progress

- [x] define print layout behavior for long diffs
- [x] hide interactive controls in print mode
- [ ] ensure changed sections print with strong visual hierarchy
- [x] keep printing useful when saving as PDF
- [ ] verify page-break behavior on large tables

## Phase 6 — later evaluation

Status: deferred

- [ ] consider secondary support for PostgreSQL `COPY ... FROM stdin`
- [ ] evaluate whether browser performance remains sufficient
- [ ] evaluate Tauri packaging only if real usage demands it
- [ ] decide whether a richer report/export format is still needed after print mode matures

## Explicit non-goals for V1

- MySQL support
- JSON input
- Laravel backend
- live database connections
- generic SQL parser ambitions
- server-side processing

## Working rule

If a feature makes the PostgreSQL `INSERT` path less clear or less testable, it should probably wait.
