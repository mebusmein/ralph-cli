import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import type {
	BeadsIssue,
	BeadsCommandResult,
	TicketSummary,
	BeadsStatus,
	BeadsPriority,
	BeadsIssueType,
} from '../types/beads.js';

/**
 * Raw issue data from bd command JSON output
 */
type RawBeadsIssue = {
	id: string;
	title: string;
	status: string;
	priority: number;
	issue_type: string;
	description?: string;
	parent?: string;
	labels?: string[];
	dependencies?: Array<{
		id: string;
		title: string;
		dependency_type: string;
		status: string;
	}>;
	blocked_by?: string[];
	dependency_count?: number;
	dependent_count?: number;
};

/**
 * Runs a bd command and returns the parsed JSON output
 *
 * @param args - Arguments to pass to the bd command
 * @returns Promise resolving to the command result with parsed JSON data
 */
export async function runBeadsCommand<T>(
	args: string[],
): Promise<BeadsCommandResult<T>> {
	// Check if beads is initialized
	if (!existsSync('.beads')) {
		return {
			success: false,
			error: {
				code: 'not_initialized',
				message: 'Beads is not initialized. Run "bd init" first.',
			},
		};
	}

	return new Promise(resolve => {
		try {
			const childProcess = spawn('bd', [...args, '--json'], {
				stdio: ['ignore', 'pipe', 'pipe'],
				shell: false,
			});

			let stdout = '';
			let stderr = '';

			childProcess.stdout?.on('data', (data: Buffer) => {
				stdout += data.toString();
			});

			childProcess.stderr?.on('data', (data: Buffer) => {
				stderr += data.toString();
			});

			childProcess.on('error', (error: Error) => {
				resolve({
					success: false,
					error: {
						code: 'command_failed',
						message: `Failed to spawn bd process: ${error.message}`,
					},
				});
			});

			childProcess.on('exit', code => {
				if (code !== 0) {
					resolve({
						success: false,
						error: {
							code: 'command_failed',
							message: stderr || `bd command exited with code ${code}`,
							stderr,
						},
					});
					return;
				}

				try {
					// Handle empty output (e.g., no results)
					if (stdout.trim() === '' || stdout.trim() === '[]') {
						resolve({
							success: true,
							data: [] as unknown as T,
						});
						return;
					}

					const data = JSON.parse(stdout) as T;
					resolve({
						success: true,
						data,
					});
				} catch {
					resolve({
						success: false,
						error: {
							code: 'parse_failed',
							message: `Failed to parse bd output as JSON: ${stdout.slice(
								0,
								100,
							)}`,
						},
					});
				}
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			resolve({
				success: false,
				error: {
					code: 'command_failed',
					message: `Failed to spawn bd process: ${errorMessage}`,
				},
			});
		}
	});
}

/**
 * Converts a raw issue from bd output to a BeadsIssue type
 */
function toBeadsIssue(raw: RawBeadsIssue): BeadsIssue {
	// Extract blocked_by from dependencies with type "blocks" or from direct blocked_by field
	const blockedBy: string[] =
		raw.blocked_by ??
		raw.dependencies
			?.filter(dep => dep.dependency_type === 'blocks')
			.map(dep => dep.id) ??
		[];

	// Extract blocks (reverse of blocked_by - issues that this issue blocks)
	// This information comes from the dependent_count but we'd need separate queries
	// For now, we return empty array - will be populated by getIssueDetails if needed
	const blocks: string[] = [];

	return {
		id: raw.id,
		title: raw.title,
		type: raw.issue_type as BeadsIssueType,
		status: raw.status as BeadsStatus,
		priority: raw.priority as BeadsPriority,
		description: raw.description ?? '',
		blockedBy,
		blocks,
		parent: raw.parent,
		labels: raw.labels ?? [],
	};
}

/**
 * Checks if an issue has the 'hold' label (excluded from automation)
 */
function hasHoldLabel(issue: BeadsIssue): boolean {
	return issue.labels.some(label => label.toLowerCase() === 'hold');
}

/**
 * Gets all open tickets (any type) excluding those with 'hold' label
 * Returns ticket summaries with child counts for display in selector
 *
 * @returns Promise resolving to array of ticket summaries
 */
export async function getTickets(): Promise<
	BeadsCommandResult<TicketSummary[]>
> {
	// Get all open issues (any type)
	const result = await runBeadsCommand<RawBeadsIssue[]>([
		'list',
		'--status=open',
		'--limit=0',
	]);

	if (!result.success) {
		return result;
	}

	// Also get in_progress issues
	const inProgressResult = await runBeadsCommand<RawBeadsIssue[]>([
		'list',
		'--status=in_progress',
		'--limit=0',
	]);

	const allIssues = [
		...result.data,
		...(inProgressResult.success ? inProgressResult.data : []),
	];

	// Filter out issues with 'hold' label
	const filteredIssues = allIssues.filter(
		issue => !(issue.labels ?? []).some(l => l.toLowerCase() === 'hold'),
	);

	// Build summaries with child counts
	const summaries: TicketSummary[] = [];

	for (const issue of filteredIssues) {
		// Get all children of this issue (including closed)
		const childrenResult = await runBeadsCommand<RawBeadsIssue[]>([
			'list',
			`--parent=${issue.id}`,
			'--all',
			'--limit=0',
		]);

		// Get blocked children
		const blockedResult = await runBeadsCommand<RawBeadsIssue[]>([
			'blocked',
			`--parent=${issue.id}`,
		]);

		const children = childrenResult.success ? childrenResult.data : [];
		const blocked = blockedResult.success ? blockedResult.data : [];

		const openCount = children.filter(c => c.status !== 'closed').length;
		const closedCount = children.filter(c => c.status === 'closed').length;
		const total = openCount + closedCount;
		const progress = total > 0 ? Math.round((closedCount / total) * 100) : 0;

		summaries.push({
			id: issue.id,
			title: issue.title,
			type: issue.issue_type as BeadsIssueType,
			progress,
			openCount,
			closedCount,
			hasBlockedTasks: blocked.length > 0,
		});
	}

	return {
		success: true,
		data: summaries,
	};
}

/**
 * @deprecated Use getTickets instead
 * Gets all epics with task counts and progress percentage
 *
 * @returns Promise resolving to array of epic summaries
 */
export async function getEpics(): Promise<BeadsCommandResult<TicketSummary[]>> {
	const result = await runBeadsCommand<RawBeadsIssue[]>([
		'list',
		'--type=epic',
		'--all',
		'--limit=0',
	]);

	if (!result.success) {
		return result;
	}

	// For each epic, we need to get child counts
	const summaries: TicketSummary[] = [];

	for (const epic of result.data) {
		// Get all children of this epic (including closed)
		const childrenResult = await runBeadsCommand<RawBeadsIssue[]>([
			'list',
			`--parent=${epic.id}`,
			'--all',
			'--limit=0',
		]);

		// Get blocked children
		const blockedResult = await runBeadsCommand<RawBeadsIssue[]>([
			'blocked',
			`--parent=${epic.id}`,
		]);

		const children = childrenResult.success ? childrenResult.data : [];
		const blocked = blockedResult.success ? blockedResult.data : [];

		const openCount = children.filter(c => c.status !== 'closed').length;
		const closedCount = children.filter(c => c.status === 'closed').length;
		const total = openCount + closedCount;
		const progress = total > 0 ? Math.round((closedCount / total) * 100) : 0;

		summaries.push({
			id: epic.id,
			title: epic.title,
			type: 'epic',
			progress,
			openCount,
			closedCount,
			hasBlockedTasks: blocked.length > 0,
		});
	}

	return {
		success: true,
		data: summaries,
	};
}

/**
 * Gets all direct children within a ticket
 *
 * @param ticketId - The ticket ID to get children for
 * @returns Promise resolving to array of direct children
 */
export async function getTicketChildren(
	ticketId: string,
): Promise<BeadsCommandResult<BeadsIssue[]>> {
	const result = await runBeadsCommand<RawBeadsIssue[]>([
		'list',
		`--parent=${ticketId}`,
		'--all',
		'--limit=0',
	]);

	if (!result.success) {
		return result;
	}

	return {
		success: true,
		data: result.data.map(raw => toBeadsIssue(raw)),
	};
}

/**
 * Gets all descendants of a ticket recursively (children, grandchildren, etc.)
 *
 * @param ticketId - The ticket ID to get descendants for
 * @returns Promise resolving to array of all descendants
 */
export async function getTicketDescendants(
	ticketId: string,
): Promise<BeadsCommandResult<BeadsIssue[]>> {
	const allDescendants: BeadsIssue[] = [];
	const toProcess = [ticketId];
	const processed = new Set<string>();

	while (toProcess.length > 0) {
		const currentId = toProcess.pop()!;
		if (processed.has(currentId)) continue;
		processed.add(currentId);

		const childrenResult = await getTicketChildren(currentId);
		if (!childrenResult.success) {
			return childrenResult;
		}

		for (const child of childrenResult.data) {
			allDescendants.push(child);
			toProcess.push(child.id);
		}
	}

	return {
		success: true,
		data: allDescendants,
	};
}

/**
 * Gets all tickets in the project (for "all tickets" mode list display)
 * Includes open, in_progress, and closed tickets for sidebar display
 * Excludes tickets with 'hold' label
 *
 * @returns Promise resolving to array of all tickets
 */
export async function getAllOpenTickets(): Promise<
	BeadsCommandResult<BeadsIssue[]>
> {
	// Get all issues (open, in_progress, closed) using --all flag
	const result = await runBeadsCommand<RawBeadsIssue[]>([
		'list',
		'--all',
		'--limit=0',
	]);

	if (!result.success) {
		return result;
	}

	// Convert to BeadsIssue and filter out 'hold' labeled tickets
	const tickets = result.data.map(raw => toBeadsIssue(raw));
	const filteredTickets = tickets.filter(t => !hasHoldLabel(t));

	return {
		success: true,
		data: filteredTickets,
	};
}

/**
 * @deprecated Use getTicketChildren instead
 * Gets all tasks within an epic (recursively for nested issues)
 *
 * @param epicId - The epic ID to get tasks for
 * @returns Promise resolving to array of tasks in the epic
 */
export async function getEpicTasks(
	epicId: string,
): Promise<BeadsCommandResult<BeadsIssue[]>> {
	return getTicketChildren(epicId);
}

/**
 * Gets ready (unblocked) tasks within an epic
 *
 * @param epicId - The epic ID to get ready tasks for
 * @returns Promise resolving to array of ready tasks
 */
export async function getReadyTasks(
	epicId: string,
): Promise<BeadsCommandResult<BeadsIssue[]>> {
	const result = await runBeadsCommand<RawBeadsIssue[]>([
		'ready',
		`--parent=${epicId}`,
		'--limit=0',
	]);

	if (!result.success) {
		return result;
	}

	return {
		success: true,
		data: result.data.map(raw => toBeadsIssue(raw)),
	};
}

/**
 * Gets tasks outside the epic that block tasks inside the epic
 *
 * @param epicId - The epic ID to check for external blockers
 * @returns Promise resolving to array of external blocking tasks
 */
export async function getExternalBlockers(
	epicId: string,
): Promise<BeadsCommandResult<BeadsIssue[]>> {
	// First get all blocked tasks in the epic
	const blockedResult = await runBeadsCommand<RawBeadsIssue[]>([
		'blocked',
		`--parent=${epicId}`,
	]);

	if (!blockedResult.success) {
		return blockedResult;
	}

	// Get all tasks in the epic to know what's internal
	const epicTasksResult = await runBeadsCommand<RawBeadsIssue[]>([
		'list',
		`--parent=${epicId}`,
		'--all',
		'--limit=0',
	]);

	if (!epicTasksResult.success) {
		return epicTasksResult;
	}

	const epicTaskIds = new Set(epicTasksResult.data.map(t => t.id));
	epicTaskIds.add(epicId); // Include the epic itself

	// Collect external blocker IDs
	const externalBlockerIds = new Set<string>();
	for (const blocked of blockedResult.data) {
		if (blocked.blocked_by) {
			for (const blockerId of blocked.blocked_by) {
				if (!epicTaskIds.has(blockerId)) {
					externalBlockerIds.add(blockerId);
				}
			}
		}
	}

	// Fetch details for external blockers
	const externalBlockers: BeadsIssue[] = [];
	for (const blockerId of externalBlockerIds) {
		const detailResult = await getIssueDetails(blockerId);
		if (detailResult.success && detailResult.data) {
			externalBlockers.push(detailResult.data);
		}
	}

	return {
		success: true,
		data: externalBlockers,
	};
}

/**
 * Result type for sync operation
 */
export type BeadsSyncResult = {
	success: boolean;
	message?: string;
	error?: string;
};

/**
 * Runs bd sync to synchronize beads state with git remote
 *
 * @returns Promise resolving to sync result
 */
export async function runBeadsSync(): Promise<BeadsSyncResult> {
	// Check if beads is initialized
	if (!existsSync('.beads')) {
		return {
			success: false,
			error: 'Beads is not initialized',
		};
	}

	return new Promise(resolve => {
		try {
			// Note: bd sync doesn't support --json, so we just run it and capture output
			const childProcess = spawn('bd', ['sync'], {
				stdio: ['ignore', 'pipe', 'pipe'],
				shell: false,
			});

			let stdout = '';
			let stderr = '';

			childProcess.stdout?.on('data', (data: Buffer) => {
				stdout += data.toString();
			});

			childProcess.stderr?.on('data', (data: Buffer) => {
				stderr += data.toString();
			});

			childProcess.on('error', (error: Error) => {
				resolve({
					success: false,
					error: `Failed to run bd sync: ${error.message}`,
				});
			});

			childProcess.on('exit', code => {
				if (code !== 0) {
					resolve({
						success: false,
						error: stderr || `bd sync exited with code ${code}`,
					});
					return;
				}

				resolve({
					success: true,
					message: stdout.trim() || 'Sync complete',
				});
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			resolve({
				success: false,
				error: `Failed to run bd sync: ${errorMessage}`,
			});
		}
	});
}

/**
 * Gets detailed information for a specific issue
 *
 * @param issueId - The issue ID to get details for
 * @returns Promise resolving to the issue details or null if not found
 */
export async function getIssueDetails(
	issueId: string,
): Promise<BeadsCommandResult<BeadsIssue | null>> {
	const result = await runBeadsCommand<RawBeadsIssue[]>(['show', issueId]);

	if (!result.success) {
		return result as BeadsCommandResult<null>;
	}

	if (result.data.length === 0) {
		return {
			success: true,
			data: null,
		};
	}

	const raw = result.data[0];
	if (!raw) {
		return {
			success: true,
			data: null,
		};
	}

	const issue = toBeadsIssue(raw);

	// For show command, we can also extract blocks from reverse lookup
	// The dependencies array includes both "blocks" and "blocked-by" types
	// We need to query with --refs to get what this issue blocks
	const refsResult = await runBeadsCommand<RawBeadsIssue[]>([
		'show',
		issueId,
		'--refs',
	]);

	if (refsResult.success && refsResult.data.length > 1) {
		// The first item is the issue itself, rest are references
		// Filter for issues that have this issue in their blocked_by
		// Since --refs shows reverse lookups, these are issues that depend on us
		issue.blocks = refsResult.data
			.slice(1)
			.filter(ref => ref.dependencies?.some(d => d.id === issueId))
			.map(ref => ref.id);
	}

	return {
		success: true,
		data: issue,
	};
}
