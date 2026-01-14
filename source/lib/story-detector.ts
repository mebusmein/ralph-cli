/**
 * Story ID detector - parses AI output to find which story was actually worked on
 *
 * This solves the bug where the system marks the wrong story as complete because
 * the prompt generator ignores the story argument and the AI picks its own story.
 */

// Pattern for commit messages: feat: [US-XXX] or feat: US-XXX
const COMMIT_MESSAGE_PATTERN = /feat:\s*\[?(US-\d{3})\]?/gi;

// Pattern for general story ID mentions: US-001, US-002, etc.
const STORY_ID_PATTERN = /US-\d{3}/gi;

export type StoryDetectionResult = {
	storyId: string;
	source: 'commit' | 'mention';
} | null;

/**
 * Detects the story ID that was worked on from AI output.
 *
 * Prioritizes commit message matches over general mentions since commit messages
 * are the most reliable indicator of what was actually completed.
 *
 * Returns the last matched ID if multiple found (most recent work).
 * Returns null if no story ID found in output.
 *
 * @param output - The raw text output from the AI
 * @returns The detected story ID and source, or null if not found
 */
export function detectStoryIdFromOutput(output: string): StoryDetectionResult {
	// First, try to find story IDs in commit messages (highest priority)
	const commitMatches = [...output.matchAll(COMMIT_MESSAGE_PATTERN)];

	if (commitMatches.length > 0) {
		// Return the last commit message match (most recent)
		const lastMatch = commitMatches.at(-1);
		const capturedGroup = lastMatch?.[1];
		if (capturedGroup) {
			return {
				storyId: capturedGroup.toUpperCase(),
				source: 'commit',
			};
		}
	}

	// Fall back to general story ID mentions
	const mentionMatches = [...output.matchAll(STORY_ID_PATTERN)];

	if (mentionMatches.length > 0) {
		// Return the last mention (most recent)
		const lastMatch = mentionMatches.at(-1);
		const matchedId = lastMatch?.[0];
		if (matchedId) {
			return {
				storyId: matchedId.toUpperCase(),
				source: 'mention',
			};
		}
	}

	// No story ID found
	return null;
}
