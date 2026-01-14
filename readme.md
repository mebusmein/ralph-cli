# ralph-cli

An interactive TUI (Terminal User Interface) for managing Claude-based user story execution. Ralph orchestrates Claude Code to work through PRD user stories automatically, providing live output streaming and progress tracking.

## Prerequisites

- Node.js 16+
- [Claude CLI](https://github.com/anthropics/claude-code) installed and authenticated

## Install

```bash
npm install --global ralph-cli
```

## Quick Start

1. Navigate to your project directory
2. Run `ralph-cli` - the setup wizard will create the necessary files
3. Edit `.ralph/prd.json` to add your user stories
4. Run `ralph-cli` again and enter the number of iterations to run

## CLI Usage

```bash
# Interactive mode - prompts for iterations
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

## The `.ralph` Directory

Ralph uses a `.ralph` directory in your project root to store configuration and state:

```
.ralph/
├── prd.json        # Your user stories and their status
├── prompt.txt      # The prompt template sent to Claude
└── progress.txt    # Execution log and learnings
```

### prd.json

The PRD file contains your user stories in JSON format:

```json
{
	"branchName": "feature/my-feature",
	"userStories": [
		{
			"id": "US-001",
			"title": "Create login form",
			"acceptanceCriteria": [
				"Form has email and password fields",
				"Submit button validates input",
				"typecheck passes"
			],
			"priority": 1,
			"passes": false,
			"notes": ""
		}
	]
}
```

- Stories are processed by priority (lowest number = highest priority)
- `passes: false` indicates incomplete stories
- Claude marks stories as `passes: true` when complete

### prompt.txt

The prompt template supports variable expansion:

- `$PRD_FILE` - Path to prd.json
- `$PROGRESS_FILE` - Path to progress.txt

### progress.txt

A log of completed work and learnings. Claude appends entries after each iteration with:

- What was implemented
- Files changed
- Learnings and patterns discovered

## Setup Wizard

When you run `ralph-cli` in a new project, it automatically:

1. Creates the `.ralph` directory
2. Copies the default `prompt.txt` template
3. Creates an empty `prd.json` template
4. Creates `progress.txt` with initial structure
5. Installs the `ralph-plan` skill in `.claude/skills`

The wizard prompts for confirmation before making changes.

## Keyboard Controls

| Key             | Action                                      |
| --------------- | ------------------------------------------- |
| `Tab`           | Switch between Output and Progress Log tabs |
| `Ctrl+C`        | Cancel immediately (kills current process)  |
| `Ctrl+X` or `q` | Stop after current iteration completes      |
| `Enter`         | Start iterations (when input is focused)    |

## How It Works

1. Ralph reads `.ralph/prd.json` to find incomplete user stories
2. For each iteration, it selects the highest priority incomplete story
3. Claude Code is invoked with the prompt template and story context
4. Output streams live to the TUI while Claude works
5. When Claude commits with a story ID (e.g., `feat: US-001 - Title`), that story is marked complete
6. Progress is logged to `progress.txt`
7. The process repeats for the specified number of iterations

## License

MIT
