import {execSync} from 'node:child_process';

/**
 * Gets the current git branch name.
 * Returns undefined if not in a git repository or on a detached HEAD.
 */
export function getCurrentBranch(): string | undefined {
	try {
		const result = execSync('git rev-parse --abbrev-ref HEAD', {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		const branch = result.trim();
		return branch === 'HEAD' ? undefined : branch;
	} catch {
		return undefined;
	}
}

/**
 * Checks if the current branch is a main/default branch (main or master).
 * Returns true if on main or master branch.
 */
export function isOnMainBranch(): boolean {
	const branch = getCurrentBranch();
	return branch === 'main' || branch === 'master';
}
