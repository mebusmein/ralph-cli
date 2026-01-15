# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ralph CLI is an interactive TUI (Terminal User Interface) for managing Claude-based epic execution. It orchestrates Claude Code to work through beads issues automatically, providing live output streaming, epic selection, and progress tracking.

**Prerequisites:** Node.js 16+, Claude CLI, beads CLI (`bd`)

## Commands

```bash
# Build
npm run build       # Compile TypeScript to dist/
npm run dev         # Watch mode compilation

# Test (runs prettier, xo linter, then ava)
npm test

# Run single test
npx ava test.ts --match='*pattern*'

# Run the CLI locally
node dist/cli.js
```

## Architecture

### Entry Flow
- `source/cli.tsx` - CLI entry point using meow for arg parsing, renders the React app
- `source/app.tsx` - Main React component managing application state and view routing

### Core Libraries (`source/lib/`)
- `iteration-executor.ts` - Task execution orchestrator using EventEmitter pattern. Emits: `iterationStart`, `taskStart`, `taskComplete`, `output`, `epicComplete`, `error`
- `beads-reader.ts` - Queries beads issues via `bd` CLI, returns typed results
- `claude-executor.ts` - Spawns Claude CLI with `--output-format=stream-json`
- `stream-formatter.ts` - Parses Claude's streaming JSON output, filters to assistant/user messages, adds ANSI colors
- `prompt-loader.ts` - Loads prompt template with variable expansion (`$EPIC_ID`, `$EPIC_TITLE`, `$PROGRESS_FILE`)

### UI Components (`source/components/`)
- `SetupWizard.tsx` - Initial setup flow (creates .ralph/, initializes beads)
- `EpicSelector.tsx` - Epic list selection
- `MainLayout.tsx` - Two-pane layout (task list + output panel)
- `TicketList.tsx`, `TaskDetailPanel.tsx`, `OutputPanel.tsx`, `ProgressLog.tsx`

### Hooks (`source/hooks/`)
- `useKeyboardControls.ts` - Keyboard input handling
- `useBeadsPolling.ts` - Polls `getEpicTasks()` every 2.5s for real-time updates

### Result Pattern
All major operations use a discriminated union `Result<T, E>` type from `source/types/result.ts`:
```typescript
type Result<T, E> = ({success: true} & T) | {success: false; error: E};
```
Functions return results instead of throwing. Check `result.success` before accessing data.

### Process Spawning
- Claude CLI: Uses `--output-format=stream-json` for streaming output
- Beads CLI: JSON output parsed directly
- Git: Direct command execution for branch management

## Project Structure

```
.ralph/
├── prompt.txt      # Prompt template sent to Claude (supports $EPIC_ID, etc.)
└── progress.txt    # Execution log, Claude appends learnings here

.beads/             # Beads issue tracking data (managed by bd CLI)
```

## Beads Workflow

This project uses beads for issue tracking. Key commands:
```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd close <id>         # Complete work
bd sync               # Sync with git
```

Session completion requires: `bd sync && git push`
