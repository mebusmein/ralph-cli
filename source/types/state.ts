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
export type AppView = 'setup' | 'epic-select' | 'no-prd' | 'main' | 'error';
