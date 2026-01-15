import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {dirname} from 'node:path';
import {
	DEFAULT_PROMPT_TEMPLATE,
	DEFAULT_RALPH_PLAN_SKILL,
	getProgressTemplate,
} from '../templates/index.js';
import {getRalphPaths} from './setup-checker.js';

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
 * Create a file with content if it doesn't already exist
 * Idempotent: safe to run multiple times
 */
function createFileIfNotExists(
	filePath: string,
	content: string,
): ScaffoldResult {
	try {
		if (existsSync(filePath)) {
			return {
				success: true,
				created: false,
				path: filePath,
			};
		}

		ensureDirectory(dirname(filePath));
		writeFileSync(filePath, content, 'utf8');
		return {
			success: true,
			created: true,
			path: filePath,
		};
	} catch (error) {
		return {
			success: false,
			created: false,
			path: filePath,
			error: error instanceof Error ? error.message : String(error),
		};
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
	return createFileIfNotExists(paths.promptFile, DEFAULT_PROMPT_TEMPLATE);
}

/**
 * Result of beads initialization
 */
export type BeadsInitResult = {
	success: boolean;
	initialized: boolean;
	alreadyInitialized: boolean;
	error?: string;
};

/**
 * Initialize beads in the project by running bd init
 * Returns result indicating if beads was initialized
 */
export function initializeBeads(cwd: string = process.cwd()): BeadsInitResult {
	const paths = getRalphPaths(cwd);

	// Check if already initialized
	if (existsSync(paths.beadsDir)) {
		return {
			success: true,
			initialized: false,
			alreadyInitialized: true,
		};
	}

	try {
		// Run bd init command
		execSync('bd init', {
			cwd,
			stdio: ['pipe', 'pipe', 'pipe'],
		});

		// Verify it worked
		if (existsSync(paths.beadsDir)) {
			return {
				success: true,
				initialized: true,
				alreadyInitialized: false,
			};
		}

		return {
			success: false,
			initialized: false,
			alreadyInitialized: false,
			error: 'bd init completed but .beads directory was not created',
		};
	} catch (error) {
		return {
			success: false,
			initialized: false,
			alreadyInitialized: false,
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
	return createFileIfNotExists(paths.progressFile, getProgressTemplate());
}

/**
 * Install the ralph-plan skill in .claude/skills
 * Idempotent: only creates if file doesn't exist
 */
export function installRalphPlanSkill(
	cwd: string = process.cwd(),
): ScaffoldResult {
	const paths = getRalphPaths(cwd);
	return createFileIfNotExists(paths.ralphPlanSkill, DEFAULT_RALPH_PLAN_SKILL);
}

/**
 * Result of running full scaffold
 */
export type FullScaffoldResult = {
	success: boolean;
	beadsInitialized: boolean;
	results: {
		ralphDir: ScaffoldResult;
		promptFile: ScaffoldResult;
		progressFile: ScaffoldResult;
		ralphPlanSkill: ScaffoldResult;
		beads: BeadsInitResult;
	};
};

/**
 * Options for scaffolding
 */
export type ScaffoldOptions = {
	initializeBeads?: boolean;
};

/**
 * Run all scaffolding operations
 * Idempotent: safe to run multiple times
 *
 * @param cwd - Working directory
 * @param options - Scaffold options. Set initializeBeads to true to run bd init.
 */
export function scaffoldAll(
	cwd: string = process.cwd(),
	options: ScaffoldOptions = {},
): FullScaffoldResult {
	const ralphDir = createRalphDirectory(cwd);
	const promptFile = createPromptTemplate(cwd);
	const progressFile = createProgressTemplate(cwd);
	const ralphPlanSkill = installRalphPlanSkill(cwd);

	// Initialize beads if requested
	let beads: BeadsInitResult;
	if (options.initializeBeads) {
		beads = initializeBeads(cwd);
	} else {
		// Check if already initialized without running init
		const paths = getRalphPaths(cwd);
		beads = {
			success: true,
			initialized: false,
			alreadyInitialized: existsSync(paths.beadsDir),
		};
	}

	const success =
		ralphDir.success &&
		promptFile.success &&
		progressFile.success &&
		ralphPlanSkill.success &&
		beads.success;

	return {
		success,
		beadsInitialized: beads.initialized || beads.alreadyInitialized,
		results: {
			ralphDir,
			promptFile,
			progressFile,
			ralphPlanSkill,
			beads,
		},
	};
}
