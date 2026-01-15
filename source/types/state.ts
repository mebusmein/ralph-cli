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
 * Setup wizard phases for unified layout
 */
export type SetupPhase =
	| 'checking'
	| 'prompt'
	| 'scaffolding'
	| 'complete'
	| 'error';

/**
 * Represents the current view/screen of the application
 * @deprecated Use unified layout with SetupPhase and content-based rendering instead
 */
export type AppView = 'setup' | 'ticket-select' | 'main' | 'error';
