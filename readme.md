# ralph-cli

> Let Claude Code work through your backlog, one user story at a time.

`ralph-cli` is a terminal UI that runs [Claude Code](https://github.com/anthropics/claude-code) in a loop against a list of user stories. Each iteration, Claude picks the next incomplete story from `.ralph/prd.json`, implements it, commits, and logs what it learned. Ralph streams the output live, tracks which stories pass, and stops when you tell it to or when everything is done.

## Requirements

- Node.js 16 or newer
- The `claude` CLI installed, authenticated, and on your `PATH`

## Installation

Build from source and link the binary:

```bash
git clone https://github.com/mebusmein/ralph-cli.git
cd ralph-cli
npm install
npm run build
npm link
```

## Quick start

```bash
cd your-project
ralph-cli          # first run: the setup wizard scaffolds .ralph/
```

1. Accept the setup wizard. It creates `.ralph/` and installs the `ralph-plan` skill.
2. Add user stories to `.ralph/prd.json`, either by hand or by asking Claude Code to "plan this feature with ralph-plan".
3. Run `ralph-cli` again, enter the number of iterations, and press `Enter`.

## Usage

```bash
ralph-cli                            # interactive: choose iterations in the UI
ralph-cli 5                          # start 5 iterations immediately
ralph-cli 5 --log-file output.json   # also write the raw JSON stream to a file
ralph-cli --help
```

| Option                  | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `[iterations]`          | Number of iterations to run (positive integer)  |
| `--log-file, -l <path>` | Write Claude's raw stream-json output to a file |
| `--help, -h`            | Show help                                       |

In interactive mode the iteration count is entered in the footer (1–100).

### Keyboard controls

| Key             | Action                                       |
| --------------- | -------------------------------------------- |
| `Enter`         | Start iterations                             |
| `Tab`           | Switch between the Output and Progress tabs  |
| `q` / `Ctrl+X`  | Stop gracefully after the current iteration  |
| `Ctrl+C`        | Cancel immediately and kill the Claude process |

## Project files

Ralph keeps its state in a `.ralph/` directory at the project root:

```
.ralph/
├── prd.json       # user stories and their pass/fail status
├── prompt.txt     # prompt sent to Claude on every iteration
└── progress.txt   # running log of work done and lessons learned
```

### `prd.json`

```json
{
	"branchName": "feature/login",
	"userStories": [
		{
			"id": "US-001",
			"title": "Create login form",
			"acceptanceCriteria": [
				"Form has email and password fields",
				"Submit button validates input",
				"Typecheck passes"
			],
			"priority": 1,
			"passes": false,
			"notes": ""
		}
	]
}
```

- Story IDs use the `US-XXX` format (three digits). Ralph uses them to detect which story was completed.
- Incomplete stories (`"passes": false`) are worked on in ascending `priority` order.
- A story is marked `"passes": true` once Claude finishes it.

### `prompt.txt`

The instructions Claude receives each iteration. Edit it to match your project's conventions (test commands, commit style, and so on). Two variables are expanded before sending:

| Variable         | Expands to                  |
| ---------------- | --------------------------- |
| `$PRD_FILE`      | Path to `.ralph/prd.json`   |
| `$PROGRESS_FILE` | Path to `.ralph/progress.txt` |

If the file is missing, Ralph falls back to its built-in default prompt.

### `progress.txt`

An append-only log. After each story, Claude records what it implemented, which files changed, and patterns worth remembering, so later iterations build on earlier ones.

## How it works

1. Ralph reads `prd.json` and picks the highest-priority incomplete story.
2. It runs `claude --print --output-format stream-json --verbose --dangerously-skip-permissions` with the expanded prompt.
3. Output streams into the Output tab as Claude works.
4. When the iteration ends, Ralph looks for the story ID in Claude's output, preferring commit messages such as `feat: US-001 - Create login form`, and marks that story as passing in `prd.json`.
5. The loop repeats until the iteration count is reached, every story passes, or you stop it.

> **Warning:** Claude runs with `--dangerously-skip-permissions`, so it can edit files and run commands without asking. Run Ralph on a clean branch or in a sandbox, and review the commits it makes.

## Development

```bash
npm install
npm run dev     # compile in watch mode
npm run build   # compile to dist/
npm test        # prettier + xo + ava
```

Source layout:

```
source/
├── cli.tsx         # argument parsing and entry point
├── app.tsx         # top-level Ink app
├── components/     # UI: layout, ticket list, output, progress log, setup wizard
├── hooks/          # keyboard controls
├── lib/            # Claude execution, iteration loop, PRD read/write, stream parsing
├── templates/      # default prompt, PRD, progress, and ralph-plan skill
├── types/          # shared types
└── utils/          # setup checks and scaffolding
```

## License

MIT
