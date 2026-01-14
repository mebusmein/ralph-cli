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
 * Claude execution options
 */
export type ClaudeExecutionOptions = {
	prompt: string;
	onOutput?: (data: string) => void;
	signal?: AbortSignal;
	logFile?: string;
};
