import type {UserStory} from './prd.js';

/**
 * Represents the execution status of a story
 */
export type StoryStatus = 'pending' | 'in-progress' | 'passed' | 'failed';

/**
 * Represents a user story with its runtime status
 */
export type StoryWithStatus = UserStory & {
	status: StoryStatus;
};

/**
 * Represents the current view/screen of the application
 */
export type AppView =
	| 'setup'
	| 'no-prd'
	| 'iteration-prompt'
	| 'running'
	| 'complete';

/**
 * Represents the active tab in the main view
 */
export type ActiveTab = 'output' | 'progress';

/**
 * The main application state
 */
export type AppState = {
	view: AppView;
	activeTab: ActiveTab;
	stories: StoryWithStatus[];
	currentStoryId: string | null;
	currentIteration: number;
	totalIterations: number;
	output: string[];
	isRunning: boolean;
	stopRequested: boolean;
	error: string | null;
};

/**
 * Initial/default application state
 */
export const initialAppState: AppState = {
	view: 'setup',
	activeTab: 'output',
	stories: [],
	currentStoryId: null,
	currentIteration: 0,
	totalIterations: 0,
	output: [],
	isRunning: false,
	stopRequested: false,
	error: null,
};
