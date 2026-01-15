/**
 * Status values for beads issues
 */
export type BeadsStatus = 'open' | 'in_progress' | 'closed';

/**
 * Type values for beads issues
 */
export type BeadsIssueType = 'task' | 'bug' | 'feature' | 'epic';

/**
 * Priority values for beads issues (0=critical, 4=backlog)
 */
export type BeadsPriority = 0 | 1 | 2 | 3 | 4;

/**
 * Represents a single issue in the beads system
 */
export type BeadsIssue = {
	id: string;
	title: string;
	type: BeadsIssueType;
	status: BeadsStatus;
	priority: BeadsPriority;
	description: string;
	blockedBy: string[];
	blocks: string[];
	parent: string | undefined;
	labels: string[];
};

/**
 * Summary information for a ticket including progress metrics
 * Used in the ticket selector to display ticket info with child counts
 */
export type TicketSummary = {
	id: string;
	title: string;
	type: BeadsIssueType;
	progress: number;
	openCount: number;
	closedCount: number;
	hasBlockedTasks: boolean;
};

/**
 * @deprecated Use TicketSummary instead
 */
export type EpicSummary = TicketSummary;

/**
 * Result type for bd command execution
 */
export type BeadsCommandResult<T> =
	| {success: true; data: T}
	| {success: false; error: BeadsCommandError};

/**
 * Error information from bd command failures
 */
export type BeadsCommandError = {
	code: 'command_failed' | 'parse_failed' | 'not_initialized';
	message: string;
	stderr?: string;
};
