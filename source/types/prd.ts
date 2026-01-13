/**
 * Represents a single user story in the PRD
 */
export type UserStory = {
	id: string;
	title: string;
	acceptanceCriteria: string[];
	priority: number;
	passes: boolean;
	notes: string;
};

/**
 * The root configuration object for a PRD file
 */
export type PRDConfig = {
	branchName: string;
	userStories: UserStory[];
};
