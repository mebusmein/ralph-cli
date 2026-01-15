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
 *
 * Variables:
 * - $EPIC_ID - The ID of the epic being worked on
 * - $EPIC_TITLE - The title of the epic being worked on
 */
export const DEFAULT_PROMPT_TEMPLATE = `# Ralph Agent Instructions

## Epic Context

You are working on epic **$EPIC_ID**: $EPIC_TITLE

## Your Task

1. Read \`.ralph/progress.txt\`
   (check Codebase Patterns first)
2. Check you're on the correct branch
3. Query tasks: \`bd list --parent=$EPIC_ID --status=open\`
4. Pick ONE task using this strategy:
   - Prioritize unblocked tasks (check \`blocked_by\` field)
   - Higher priority (lower number) first
   - Tasks whose dependencies are closed first
5. Claim the task: \`bd update <task-id> --status=in_progress\`
6. Implement that ONE task
7. Run typecheck and tests
8. Update AGENTS.md files with learnings
9. Commit: \`feat: [task-id] - [Title]\`
10. Close the task: \`bd close <task-id>\`
11. Append learnings to progress.txt

ONLY WORK ON A SINGLE TASK.

## Issue Discovery

If you discover work that needs to be done:
- Create a new issue: \`bd create --title="..." --type=task --parent=$EPIC_ID\`
- If the new work blocks your current task, add it as a blocker: \`bd dep add <current-task> <new-task>\`
- Continue with your current task if possible, or switch to the blocker if critical

## Progress Format

APPEND to progress.txt:

## [Date] - [Task ID]
- What was implemented
- Files changed
- **Learnings:**
  - Patterns discovered
  - Gotchas encountered
---

## Stop Condition

If ALL tasks in the epic are closed or blocked, reply:
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
