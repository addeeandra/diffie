# Roadmap

This roadmap is intentionally narrow. Diffie should become good at one thing before it grows wider.

## Product direction

Build a browser-first PostgreSQL snapshot diff viewer that:

- runs locally
- prioritizes `INSERT INTO ... VALUES` dumps
- handles small snapshots well
- produces a good print-media result

## Phase 0 — scaffold and boundaries

Status: in progress

- [x] re-initialize the repository with Vue 3 + Vite + TypeScript
- [x] keep the original prototype in `prototype/`
- [x] add baseline directory structure
- [x] wire up Vitest
- [x] add initial print stylesheet foundation
- [x] establish top-level project docs

## Phase 1 — PostgreSQL parser foundation

Status: next

- [ ] implement statement extraction for PostgreSQL `INSERT INTO ... VALUES`
- [ ] implement tuple splitting robustly
- [ ] implement scalar value parsing
- [ ] merge repeated inserts into a normalized snapshot shape
- [ ] handle quoted identifiers and common whitespace variation
- [ ] reject or surface unsupported syntax clearly
- [ ] add parser regression fixtures

## Phase 2 — diff engine

Status: planned

- [ ] implement table-level diffing
- [ ] implement row-level diffing
- [ ] implement cell-level change reporting
- [ ] detect row keys with priority for `id` and `uuid`
- [ ] support positional fallback when no stable key is available
- [ ] surface warnings when fallback matching is used

## Phase 3 — first usable UI

Status: planned

- [ ] replace scaffold landing screen with import workflow
- [ ] add Snapshot A / Snapshot B paste areas
- [ ] add file upload and drag-and-drop
- [ ] run parse + diff in a Web Worker
- [ ] show parser errors and warnings clearly
- [ ] render a first pass of summary cards and table diff sections

## Phase 4 — usability polish

Status: planned

- [ ] add table search
- [ ] add status filters
- [ ] add show / hide unchanged rows
- [ ] add show changed columns only
- [ ] show which key strategy was used per table
- [ ] prepare print-focused UI states

## Phase 5 — print-media quality

Status: planned

- [ ] define print layout behavior for long diffs
- [ ] hide interactive controls in print mode
- [ ] ensure changed sections print with strong visual hierarchy
- [ ] keep printing useful when saving as PDF
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
