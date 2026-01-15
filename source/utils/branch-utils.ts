import {execSync} from 'node:child_process';

/**
 * Converts an epic title to a branch-safe slug format.
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes consecutive hyphens
 * - Trims leading/trailing hyphens
 */
export function slugifyTitle(title: string): string {
	return title
		.toLowerCase()
		.replaceAll(/[^a-z0-9]+/g, '-')
		.replaceAll(/-+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * Derives a branch name from an epic title.
 * Format: ralph/<slugified-title>
 */
export function deriveBranchName(epicTitle: string): string {
	const slug = slugifyTitle(epicTitle);
	return `ralph/${slug}`;
}

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
 * Checks if a branch exists locally.
 */
export function branchExists(branchName: string): boolean {
	try {
		execSync(`git rev-parse --verify refs/heads/${branchName}`, {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Detects the default branch (main or master).
 * Returns 'main' if it exists, otherwise 'master' if it exists, otherwise 'main'.
 */
export function getDefaultBranch(): string {
	if (branchExists('main')) {
		return 'main';
	}

	if (branchExists('master')) {
		return 'master';
	}

	return 'main';
}

/**
 * Checks if there are uncommitted changes in the worktree.
 * Returns true if there are staged or unstaged changes.
 */
export function hasUncommittedChanges(): boolean {
	try {
		const result = execSync('git status --porcelain', {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		return result.trim().length > 0;
	} catch {
		return false;
	}
}

/**
 * Creates a new branch from the base branch and switches to it.
 * Returns a result object indicating success or failure.
 */
export function createAndSwitchBranch(
	branchName: string,
	baseBranch?: string,
): {success: true} | {success: false; error: string} {
	const base = baseBranch ?? getDefaultBranch();

	try {
		// Create the branch from base and switch to it
		execSync(`git checkout -b ${branchName} ${base}`, {
			encoding: 'utf8',
			stdio: ['pipe', 'pipe', 'pipe'],
		});
		return {success: true};
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'Unknown error creating branch';
		return {success: false, error: message};
	}
}
