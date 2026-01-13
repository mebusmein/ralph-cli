import {existsSync} from 'node:fs';
import {join} from 'node:path';
import type {
	RalphPaths,
	SetupCheckItem,
	SetupCheckResult,
} from '../types/index.js';

/**
 * Get the paths used by Ralph
 */
export function getRalphPaths(cwd: string = process.cwd()): RalphPaths {
	const ralphDir = join(cwd, '.ralph');
	const skillsDir = join(cwd, '.claude', 'skills');

	return {
		ralphDir,
		prdFile: join(ralphDir, 'prd.json'),
		progressFile: join(ralphDir, 'progress.txt'),
		promptFile: join(ralphDir, 'prompt.txt'),
		skillsDir,
		ralphPlanSkill: join(skillsDir, 'ralph-plan.md'),
	};
}

/**
 * Check if the .ralph directory exists
 */
export function checkRalphDirectory(paths: RalphPaths): SetupCheckItem {
	return {
		name: '.ralph directory',
		exists: existsSync(paths.ralphDir),
		path: paths.ralphDir,
	};
}

/**
 * Check if prompt.txt exists
 */
export function checkPromptFile(paths: RalphPaths): SetupCheckItem {
	return {
		name: 'prompt.txt',
		exists: existsSync(paths.promptFile),
		path: paths.promptFile,
	};
}

/**
 * Check if prd.json exists
 */
export function checkPrdFile(paths: RalphPaths): SetupCheckItem {
	return {
		name: 'prd.json',
		exists: existsSync(paths.prdFile),
		path: paths.prdFile,
	};
}

/**
 * Check if ralph-plan skill exists in .claude/skills
 */
export function checkRalphPlanSkill(paths: RalphPaths): SetupCheckItem {
	return {
		name: 'ralph-plan skill',
		exists: existsSync(paths.ralphPlanSkill),
		path: paths.ralphPlanSkill,
	};
}

/**
 * Check all setup items and return structured result
 */
export function checkSetup(cwd: string = process.cwd()): SetupCheckResult {
	const paths = getRalphPaths(cwd);

	const items: SetupCheckItem[] = [
		checkRalphDirectory(paths),
		checkPromptFile(paths),
		checkPrdFile(paths),
		checkRalphPlanSkill(paths),
	];

	const isComplete = items.every(item => item.exists);

	return {
		isComplete,
		items,
	};
}
