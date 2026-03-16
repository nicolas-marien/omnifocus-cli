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
pnpm dev -- tasks list
```

## Commands

```bash
of tasks list [--status available|remaining|inbox|completed|dropped|all]
of tasks create --name "Task"
of tasks complete --id <task-id>
of projects list [--status active|paused|completed|dropped]
of projects create|update|complete|pause|resume|drop
of tags list|create|update
```

Project status filtering examples:

```bash
of projects list --status active
of projects list --status paused,completed
```

## List Defaults

- `of tasks list` defaults to `available`
- `--filter` accepts JSON object criteria
- `tags` filter is match-any

Example:

```bash
of tasks list --status available --filter '{"tags":["work","home"],"planned":{"before":"2026-03-31"}}'
```

## JSON / NDJSON

- Output: `--format table|json|ndjson`
- Input payloads: `--input-json '<payload>'` (supported by mutating commands)

Create with JSON input:

```bash
of tasks create --input-json '{"name":"Call Alice","plannedAt":"2026-03-12"}' --format json
```

Project lifecycle examples:

```bash
of projects complete --id <project-id>
of projects pause --name "Project Name"
of projects resume --input-json '{"id":"<project-id>"}'
of projects drop --name "Old Initiative"
```

## Date Semantics

- Date-only values (e.g. `2026-03-10`) use local timezone day boundaries.
- Datetime values are parsed as exact instants.

## Safety

- `complete` supports `--dry-run`.
- Name selection is exact match first, then case-insensitive contains.
- Ambiguous name matches fail with `E_MULTI_MATCH`.
