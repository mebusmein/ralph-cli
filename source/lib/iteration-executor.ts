import {EventEmitter} from 'node:events';
import type {UserStory} from '../types/prd.js';
import type {StoryWithStatus} from '../types/state.js';
import {executeClaudeCommand} from './claude-executor.js';
import {readPRDFile} from './prd-reader.js';
import {updateStoryStatus} from './prd-writer.js';
import {createStreamFormatter} from './stream-formatter.js';

/**
 * Events emitted by the iteration executor
 */
export type IterationExecutorEvents = {
	/**
	 * Emitted when iteration starts
	 */
	iterationStart: [iteration: number, totalIterations: number];

	/**
	 * Emitted when a story starts execution
	 */
	storyStart: [story: UserStory];

	/**
	 * Emitted when Claude outputs data
	 */
	output: [data: string];

	/**
	 * Emitted when a story completes (successfully or not)
	 */
	storyComplete: [storyId: string, success: boolean];

	/**
	 * Emitted when iteration completes
	 */
	iterationComplete: [iteration: number];

	/**
	 * Emitted when all iterations are done or stopped early
	 */
	complete: [reason: 'finished' | 'all_passed' | 'stopped' | 'error'];

	/**
	 * Emitted when an error occurs
	 */
	error: [error: string];
};

/**
 * Options for running iterations
 */
export type IterationOptions = {
	/**
	 * Number of iterations to run
	 */
	iterations: number;

	/**
	 * Path to the PRD file
	 */
	prdPath: string;

	/**
	 * Function to generate the prompt for a story
	 */
	promptGenerator: (story: UserStory) => string;

	/**
	 * Optional path to log raw JSON output
	 */
	logFile?: string;
};

/**
 * Creates a typed event emitter for iteration events
 */
export function createIterationEmitter(): EventEmitter<IterationExecutorEvents> {
	return new EventEmitter<IterationExecutorEvents>();
}

/**
 * Finds the highest priority story that hasn't passed yet
 */
export function findNextIncompleteStory(
	stories: UserStory[],
): UserStory | undefined {
	return stories
		.filter(story => !story.passes)
		.sort((a, b) => a.priority - b.priority)[0];
}

/**
 * Converts UserStory array to StoryWithStatus array based on current execution state
 */
export function getStoriesWithStatus(
	stories: UserStory[],
	currentStoryId: string | null,
): StoryWithStatus[] {
	return stories.map(story => ({
		...story,
		status: story.passes
			? 'passed'
			: story.id === currentStoryId
			? 'in-progress'
			: 'pending',
	}));
}

/**
 * Runs the iteration execution loop
 *
 * @param options - Execution options
 * @param emitter - Event emitter for progress updates
 * @param abortSignal - Optional signal to abort execution
 * @returns Promise that resolves when execution completes
 */
export async function runIterations(
	options: IterationOptions,
	emitter: EventEmitter<IterationExecutorEvents>,
	abortSignal?: AbortSignal,
): Promise<void> {
	const {iterations, prdPath, promptGenerator, logFile} = options;

	for (let i = 1; i <= iterations; i++) {
		// Check for abort before starting iteration
		if (abortSignal?.aborted) {
			emitter.emit('complete', 'stopped');
			return;
		}

		emitter.emit('iterationStart', i, iterations);

		// Re-read PRD at start of each iteration to get latest state
		const readResult = readPRDFile(prdPath);
		if (!readResult.success) {
			emitter.emit('error', readResult.error.message);
			emitter.emit('complete', 'error');
			return;
		}

		const {config} = readResult;

		// Find next incomplete story
		const nextStory = findNextIncompleteStory(config.userStories);

		// All stories complete - stop early
		if (!nextStory) {
			emitter.emit('complete', 'all_passed');
			return;
		}

		emitter.emit('storyStart', nextStory);

		// Generate prompt and execute Claude
		const prompt = promptGenerator(nextStory);

		// Create a stream formatter for this iteration
		const streamFormatter = createStreamFormatter();

		const result = await executeClaudeCommand({
			prompt,
			onOutput: data => {
				const formatted = streamFormatter.processChunk(data);
				if (formatted) {
					emitter.emit('output', formatted);
				}
			},
			signal: abortSignal,
			logFile,
		});

		if (!result.success) {
			if (result.error.type === 'aborted') {
				emitter.emit('storyComplete', nextStory.id, false);
				emitter.emit('complete', 'stopped');
				return;
			}

			emitter.emit('error', result.error.message);
			emitter.emit('storyComplete', nextStory.id, false);
			// Continue to next iteration even on error
		} else {
			// Update story status in PRD
			const updateResult = updateStoryStatus(prdPath, nextStory.id, {
				passes: true,
			});

			if (!updateResult.success) {
				emitter.emit('error', updateResult.error.message);
			}

			emitter.emit('storyComplete', nextStory.id, true);
		}

		emitter.emit('iterationComplete', i);
	}

	emitter.emit('complete', 'finished');
}
