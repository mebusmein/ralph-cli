/**
 * Paths used by the application
 */
export type RalphPaths = {
	ralphDir: string;
	prdFile: string;
	progressFile: string;
	promptFile: string;
	skillsDir: string;
	ralphPlanSkill: string;
};

/**
 * Setup check result for a single item
 */
export type SetupCheckItem = {
	name: string;
	exists: boolean;
	path: string;
};

/**
 * Result of checking the setup status
 */
export type SetupCheckResult = {
	isComplete: boolean;
	items: SetupCheckItem[];
};

/**
 * CLI arguments/flags
 */
export type CLIFlags = {
	iterations?: number;
	single?: boolean;
	help?: boolean;
};

/**
 * Claude execution options
 */
export type ClaudeExecutionOptions = {
	prompt: string;
	onOutput?: (data: string) => void;
	signal?: AbortSignal;
	logFile?: string;
};

/**
 * Claude stream event types
 */
export type ClaudeEventType =
	| 'system'
	| 'message_start'
	| 'content_block_start'
	| 'content_block_delta'
	| 'content_block_stop'
	| 'message_delta'
	| 'message_stop'
	| 'result';

/**
 * Base Claude stream event
 */
export type ClaudeStreamEvent = {
	type: ClaudeEventType;
	[key: string]: unknown;
};

/**
 * Claude content block delta event
 */
export type ClaudeContentBlockDelta = {
	type: 'content_block_delta';
	index: number;
	delta: {
		type: 'text_delta';
		text: string;
	};
};

/**
 * Claude result event
 */
export type ClaudeResultEvent = {
	type: 'result';
	result: string;
	cost_usd: number;
	is_error: boolean;
	duration_ms: number;
	duration_api_ms: number;
};
