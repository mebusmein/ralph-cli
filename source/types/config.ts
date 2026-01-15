/**
 * Paths used by the application
 */
export type RalphPaths = {
	ralphDir: string;
	beadsDir: string;
	/** @deprecated Use beadsDir instead. Will be removed in a future version. */
	prdFile: string;
	progressFile: string;
	promptFile: string;
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
	isBeadsInitialized: boolean;
	items: SetupCheckItem[];
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
