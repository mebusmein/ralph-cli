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

	return {
		ralphDir,
		beadsDir: join(cwd, '.beads'),
		prdFile: join(ralphDir, 'prd.json'),
		progressFile: join(ralphDir, 'progress.txt'),
		promptFile: join(ralphDir, 'prompt.txt'),
	};
}

/**
 * Create a setup check item for a given path
 */
function createCheckItem(name: string, path: string): SetupCheckItem {
	return {
		name,
		exists: existsSync(path),
		path,
	};
}

/**
 * Check all setup items and return structured result
 */
export function checkSetup(cwd: string = process.cwd()): SetupCheckResult {
	const paths = getRalphPaths(cwd);

	const beadsCheck = createCheckItem('.beads directory', paths.beadsDir);

	const items: SetupCheckItem[] = [
		createCheckItem('.ralph directory', paths.ralphDir),
		createCheckItem('prompt.txt', paths.promptFile),
		beadsCheck,
	];

	const isComplete = items.every(item => item.exists);

	return {
		isComplete,
		isBeadsInitialized: beadsCheck.exists,
		items,
	};
}
