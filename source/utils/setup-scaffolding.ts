import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {
	DEFAULT_PRD_TEMPLATE,
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
		writeFileSync(paths.progressFile, getProgressTemplate(), 'utf8');
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
