import {existsSync, readFileSync} from 'node:fs';
import {DEFAULT_PROMPT_TEMPLATE} from '../templates/index.js';
import {getRalphPaths} from '../utils/setup-checker.js';

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
	 * Path to the progress file
	 */
	progressFile: string;

	/**
	 * ID of the epic being worked on
	 */
	epicId?: string;

	/**
	 * Title of the epic being worked on
	 */
	epicTitle?: string;
};

/**
 * Expands variables in a prompt template
 *
 * Supported variables:
 * - $PROGRESS_FILE - Path to the progress.txt file
 * - $EPIC_ID - ID of the epic being worked on
 * - $EPIC_TITLE - Title of the epic being worked on
 */
export function expandPromptVariables(
	template: string,
	variables: PromptVariables,
): string {
	let result = template.replaceAll('$PROGRESS_FILE', variables.progressFile);

	// Add epic variables for beads workflow
	if (variables.epicId !== undefined) {
		result = result.replaceAll('$EPIC_ID', variables.epicId);
	}

	if (variables.epicTitle !== undefined) {
		result = result.replaceAll('$EPIC_TITLE', variables.epicTitle);
	}

	return result;
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
 * Options for creating a prompt generator
 */
export type PromptGeneratorOptions = {
	/**
	 * Current working directory
	 */
	cwd?: string;

	/**
	 * Epic ID for beads workflow
	 */
	epicId?: string;

	/**
	 * Epic title for beads workflow
	 */
	epicTitle?: string;
};

/**
 * Create a prompt generator function for use with the iteration executor
 *
 * The generated prompt includes the base template plus epic context for beads workflow
 *
 * @param optionsOrCwd - Configuration options object or just the cwd string (for backward compat)
 * @returns A function that generates prompts
 */
export function createPromptGenerator(
	optionsOrCwd: PromptGeneratorOptions | string = {},
): () => string {
	// Handle backward compatibility: accept either string (cwd) or options object
	const options: PromptGeneratorOptions =
		typeof optionsOrCwd === 'string' ? {cwd: optionsOrCwd} : optionsOrCwd;

	const {cwd = process.cwd(), epicId, epicTitle} = options;
	const paths = getRalphPaths(cwd);

	const variables: PromptVariables = {
		progressFile: paths.progressFile,
		epicId,
		epicTitle,
	};

	// Try to load from file
	if (existsSync(paths.promptFile)) {
		try {
			const fileContent = readFileSync(paths.promptFile, 'utf8');
			return () => expandPromptVariables(fileContent, variables);
		} catch {
			// Fall through to default on read error
		}
	}

	// Fall back to default template
	return () => expandPromptVariables(DEFAULT_PROMPT_TEMPLATE, variables);
}
