import {writeFileSync} from 'node:fs';
import type {PRDConfig} from '../types/prd.js';
import {readPRDFile} from './prd-reader.js';

/**
 * Result of writing a PRD file
 */
export type PRDWriteResult =
	| {success: true}
	| {success: false; error: PRDWriteError};

/**
 * Error types for PRD writing operations
 */
export type PRDWriteError = {
	type: 'write_failed' | 'story_not_found' | 'read_failed';
	message: string;
};

/**
 * Options for updating a story's status
 */
export type StoryUpdateOptions = {
	passes?: boolean;
	notes?: string;
};

/**
 * Writes a PRDConfig to the specified file path
 * Uses pretty printing with tabs for formatting
 *
 * @param filePath - Path to write the prd.json file
 * @param config - The PRDConfig to write
 * @returns PRDWriteResult indicating success or failure
 */
export function writePRDFile(
	filePath: string,
	config: PRDConfig,
): PRDWriteResult {
	try {
		const json = JSON.stringify(config, null, '\t');
		writeFileSync(filePath, json + '\n', 'utf8');
		return {success: true};
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException;
		return {
			success: false,
			error: {
				type: 'write_failed',
				message: `Failed to write PRD file: ${nodeError.message}`,
			},
		};
	}
}

/**
 * Updates a single story's status in a PRD file
 * Reads the file, updates the story, and writes it back
 *
 * @param filePath - Path to the prd.json file
 * @param storyId - The ID of the story to update
 * @param options - The fields to update (passes, notes)
 * @returns PRDWriteResult indicating success or failure
 */
export function updateStoryStatus(
	filePath: string,
	storyId: string,
	options: StoryUpdateOptions,
): PRDWriteResult {
	const readResult = readPRDFile(filePath);

	if (!readResult.success) {
		return {
			success: false,
			error: {
				type: 'read_failed',
				message: readResult.error.message,
			},
		};
	}

	const {config} = readResult;
	const storyIndex = config.userStories.findIndex(s => s.id === storyId);

	if (storyIndex === -1) {
		return {
			success: false,
			error: {
				type: 'story_not_found',
				message: `Story with ID "${storyId}" not found in PRD`,
			},
		};
	}

	const story = config.userStories[storyIndex];

	if (story) {
		if (options.passes !== undefined) {
			story.passes = options.passes;
		}

		if (options.notes !== undefined) {
			story.notes = options.notes;
		}
	}

	return writePRDFile(filePath, config);
}
