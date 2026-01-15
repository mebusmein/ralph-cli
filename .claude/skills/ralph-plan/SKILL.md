---
name: ralph-plan
description: Plan new features or projects for the Ralph agent by generating or updating structured epics with tasks using the beads issue tracker.
---

# Ralph Plan Skill

Plan a Ralph session by creating epics with well-defined tasks using the beads issue tracker (`bd` CLI).

## Trigger

Use this skill when the user wants to:

- Plan a new feature or project for Ralph to implement
- Create epics with tasks from a feature description
- Set up a Ralph session with beads-based task tracking

## Workflow

### 1. Gather Context

If the user provides a feature description, proceed directly. Otherwise, ask:

- What feature or project do you want to build?
- Any specific constraints or requirements?

### 2. Analyze Codebase (if needed)

For features that integrate with existing code:

- Review relevant existing files
- Identify patterns and conventions to follow
- Note dependencies and integration points

### 3. Design Issue Structure

Break down the feature into a hierarchy of issues. Beads supports flexible nesting:

```
Epic (top-level feature)
├── Feature (major component)
│   ├── Sub-feature (optional nesting)
│   │   ├── Task (implementation unit)
│   │   └── Task
│   └── Task
├── Task
└── Bug (if discovered during planning)
```

Each task should be:

- **Small enough** to implement in a single focused session
- **Independent** where possible (use dependencies for ordering)
- **Testable** with clear acceptance criteria

### 4. Create Epic and Tasks

First, create the epic:

```bash
bd create --type=epic --title="Feature name" --description="Overview of the feature" --priority=2
```

Then create child tasks with `--parent`:

```bash
bd create --type=task --parent=<epic-id> --title="Task title" --priority=2 --description="$(cat <<'EOF'
Brief description of what needs to be done.

## Acceptance Criteria
- [ ] Specific testable criterion
- [ ] Another criterion
- [ ] typecheck passes
EOF
)"
```

For nested features within an epic:

```bash
bd create --type=feature --parent=<epic-id> --title="Component name" --priority=2
bd create --type=task --parent=<feature-id> --title="Sub-task" --priority=2
```

### Issue Guidelines

- **Types**: `epic` (top-level), `feature` (major component), `task` (implementation unit), `bug` (defect)
- **Titles**: Action-oriented, e.g., "Add login form", "Create user API endpoint"
- **Priority**: 0-4 (0=critical, 1=high, 2=medium, 3=low, 4=backlog). Lower number = higher priority.
- **Acceptance Criteria**: Use markdown checklists in the description:
  ```markdown
  ## Acceptance Criteria
  - [ ] Specific, testable condition
  - [ ] Always include "typecheck passes" for TypeScript projects
  - [ ] Include test requirements if applicable
  ```

### 5. Set Up Dependencies

Use dependencies to control task order when tasks have prerequisites:

```bash
# Task B depends on Task A (A must complete before B can start)
bd dep add <task-b-id> <task-a-id>

# Alternative shorthand: A blocks B
bd dep <task-a-id> --blocks <task-b-id>
```

Common dependency patterns:

- Tests depend on implementation
- Integration tasks depend on component tasks
- UI depends on API endpoints

### 6. Initialize Progress File

If `.ralph/progress.txt` is empty, initialize it with:

```
# Ralph Progress Log
Started: <current-date>

## Codebase Patterns
- (To be filled as patterns are discovered)

## Key Files
- (List key files relevant to this feature)

---
```

Include any known patterns and key files discovered during codebase analysis.

### 7. Confirm with User

Present the created epic structure and ask if any adjustments are needed before the Ralph session begins.

Use `bd show <epic-id>` to display the epic with its tasks.

## Quick Reference

| Command | Description |
|---------|-------------|
| `bd create --type=epic --title="..."` | Create a new epic |
| `bd create --type=task --parent=<id> --title="..."` | Create a task under a parent |
| `bd create --type=feature --parent=<id> --title="..."` | Create a feature under a parent |
| `bd dep add <issue> <depends-on>` | Add dependency (issue depends on depends-on) |
| `bd show <id>` | View issue details |
| `bd list --parent=<id>` | List children of an issue |
| `bd update <id> --status=in_progress` | Mark task as in progress |
| `bd close <id>` | Mark task as complete |

## Output

After planning is complete, remind the user:

1. Review the epic structure with `bd show <epic-id>`
2. Start Ralph - it will prompt for epic selection and handle branch creation automatically
3. Ralph will work through tasks in priority order, respecting dependencies
