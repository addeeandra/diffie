# Contributing

This project is still early. The main goal right now is to build a clean foundation before expanding features.

## Principles

- keep scope tight: PostgreSQL snapshots only
- favor correctness over broad SQL support
- keep parsing and diff logic framework-agnostic where possible
- keep UI thin around core logic
- prefer explicit failures over silent incorrect parsing
- preserve a good print experience alongside the interactive UI

## Environment

This repo uses `asdf` and `pnpm`.

### First-time setup

```bash
asdf install
pnpm install
```

### Common commands

```bash
pnpm dev
pnpm test
pnpm build
pnpm typecheck
```

## Project structure

```text
src/
  App.vue                 Current app shell placeholder
  main.ts                 Vue entrypoint
  components/
    import/               Import UI components
    diff/                 Diff presentation components
    ui/                   Shared UI primitives
  composables/
    useDiffSession.ts     Session state orchestration
    usePrintView.ts       Print helpers
  core/
    model/
      types.ts            Shared domain types
    postgres/
      parseInsertDump.ts  PostgreSQL INSERT parser entry
      parseSqlValue.ts    Scalar SQL value parsing
      splitValueTuples.ts Tuple splitting helpers
    diff/
      detectTableKey.ts   Key selection / inference
      compareRows.ts      Cell-level row comparison
      diffSnapshots.ts    Snapshot diff entry point
    print/
      printState.ts       Print-view defaults and flags
  styles/
    app.css               Screen styles
    print.css             Print media styles
  workers/
    diff.worker.ts        Background parse / diff worker

prototype/
  db-diff-visualizer.jsx  Original single-file prototype kept for reference

tests/
  unit/                   Unit tests
  fixtures/               SQL fixtures and regression cases
  e2e/                    End-to-end tests when introduced
```

## Development notes

### Parser work

Parser code will be the highest-risk part of the project.

When working on PostgreSQL parsing:

- target `INSERT INTO ... VALUES` first
- add fixtures for every bug or edge case
- isolate tokenization / tuple splitting / value parsing concerns
- do not broaden support casually without test coverage
- document unsupported syntax explicitly

### Diff engine work

The diff layer should stay pure and deterministic.

Recommended rules:

- no DOM access
- no Vue imports
- no side effects
- prefer typed inputs / outputs
- treat key detection as explicit behavior, not hidden magic

### UI work

The UI should eventually support:

- input for Snapshot A / Snapshot B
- parser error and warning feedback
- table summary metrics
- filtering and search
- print-friendly diff output

When adding UI features, keep screen styles and print styles in sync.

## Testing tips

### Unit tests first

For this project, parser and diff logic matter more than component tests early on.

Prioritize tests for:

- multi-row INSERT parsing
- quoted strings and escaped values
- null / boolean / numeric coercion
- repeated inserts into the same table
- row key detection for `id` and `uuid`
- positional fallback behavior
- modified row field detection

### Fixture strategy

Prefer small targeted fixtures over one giant dump.

Good fixture patterns:

- one table, one edge case
- one fixture per parsing bug
- one fixture per matching strategy
- regression fixture named after the bug it protects

### When adding a bug fix

If a parser or diff bug is found:

1. add a failing test or fixture first
2. implement the fix
3. keep the fix local and understandable
4. update docs only if behavior or scope changed

## Style guidance

- use TypeScript everywhere in app code
- keep modules focused
- avoid premature abstractions
- prefer readable function names over clever compact code
- preserve prototype intent, but not prototype coupling

## Out of scope for now

Please avoid introducing these until roadmap calls for them:

- Laravel backend
- JSON snapshot support
- generic SQL-dialect support
- live database connections
- report export pipeline beyond browser printing
- desktop packaging work unless needed later

## Documentation

Keep these docs updated as the project evolves:

- `README.md` for product overview and setup
- `CONTRIBUTING.md` for contributor workflow and structure
- `ROADMAP.md` for priorities and milestones

When architecture changes, update docs in the same change set if possible.
