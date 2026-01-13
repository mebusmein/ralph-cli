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
 * Create the empty prd.json template
 * Idempotent: only creates if file doesn't exist
 */
export function createPrdTemplate(cwd: string = process.cwd()): ScaffoldResult {
	const paths = getRalphPaths(cwd);
	return createFileIfNotExists(paths.prdFile, DEFAULT_PRD_TEMPLATE);
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
