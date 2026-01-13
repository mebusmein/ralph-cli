import {EventEmitter} from 'node:events';
import type {UserStory} from '../types/prd.js';
import type {StoryWithStatus} from '../types/state.js';
import {executeClaudeCommand} from './claude-executor.js';
import {readPRDFile} from './prd-reader.js';
import {updateStoryStatus} from './prd-writer.js';
import {detectStoryIdFromOutput} from './story-detector.js';
import {
	createStreamFormatter,
	type FormattedOutput,
} from './stream-formatter.js';

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
	 * Emitted when Claude outputs data (filtered to show mainly assistant messages)
	 */
	output: [data: FormattedOutput[]];

	/**
	 * Emitted when a story completes (successfully or not)
	 */
	storyComplete: [storyId: string, success: boolean];

	/**
	 * Emitted when the detected story ID differs from the expected story
	 */
	storyMismatch: [expectedId: string, detectedId: string];

	/**
	 * Emitted when no story ID could be detected from AI output (warning)
	 */
	storyDetectionFailed: [fallbackId: string];

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

	/**
	 * Optional function that returns true when we should stop after the current iteration.
	 * Unlike abortSignal which kills the current process, this allows the current
	 * iteration to complete before stopping.
	 */
	shouldStopAfterIteration?: () => boolean;
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
	const {
		iterations,
		prdPath,
		promptGenerator,
		logFile,
		shouldStopAfterIteration,
	} = options;

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

		// Create stream formatter for this iteration
		const streamFormatter = createStreamFormatter();

		const result = await executeClaudeCommand({
			prompt,
			onOutput: data => {
				const filtered = streamFormatter.processChunk(data);
				if (filtered.length > 0) {
					emitter.emit('output', filtered);
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
			// Get raw text content from the AI output for story detection
			const rawOutput = streamFormatter.getRawTextContent();
			const detectionResult = detectStoryIdFromOutput(rawOutput);

			// Determine which story ID to use for updating
			let storyIdToMark = nextStory.id;

			if (detectionResult) {
				const detectedId = detectionResult.storyId;

				// Verify the detected story exists in the PRD
				const storyExists = config.userStories.some(s => s.id === detectedId);

				if (storyExists) {
					if (detectedId !== nextStory.id) {
						// Detected story differs from pre-selected story
						emitter.emit('storyMismatch', nextStory.id, detectedId);
					}
					storyIdToMark = detectedId;
				} else {
					// Detected story doesn't exist in PRD, fall back to pre-selected
					emitter.emit(
						'error',
						`Detected story ${detectedId} not found in PRD, using ${nextStory.id}`,
					);
				}
			} else {
				// No story ID detected, fall back to pre-selected story with warning
				emitter.emit('storyDetectionFailed', nextStory.id);
			}

			// Update story status in PRD
			const updateResult = updateStoryStatus(prdPath, storyIdToMark, {
				passes: true,
			});

			if (!updateResult.success) {
				emitter.emit('error', updateResult.error.message);
			}

			emitter.emit('storyComplete', storyIdToMark, true);
		}

		emitter.emit('iterationComplete', i);

		// Check if we should stop after this iteration (graceful stop)
		if (shouldStopAfterIteration?.()) {
			emitter.emit('complete', 'stopped');
			return;
		}
	}

	emitter.emit('complete', 'finished');
}
