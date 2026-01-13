import {readFileSync} from 'node:fs';
import type {PRDConfig, UserStory} from '../types/prd.js';

/**
 * Result of reading a PRD file
 */
export type PRDReadResult =
	| {success: true; config: PRDConfig}
	| {success: false; error: PRDReadError};

/**
 * Error types for PRD reading operations
 */
export type PRDReadError = {
	type: 'file_not_found' | 'invalid_json' | 'invalid_structure';
	message: string;
};

/**
 * Validates that an object is a valid UserStory
 */
function isValidUserStory(obj: unknown): obj is UserStory {
	if (typeof obj !== 'object' || obj === null) {
		return false;
	}

	const story = obj as Record<string, unknown>;

	return (
		typeof story['id'] === 'string' &&
		typeof story['title'] === 'string' &&
		Array.isArray(story['acceptanceCriteria']) &&
		(story['acceptanceCriteria'] as unknown[]).every(
			c => typeof c === 'string',
		) &&
		typeof story['priority'] === 'number' &&
		typeof story['passes'] === 'boolean' &&
		typeof story['notes'] === 'string'
	);
}

/**
 * Validates that an object is a valid PRDConfig
 */
function isValidPRDConfig(obj: unknown): obj is PRDConfig {
	if (typeof obj !== 'object' || obj === null) {
		return false;
	}

	const config = obj as Record<string, unknown>;

	return (
		typeof config['branchName'] === 'string' &&
		Array.isArray(config['userStories']) &&
		(config['userStories'] as unknown[]).every(story => isValidUserStory(story))
	);
}

/**
 * Reads and parses a PRD file from the given path
 *
 * @param filePath - Path to the prd.json file
 * @returns PRDReadResult indicating success with config or failure with error
 */
export function readPRDFile(filePath: string): PRDReadResult {
	let content: string;

	try {
		content = readFileSync(filePath, 'utf8');
	} catch (error) {
		const nodeError = error as NodeJS.ErrnoException;
		if (nodeError.code === 'ENOENT') {
			return {
				success: false,
				error: {
					type: 'file_not_found',
					message: `PRD file not found: ${filePath}`,
				},
			};
		}

		return {
			success: false,
			error: {
				type: 'file_not_found',
				message: `Could not read PRD file: ${nodeError.message}`,
			},
		};
	}

	let parsed: unknown;

	try {
		parsed = JSON.parse(content);
	} catch {
		return {
			success: false,
			error: {
				type: 'invalid_json',
				message: 'PRD file contains invalid JSON',
			},
		};
	}

	if (!isValidPRDConfig(parsed)) {
		return {
			success: false,
			error: {
				type: 'invalid_structure',
				message:
					'PRD file structure is invalid. Expected branchName (string) and userStories (array)',
			},
		};
	}

	return {
		success: true,
		config: parsed,
	};
}
