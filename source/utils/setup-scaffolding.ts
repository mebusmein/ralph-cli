import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {getRalphPaths} from './setup-checker.js';

/**
 * Default prompt template content
 */
const DEFAULT_PROMPT_TEMPLATE = `# Ralph Agent Instructions

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
 */
const DEFAULT_PRD_TEMPLATE = `{
  "branchName": "ralph/feature-name",
  "userStories": []
}
`;

/**
 * Default progress.txt template content
 */
const DEFAULT_PROGRESS_TEMPLATE = `# Ralph Progress Log
Started: ${new Date().toISOString().split('T')[0]}

## Codebase Patterns
- (To be filled as patterns are discovered)

## Key Files
- (List key files relevant to this feature)

---
`;

/**
 * Default ralph-plan skill content
 */
const DEFAULT_RALPH_PLAN_SKILL = `---
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
 * Result of a scaffolding operation
 */
export type ScaffoldResult = {
	success: boolean;
	created: boolean;
	path: string;
	error?: string;
};

/**
 * Ensure a directory exists (create it if it doesn't)
 */
function ensureDirectory(dirPath: string): void {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, {recursive: true});
	}
}

/**
 * Create the .ralph directory
 * Idempotent: safe to run multiple times
 */
export function createRalphDirectory(
	cwd: string = process.cwd(),
): ScaffoldResult {
	const paths = getRalphPaths(cwd);

	try {
		const existed = existsSync(paths.ralphDir);
		ensureDirectory(paths.ralphDir);
		return {
			success: true,
			created: !existed,
			path: paths.ralphDir,
		};
	} catch (error) {
		return {
			success: false,
			created: false,
			path: paths.ralphDir,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Create the default prompt.txt template
 * Idempotent: only creates if file doesn't exist
 */
export function createPromptTemplate(
	cwd: string = process.cwd(),
): ScaffoldResult {
	const paths = getRalphPaths(cwd);

	try {
		if (existsSync(paths.promptFile)) {
			return {
				success: true,
				created: false,
				path: paths.promptFile,
			};
		}

		ensureDirectory(dirname(paths.promptFile));
		writeFileSync(paths.promptFile, DEFAULT_PROMPT_TEMPLATE, 'utf8');
		return {
			success: true,
			created: true,
			path: paths.promptFile,
		};
	} catch (error) {
		return {
			success: false,
			created: false,
			path: paths.promptFile,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Create the empty prd.json template
 * Idempotent: only creates if file doesn't exist
 */
export function createPrdTemplate(cwd: string = process.cwd()): ScaffoldResult {
	const paths = getRalphPaths(cwd);

	try {
		if (existsSync(paths.prdFile)) {
			return {
				success: true,
				created: false,
				path: paths.prdFile,
			};
		}

		ensureDirectory(dirname(paths.prdFile));
		writeFileSync(paths.prdFile, DEFAULT_PRD_TEMPLATE, 'utf8');
		return {
			success: true,
			created: true,
			path: paths.prdFile,
		};
	} catch (error) {
		return {
			success: false,
			created: false,
			path: paths.prdFile,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Create the progress.txt template
 * Idempotent: only creates if file doesn't exist
 */
export function createProgressTemplate(
	cwd: string = process.cwd(),
): ScaffoldResult {
	const paths = getRalphPaths(cwd);

	try {
		if (existsSync(paths.progressFile)) {
			return {
				success: true,
				created: false,
				path: paths.progressFile,
			};
		}

		ensureDirectory(dirname(paths.progressFile));
		writeFileSync(paths.progressFile, DEFAULT_PROGRESS_TEMPLATE, 'utf8');
		return {
			success: true,
			created: true,
			path: paths.progressFile,
		};
	} catch (error) {
		return {
			success: false,
			created: false,
			path: paths.progressFile,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Install the ralph-plan skill in .claude/skills
 * Idempotent: only creates if file doesn't exist
 */
export function installRalphPlanSkill(
	cwd: string = process.cwd(),
): ScaffoldResult {
	const paths = getRalphPaths(cwd);
	const skillDir = dirname(paths.ralphPlanSkill);

	try {
		if (existsSync(paths.ralphPlanSkill)) {
			return {
				success: true,
				created: false,
				path: paths.ralphPlanSkill,
			};
		}

		ensureDirectory(skillDir);
		writeFileSync(paths.ralphPlanSkill, DEFAULT_RALPH_PLAN_SKILL, 'utf8');
		return {
			success: true,
			created: true,
			path: paths.ralphPlanSkill,
		};
	} catch (error) {
		return {
			success: false,
			created: false,
			path: paths.ralphPlanSkill,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/**
 * Result of running full scaffold
 */
export type FullScaffoldResult = {
	success: boolean;
	results: {
		ralphDir: ScaffoldResult;
		promptFile: ScaffoldResult;
		prdFile: ScaffoldResult;
		progressFile: ScaffoldResult;
		ralphPlanSkill: ScaffoldResult;
	};
};

/**
 * Run all scaffolding operations
 * Idempotent: safe to run multiple times
 */
export function scaffoldAll(cwd: string = process.cwd()): FullScaffoldResult {
	const ralphDir = createRalphDirectory(cwd);
	const promptFile = createPromptTemplate(cwd);
	const prdFile = createPrdTemplate(cwd);
	const progressFile = createProgressTemplate(cwd);
	const ralphPlanSkill = installRalphPlanSkill(cwd);

	const success =
		ralphDir.success &&
		promptFile.success &&
		prdFile.success &&
		progressFile.success &&
		ralphPlanSkill.success;

	return {
		success,
		results: {
			ralphDir,
			promptFile,
			prdFile,
			progressFile,
			ralphPlanSkill,
		},
	};
}
