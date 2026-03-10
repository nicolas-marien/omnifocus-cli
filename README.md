# omnifocus-cli

`of` is a macOS CLI for OmniFocus automation via JXA.

## Install

```bash
pnpm install
pnpm build
node dist/index.js --help
```

For local shell usage during development:

```bash
pnpm dev -- list
```

## Commands

```bash
of list [available|remaining|inbox|completed|dropped|all]
of create --name "Task"
of complete --id <task-id>
of projects list|create|update
of tags list|create|update
```

## List Defaults

- `of list` defaults to `available`
- `--filter` accepts JSON object criteria
- `tags` filter is match-any

Example:

```bash
of list available --filter '{"tags":["work","home"],"planned":{"before":"2026-03-31"}}'
```

## JSON / NDJSON

- Output: `--json` or `--ndjson`
- Input payloads: `--json '<payload>'` (per command)

Create with JSON input:

```bash
of create --json '{"name":"Call Alice","plannedAt":"2026-03-12"}'
```

## Date Semantics

- Date-only values (e.g. `2026-03-10`) use local timezone day boundaries.
- Datetime values are parsed as exact instants.

## Safety

- `complete` supports `--dry-run`.
- Name selection is exact match first, then case-insensitive contains.
- Ambiguous name matches fail with `E_MULTI_MATCH`.
