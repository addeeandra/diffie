# Diffie

Diffie is a browser-first visual diff tool for PostgreSQL data snapshots.

The goal of the project is simple: compare two local PostgreSQL snapshots, identify table / row / field-level changes, and present the result in a clean interface that also prints well from the browser.

## Scope for the current rebuild

This repository was re-initialized from a single-file prototype and is now being rebuilt as a Vue 3 + Vite + TypeScript application.

Current product direction:

- PostgreSQL-only
- local-first, browser-first
- optimized for `INSERT INTO ... VALUES` dumps
- small snapshots first, typically under 5 MB
- no backend
- no JSON input
- no export pipeline in V1
- print-friendly diff output via browser print styles

Prototype reference kept in-repo:

- `prototype/db-diff-visualizer.jsx`

## Why this exists

Diffie is meant to make database snapshot review easier during debugging, QA, test verification, and local investigation. Raw SQL dumps are hard to inspect visually; Diffie aims to turn them into a structured, reviewable diff.

## Planned V1 capabilities

- ingest two PostgreSQL SQL snapshots from paste, drag-and-drop, or file upload
- parse `INSERT INTO ... VALUES` statements reliably
- normalize table data into an internal snapshot model
- match rows by detected key columns (`id`, `uuid`, or user override later)
- show added / removed / modified / unchanged rows
- highlight changed cells per row
- support browser print output with dedicated print styles

## Tech stack

- Vue 3
- Vite
- TypeScript
- Vitest
- Browser Web Worker for parsing / diffing
- pnpm for package management

## Getting started

### Prerequisites

This project uses `asdf` for runtime and package-manager management.

```bash
asdf install
```

The repository includes a local `.tool-versions` file for:

- Node.js
- pnpm

### Install dependencies

```bash
pnpm install
```

### Start development server

```bash
pnpm dev
```

### Run tests

```bash
pnpm test
```

### Build for production

```bash
pnpm build
```

## Current status

The project is currently at scaffold stage:

- initial Vite Vue TypeScript app is in place
- base directory structure is created
- placeholder parser / diff modules are present
- test runner is wired up
- print stylesheet foundation is present
- detailed implementation is still ahead

## Documentation

- `README.md` — project overview
- `CONTRIBUTING.md` — development workflow, structure, and contribution notes
- `ROADMAP.md` — planned milestones and priorities

## Near-term priorities

1. implement a robust PostgreSQL `INSERT` parser
2. define diff engine behavior around key detection and row comparison
3. replace the scaffold screen with the first import / diff workflow
4. add regression fixtures for parser edge cases
5. refine print-media output
