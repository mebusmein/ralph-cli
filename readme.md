# ralph-cli

An interactive TUI (Terminal User Interface) for managing Claude-based epic execution. Ralph orchestrates Claude Code to work through beads issues automatically, providing live output streaming, epic selection, and progress tracking.

## Prerequisites

- Node.js 16+
- [Claude CLI](https://github.com/anthropics/claude-code) installed and authenticated
- [beads](https://github.com/anthropics/beads) CLI (`bd`) installed

## Install

```bash
npm install --global ralph-cli
```

## Quick Start

1. Navigate to your project directory
2. Run `ralph-cli` - the setup wizard will create the necessary files and initialize beads
3. Use `/ralph-plan` in Claude Code to create an epic with tasks
4. Run `ralph-cli` again, select your epic, and enter the number of iterations

## CLI Usage

```bash
# Interactive mode - select epic, then enter iterations
ralph-cli

# Run a specific number of iterations directly
ralph-cli 5

# Log raw JSON output to a file for debugging
ralph-cli 5 --log-file output.json

# Show help
ralph-cli --help
ralph-cli -h
```

### Options

| Option                  | Description                                       |
| ----------------------- | ------------------------------------------------- |
| `[iterations]`          | Number of iterations to run (positional argument) |
| `--log-file, -l <path>` | Log raw JSON stream output to a file              |
| `--help, -h`            | Show help message                                 |

## Epic-Based Workflow

Ralph uses beads for issue tracking. When you start Ralph:

1. **Epic Selection** - Choose from your available epics
2. **Branch Management** - Ralph auto-derives a branch name from the epic title (e.g., `ralph/implement-user-auth`)
3. **Task Execution** - Claude works through ready tasks (unblocked, open)
4. **Progress Tracking** - Real-time status updates as tasks are completed

### Branch Management

When you select an epic:

- Ralph derives a branch name: `ralph/<slugified-epic-title>`
- If the branch doesn't exist, you're prompted to create it from main/master
- If you have uncommitted changes, Ralph warns you before switching

## The `.ralph` Directory

Ralph uses a `.ralph` directory in your project root:

```
.ralph/
├── prompt.txt      # The prompt template sent to Claude
└── progress.txt    # Execution log and learnings
```

### prompt.txt

The prompt template supports variable expansion:

- `$EPIC_ID` - Current epic ID (e.g., `beads-001`)
- `$EPIC_TITLE` - Current epic title
- `$PROGRESS_FILE` - Path to progress.txt

### progress.txt

A log of completed work and learnings. Claude appends entries after each iteration with:

- What was implemented
- Files changed
- Learnings and patterns discovered

## The `.beads` Directory

Beads stores issue tracking data in `.beads/`. Issues are managed via the `bd` CLI:

```bash
# List all epics
bd list --type=epic

# Show epic details
bd show beads-001

# List tasks in an epic
bd list --parent=beads-001

# Show ready (unblocked) tasks
bd ready --parent=beads-001

# Create a new task
bd create --title="Add feature X" --type=task --parent=beads-001

# Close a completed task
bd close beads-001.3
```

## Setup Wizard

When you run `ralph-cli` in a new project, it automatically:

1. Creates the `.ralph` directory
2. Copies the default `prompt.txt` template
3. Creates `progress.txt` with initial structure
4. Initializes beads (`.beads/` directory) if not present
5. Installs the `ralph-plan` skill in `.claude/skills`

The wizard prompts for confirmation before making changes.

## Keyboard Controls

### Epic Selection

| Key       | Action             |
| --------- | ------------------ |
| `↑` / `↓` | Navigate epic list |
| `Enter`   | Select epic        |
| `Ctrl+C`  | Exit               |

### Main View

| Key             | Action                                      |
| --------------- | ------------------------------------------- |
| `↑` / `↓`       | Navigate task list                          |
| `Tab`           | Switch between Output and Progress Log tabs |
| `Ctrl+C`        | Cancel immediately (kills current process)  |
| `Ctrl+X` or `q` | Stop after current iteration completes      |
| `Enter`         | Start iterations (when input is focused)    |

### Task Detail Panel

| Key       | Action                  |
| --------- | ----------------------- |
| `↑` / `↓` | Scroll task description |

### External Blockers Section

| Key           | Action                 |
| ------------- | ---------------------- |
| `e` / `Enter` | Toggle expand/collapse |

## How It Works

1. Ralph displays available epics for selection
2. On epic selection, Ralph derives and manages the git branch
3. For each iteration, it selects a ready task (unblocked, open, highest priority)
4. Claude Code is invoked with epic context and task guidance
5. Output streams live to the TUI while Claude works
6. Claude uses `bd close <task-id>` to mark tasks complete
7. Progress is logged to `progress.txt`
8. When all tasks are done or blocked, the epic is auto-closed
9. At session end, `bd sync` pushes beads changes to remote

## Creating Epics with ralph-plan

Use the `/ralph-plan` skill in Claude Code to create structured epics:

```
/ralph-plan Create a user authentication system
```

This creates:

- An epic issue
- Feature and task children with dependencies
- Acceptance criteria as markdown checklists
- Priority ordering (0=critical, 4=backlog)

## License

MIT
