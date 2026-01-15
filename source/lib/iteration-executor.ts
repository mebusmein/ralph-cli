import {EventEmitter} from 'node:events';
import type {BeadsIssue} from '../types/beads.js';
import type {UserStory} from '../types/prd.js';
import type {StoryWithStatus} from '../types/state.js';
import {executeClaudeCommand} from './claude-executor.js';
import {getReadyTasks, getEpicTasks, runBeadsCommand} from './beads-reader.js';
import {
	createStreamFormatter,
	type FormattedOutput,
} from './stream-formatter.js';
// Legacy imports for backward compatibility
import {readPRDFile} from './prd-reader.js';
import {updateStoryStatus} from './prd-writer.js';
import {detectStoryIdFromOutput} from './story-detector.js';

/**
 * Events emitted by the iteration executor
 */
export type IterationExecutorEvents = {
	/**
	 * Emitted when iteration starts
	 */
	iterationStart: [iteration: number, totalIterations: number];

	/**
	 * Emitted when a task starts execution (beads workflow)
	 */
	taskStart: [task: BeadsIssue];

	/**
	 * Emitted when a story starts execution (legacy PRD workflow)
	 * @deprecated Use taskStart for beads workflow
	 */
	storyStart: [story: UserStory];

	/**
	 * Emitted when Claude outputs data (filtered to show mainly assistant messages)
	 */
	output: [data: FormattedOutput[]];

	/**
	 * Emitted when a task completes (beads workflow)
	 */
	taskComplete: [taskId: string, success: boolean];

	/**
	 * Emitted when a story completes (legacy PRD workflow)
	 * @deprecated Use taskComplete for beads workflow
	 */
	storyComplete: [storyId: string, success: boolean];

	/**
	 * Emitted when the detected story ID differs from the expected story (legacy)
	 * @deprecated Only used in legacy PRD workflow
	 */
	storyMismatch: [expectedId: string, detectedId: string];

	/**
	 * Emitted when no story ID could be detected from AI output (legacy)
	 * @deprecated Only used in legacy PRD workflow
	 */
	storyDetectionFailed: [fallbackId: string];

	/**
	 * Emitted when no ready tasks are available (all blocked or closed)
	 */
	noReadyTasks: [];

	/**
	 * Emitted when the epic is complete (all tasks closed or blocked)
	 */
	epicComplete: [epicId: string];

	/**
	 * Emitted when iteration completes
	 */
	iterationComplete: [iteration: number];

	/**
	 * Emitted when all iterations are done or stopped early
	 */
	complete: [
		reason:
			| 'finished'
			| 'all_passed'
			| 'all_closed'
			| 'no_ready_tasks'
			| 'stopped'
			| 'error'
			| 'epic_complete',
	];

	/**
	 * Emitted when an error occurs
	 */
	error: [error: string];
};

/**
 * Options for running iterations - beads workflow
 */
export type BeadsIterationOptions = {
	/**
	 * Number of iterations to run
	 */
	iterations: number;

	/**
	 * ID of the epic to work on
	 */
	epicId: string;

	/**
	 * Function to generate the prompt for the epic
	 */
	promptGenerator: () => string;

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
 * Options for running iterations - legacy PRD workflow
 * @deprecated Use BeadsIterationOptions with epicId instead
 */
export type LegacyIterationOptions = {
	/**
	 * Number of iterations to run
	 */
	iterations: number;

	/**
	 * Path to the PRD file
	 * @deprecated Use epicId for beads workflow
	 */
	prdPath: string;

	/**
	 * Function to generate the prompt for a story
	 * @deprecated Use promptGenerator() without args for beads workflow
	 */
	promptGenerator: (story: UserStory) => string;

	/**
	 * Optional path to log raw JSON output
	 */
	logFile?: string;

	/**
	 * Optional function that returns true when we should stop after the current iteration.
	 */
	shouldStopAfterIteration?: () => boolean;
};

/**
 * Options for running iterations
 * Supports both legacy PRD workflow and new beads workflow
 */
export type IterationOptions = BeadsIterationOptions | LegacyIterationOptions;

/**
 * Creates a typed event emitter for iteration events
 */
export function createIterationEmitter(): EventEmitter<IterationExecutorEvents> {
	return new EventEmitter<IterationExecutorEvents>();
}

/**
 * Finds the highest priority ready task from the list
 */
export function findNextReadyTask(tasks: BeadsIssue[]): BeadsIssue | undefined {
	return tasks
		.filter(task => task.status !== 'closed' && task.blockedBy.length === 0)
		.sort((a, b) => a.priority - b.priority)[0];
}

/**
 * Checks if an epic is complete (all tasks closed or all remaining tasks blocked)
 *
 * @param epicId - The epic ID to check
 * @returns Promise resolving to true if epic is complete
 */
async function isEpicComplete(epicId: string): Promise<boolean> {
	const tasksResult = await getEpicTasks(epicId);
	if (!tasksResult.success) {
		return false;
	}

	const tasks = tasksResult.data;
	if (tasks.length === 0) {
		return true;
	}

	// All tasks must be either closed or blocked
	for (const task of tasks) {
		if (task.status !== 'closed' && task.blockedBy.length === 0) {
			return false;
		}
	}

	return true;
}

/**
 * Adds a comment to a task for failure tracking
 *
 * @param taskId - The task ID to add comment to
 * @param comment - The comment text
 */
async function addTaskComment(taskId: string, comment: string): Promise<void> {
	await runBeadsCommand(['comments', 'add', taskId, comment]);
}

// ============================================================================
// LEGACY COMPATIBILITY FUNCTIONS
// These functions are kept for backward compatibility with app.tsx
// until US-046 updates the app for beads workflow
// ============================================================================

/**
 * Determines the status of a story based on its state and current execution
 * @deprecated Use beads status directly instead
 */
function getStoryStatus(
	story: UserStory,
	currentStoryId: string | null,
): StoryWithStatus['status'] {
	if (story.passes) {
		return 'passed';
	}

	if (story.id === currentStoryId) {
		return 'in-progress';
	}

	return 'pending';
}

/**
 * Converts UserStory array to StoryWithStatus array based on current execution state
 * @deprecated Use beads tasks directly instead. This is kept for backward compatibility.
 */
export function getStoriesWithStatus(
	stories: UserStory[],
	currentStoryId: string | null,
): StoryWithStatus[] {
	return stories.map(story => ({
		...story,
		status: getStoryStatus(story, currentStoryId),
	}));
}

/**
 * Finds the highest priority story that hasn't passed yet
 * @deprecated Use findNextReadyTask for beads workflow
 */
export function findNextIncompleteStory(
	stories: UserStory[],
): UserStory | undefined {
	return stories
		.filter(story => !story.passes)
		.sort((a, b) => a.priority - b.priority)[0];
}

/**
 * Legacy iteration runner for PRD workflow
 * @deprecated Use beads workflow with epicId instead
 */
async function runLegacyIterations(
	options: LegacyIterationOptions,
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

// ============================================================================
// END LEGACY COMPATIBILITY
// ============================================================================

/**
 * Type guard to check if options are for beads workflow
 */
function isBeadsOptions(
	options: IterationOptions,
): options is BeadsIterationOptions {
	return 'epicId' in options;
}

/**
 * Runs the iteration execution loop
 *
 * Supports both legacy PRD workflow and new beads workflow.
 * When using beads workflow (epicId provided), it will:
 * - Poll beads for ready tasks before each iteration
 * - Skip iterations when no ready tasks (no Claude call)
 * - Auto-close epic when all tasks are closed or blocked
 * - Add failure comments to issues on task failure
 *
 * @param options - Execution options (BeadsIterationOptions or LegacyIterationOptions)
 * @param emitter - Event emitter for progress updates
 * @param abortSignal - Optional signal to abort execution
 * @returns Promise that resolves when execution completes
 */
export async function runIterations(
	options: IterationOptions,
	emitter: EventEmitter<IterationExecutorEvents>,
	abortSignal?: AbortSignal,
): Promise<void> {
	// Check if using beads workflow or legacy PRD workflow
	if (!isBeadsOptions(options)) {
		// Legacy PRD workflow - delegate to legacy runner
		await runLegacyIterations(options, emitter, abortSignal);
		return;
	}

	const {
		iterations,
		epicId,
		promptGenerator,
		logFile,
		shouldStopAfterIteration,
	} = options;

	// Track which task is currently being worked on (for failure comments)
	let currentTaskId: string | null = null;

	for (let i = 1; i <= iterations; i++) {
		// Check for abort before starting iteration
		if (abortSignal?.aborted) {
			emitter.emit('complete', 'stopped');
			return;
		}

		emitter.emit('iterationStart', i, iterations);

		// Poll beads for ready tasks before each iteration
		const readyResult = await getReadyTasks(epicId);
		if (!readyResult.success) {
			emitter.emit('error', readyResult.error.message);
			emitter.emit('complete', 'error');
			return;
		}

		const readyTasks = readyResult.data;

		// No ready tasks - check if epic is complete or all tasks are blocked
		if (readyTasks.length === 0) {
			emitter.emit('noReadyTasks');

			// Check if epic is complete (all closed or all blocked)
			const epicComplete = await isEpicComplete(epicId);
			if (epicComplete) {
				// Auto-close the epic
				await runBeadsCommand(['close', epicId]);
				emitter.emit('epicComplete', epicId);
				emitter.emit('complete', 'epic_complete');
				return;
			}

			// Tasks exist but all are blocked - stop execution
			emitter.emit('complete', 'no_ready_tasks');
			return;
		}

		// Find the highest priority ready task
		const nextTask = findNextReadyTask(readyTasks);

		if (!nextTask) {
			// Shouldn't happen since readyTasks.length > 0, but handle gracefully
			emitter.emit('noReadyTasks');
			emitter.emit('complete', 'no_ready_tasks');
			return;
		}

		currentTaskId = nextTask.id;
		emitter.emit('taskStart', nextTask);

		// Generate prompt with epic context
		const prompt = promptGenerator();

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
				emitter.emit('taskComplete', currentTaskId, false);
				emitter.emit('complete', 'stopped');
				return;
			}

			// On task failure, add a comment to the issue
			const errorMessage = result.error.message;
			emitter.emit('error', errorMessage);
			await addTaskComment(currentTaskId, `Iteration failed: ${errorMessage}`);
			emitter.emit('taskComplete', currentTaskId, false);
			// Continue to next iteration even on error
		} else {
			// Task execution completed successfully
			emitter.emit('taskComplete', currentTaskId, true);
		}

		emitter.emit('iterationComplete', i);

		// Poll beads after iteration to check if epic is now complete
		const postIterationComplete = await isEpicComplete(epicId);
		if (postIterationComplete) {
			// Auto-close the epic
			await runBeadsCommand(['close', epicId]);
			emitter.emit('epicComplete', epicId);
			emitter.emit('complete', 'epic_complete');
			return;
		}

		// Check if we should stop after this iteration (graceful stop)
		if (shouldStopAfterIteration?.()) {
			emitter.emit('complete', 'stopped');
			return;
		}
	}

	emitter.emit('complete', 'finished');
}
