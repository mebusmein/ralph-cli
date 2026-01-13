---
name: ralph-plan
description: Plan new features or projects for the Ralph agent by generating or updating structured user stories in .ralph/prd.json.
---

# Ralph Plan Skill

Plan a Ralph session by creating or updating the `.ralph/prd.json` file with well-defined user stories.

## Trigger

Use this skill when the user wants to:

- Plan a new feature or project for Ralph to implement
- Create user stories from a feature description
- Set up a Ralph session

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

### 3. Generate User Stories

Break down the feature into atomic, implementable user stories. Each story should be:

- **Small enough** to implement in a single focused session
- **Independent** where possible
- **Testable** with clear acceptance criteria

### 4. Create prd.json

Write to `.ralph/prd.json` using this format:

```json
{
	"branchName": "ralph/<feature-name>",
	"userStories": [
		{
			"id": "US-001",
			"title": "Short descriptive title",
			"acceptanceCriteria": [
				"Specific testable criterion",
				"Another criterion",
				"typecheck passes"
			],
			"priority": 1,
			"passes": false,
			"notes": ""
		}
	]
}
```

### Story Guidelines

- **IDs**: Sequential format `US-001`, `US-002`, etc.
- **Titles**: Action-oriented, e.g., "Add login form", "Create user API endpoint"
- **Acceptance Criteria**:
  - Specific, testable conditions
  - Always include "typecheck passes" for TypeScript projects
  - Include test requirements if applicable
- **Priority**: Lower number = higher priority. Stories are picked by highest priority first.
- **passes**: Always `false` initially (Ralph sets to `true` when complete)
- **notes**: Leave empty initially; Ralph uses this for implementation notes

### 5. Initialize Progress File

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

### 6. Confirm with User

Present the generated stories and ask if any adjustments are needed before the Ralph session begins.

## Output

After planning is complete, remind the user:

1. Review the stories in `.ralph/prd.json`
2. Create the feature branch: `git checkout -b <branchName>`
3. Start Ralph with the prompt in `.ralph/prompt.txt`
