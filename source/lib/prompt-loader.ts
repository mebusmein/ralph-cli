import {existsSync, readFileSync} from 'node:fs';
import {getRalphPaths} from '../utils/setup-checker.js';

/**
 * Default prompt template content (bundled fallback)
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
 * Result of loading a prompt template
 */
export type PromptLoadResult = {
	/**
	 * The loaded prompt content (with variables expanded)
	 */
	content: string;

	/**
	 * Whether the prompt was loaded from a custom file or the default template
	 */
	source: 'file' | 'default';

	/**
	 * Path to the file if loaded from file
	 */
	filePath?: string;
};

/**
 * Variables available for expansion in prompt templates
 */
export type PromptVariables = {
	/**
	 * Path to the PRD file
	 */
	prdFile: string;

	/**
	 * Path to the progress file
	 */
	progressFile: string;
};

/**
 * Expands variables in a prompt template
 *
 * Supported variables:
 * - $PRD_FILE - Path to the prd.json file
 * - $PROGRESS_FILE - Path to the progress.txt file
 */
export function expandPromptVariables(
	template: string,
	variables: PromptVariables,
): string {
	return template
		.replaceAll('$PRD_FILE', variables.prdFile)
		.replaceAll('$PROGRESS_FILE', variables.progressFile);
}

/**
 * Load the prompt template from .ralph/prompt.txt or fall back to default
 *
 * @param cwd - Current working directory
 * @returns The loaded prompt content with variables expanded
 */
export function loadPromptTemplate(
	cwd: string = process.cwd(),
): PromptLoadResult {
	const paths = getRalphPaths(cwd);
	const variables: PromptVariables = {
		prdFile: paths.prdFile,
		progressFile: paths.progressFile,
	};

	// Try to load from file
	if (existsSync(paths.promptFile)) {
		try {
			const fileContent = readFileSync(paths.promptFile, 'utf8');
			return {
				content: expandPromptVariables(fileContent, variables),
				source: 'file',
				filePath: paths.promptFile,
			};
		} catch {
			// Fall through to default on read error
		}
	}

	// Fall back to default template
	return {
		content: expandPromptVariables(DEFAULT_PROMPT_TEMPLATE, variables),
		source: 'default',
	};
}

/**
 * Create a prompt generator function for use with the iteration executor
 *
 * The generated prompt includes the base template plus any story-specific context
 *
 * @param cwd - Current working directory
 * @returns A function that generates prompts for a given story
 */
export function createPromptGenerator(
	cwd: string = process.cwd(),
): () => string {
	const {content} = loadPromptTemplate(cwd);
	return () => content;
}
