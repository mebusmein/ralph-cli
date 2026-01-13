/**
 * Bundled default templates for Ralph CLI
 *
 * These templates are bundled with the package and can be imported at runtime.
 * They serve as defaults when user-customized versions are not present.
 */

/**
 * Default prompt.txt template content
 *
 * This is the main prompt that drives the Ralph agent.
 * Users can customize this by creating .ralph/prompt.txt in their project.
 */
export const DEFAULT_PROMPT_TEMPLATE = `# Ralph Agent Instructions

## Your Task

1. Read \`.ralph/prd.json\`
2. Read \`.ralph/progress.txt\`
   (check Codebase Patterns first)
3. Check you're on the correct branch
4. Pick highest priority story
   where \`passes: false\`
5. Implement that ONE story
6. Run typecheck and tests
7. Update AGENTS.md files with learnings
8. Commit: \`feat: [ID] - [Title]\`
9. Update prd.json: \`passes: true\`
10. Append learnings to progress.txt

ONLY WORK ON A SINGLE TASK.

## Progress Format

APPEND to progress.txt:

## [Date] - [Story ID]
- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered
---

## Stop Condition

If ALL stories pass, reply:
<promise>COMPLETE</promise>

Otherwise end normally.
`;

/**
 * Default prd.json template content
 *
 * This provides an empty PRD structure for new projects.
 */
export const DEFAULT_PRD_TEMPLATE = `{
  "branchName": "ralph/feature-name",
  "userStories": []
}
`;

/**
 * Default progress.txt template content
 *
 * Note: The date is inserted dynamically when scaffolding.
 * This template provides the structure.
 */
export const DEFAULT_PROGRESS_TEMPLATE_BASE = `# Ralph Progress Log
Started: {{DATE}}

## Codebase Patterns
- (To be filled as patterns are discovered)

## Key Files
- (List key files relevant to this feature)

---
`;

/**
 * Generate a progress template with the current date
 */
export function getProgressTemplate(): string {
	const today = new Date().toISOString().split('T')[0]!;
	return DEFAULT_PROGRESS_TEMPLATE_BASE.replace('{{DATE}}', today);
}

/**
 * Default ralph-plan skill content (SKILL.md)
 *
 * This skill helps users plan Ralph sessions by generating user stories.
 */
export const DEFAULT_RALPH_PLAN_SKILL = `---
name: ralph-plan
description: Plan new features or projects for the Ralph agent by generating or updating structured user stories in .ralph/prd.json.
---

# Ralph Plan Skill

Plan a Ralph session by creating or updating the \`.ralph/prd.json\` file with well-defined user stories.

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

Write to \`.ralph/prd.json\` using this format:

\`\`\`json
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
\`\`\`

### Story Guidelines

- **IDs**: Sequential format \`US-001\`, \`US-002\`, etc.
- **Titles**: Action-oriented, e.g., "Add login form", "Create user API endpoint"
- **Acceptance Criteria**:
  - Specific, testable conditions
  - Always include "typecheck passes" for TypeScript projects
  - Include test requirements if applicable
- **Priority**: Lower number = higher priority. Stories are picked by highest priority first.
- **passes**: Always \`false\` initially (Ralph sets to \`true\` when complete)
- **notes**: Leave empty initially; Ralph uses this for implementation notes

### 5. Initialize Progress File

If \`.ralph/progress.txt\` is empty, initialize it with:

\`\`\`
# Ralph Progress Log
Started: <current-date>

## Codebase Patterns
- (To be filled as patterns are discovered)

## Key Files
- (List key files relevant to this feature)

---
\`\`\`

Include any known patterns and key files discovered during codebase analysis.

### 6. Confirm with User

Present the generated stories and ask if any adjustments are needed before the Ralph session begins.

## Output

After planning is complete, remind the user:

1. Review the stories in \`.ralph/prd.json\`
2. Create the feature branch: \`git checkout -b <branchName>\`
3. Start Ralph with the prompt in \`.ralph/prompt.txt\`
`;

/**
 * All bundled templates as an object for convenience
 */
export const templates = {
	prompt: DEFAULT_PROMPT_TEMPLATE,
	prd: DEFAULT_PRD_TEMPLATE,
	progress: DEFAULT_PROGRESS_TEMPLATE_BASE,
	getProgress: getProgressTemplate,
	ralphPlanSkill: DEFAULT_RALPH_PLAN_SKILL,
} as const;
