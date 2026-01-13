import type {
	ClaudeEventType,
	ClaudeStreamEvent,
	ClaudeContentBlockDelta,
	ClaudeResultEvent,
} from '../types/config.js';

/**
 * Result of parsing a Claude stream
 */
export type ParsedOutput = {
	text: string;
	resultSummary?: string;
	isError: boolean;
	durationMs?: number;
	costUsd?: number;
};

/**
 * Event types to filter out (metadata events)
 */
const METADATA_EVENT_TYPES: ClaudeEventType[] = [
	'system',
	'message_start',
	'content_block_start',
	'content_block_stop',
	'message_delta',
	'message_stop',
];

/**
 * Parse a single JSON line from the Claude stream
 *
 * @param line - A single line of JSON from the Claude stream
 * @returns Parsed content string, or null if the line should be filtered out
 */
export function parseStreamLine(line: string): string | null {
	const trimmedLine = line.trim();

	// Skip empty lines
	if (!trimmedLine) {
		return null;
	}

	let event: ClaudeStreamEvent;
	try {
		event = JSON.parse(trimmedLine) as ClaudeStreamEvent;
	} catch {
		// If not valid JSON, return null (skip the line)
		return null;
	}

	// Filter out metadata events
	if (METADATA_EVENT_TYPES.includes(event.type)) {
		return null;
	}

	// Extract text from content_block_delta events
	if (event.type === 'content_block_delta') {
		const deltaEvent = event as ClaudeContentBlockDelta;
		if (deltaEvent.delta?.type === 'text_delta' && deltaEvent.delta.text) {
			return deltaEvent.delta.text;
		}

		return null;
	}

	// Extract result summary from result events
	if (event.type === 'result') {
		const resultEvent = event as ClaudeResultEvent;
		return formatResultSummary(resultEvent);
	}

	return null;
}

/**
 * Format a result event into a summary string
 */
function formatResultSummary(result: ClaudeResultEvent): string {
	const status = result.is_error ? 'Error' : 'Completed';
	const durationSeconds = result.duration_ms
		? Math.floor(result.duration_ms / 1000)
		: null;
	const cost = result.cost_usd ? Math.floor(result.cost_usd * 100) / 100 : null;

	let summary = `\n━━━ ${status}`;
	if (durationSeconds !== null) {
		summary += ` in ${durationSeconds}s`;
	}

	if (cost !== null) {
		summary += ` ($${cost})`;
	}

	summary += ' ━━━';
	return summary;
}

/**
 * Parse multiple lines from a Claude stream chunk
 *
 * @param chunk - A chunk of data from the Claude stream (may contain multiple lines)
 * @returns Concatenated parsed content from all lines
 */
export function parseStreamChunk(chunk: string): string {
	const lines = chunk.split('\n');
	const parsedParts: string[] = [];

	for (const line of lines) {
		const parsed = parseStreamLine(line);
		if (parsed !== null) {
			parsedParts.push(parsed);
		}
	}

	return parsedParts.join('');
}

/**
 * Create a streaming parser that accumulates output
 *
 * @returns Object with methods to process chunks and get accumulated output
 */
export function createStreamParser(): {
	processChunk: (chunk: string) => string;
	getAccumulatedText: () => string;
	getResult: () => ParsedOutput;
} {
	let accumulatedText = '';
	let resultSummary: string | undefined;
	let isError = false;
	let durationMs: number | undefined;
	let costUsd: number | undefined;
	let incompleteLineBuffer = '';

	return {
		/**
		 * Process a chunk and return the parsed text from it
		 */
		processChunk(chunk: string): string {
			// Prepend any incomplete line from the previous chunk
			const fullChunk = incompleteLineBuffer + chunk;
			incompleteLineBuffer = '';

			const lines = fullChunk.split('\n');

			// Check if the last line is incomplete (no newline at end)
			if (!chunk.endsWith('\n') && lines.length > 0) {
				incompleteLineBuffer = lines.pop() ?? '';
			}

			const parsedParts: string[] = [];

			for (const line of lines) {
				const trimmedLine = line.trim();
				if (!trimmedLine) {
					continue;
				}

				// Try to parse as JSON to check for result events
				try {
					const event = JSON.parse(trimmedLine) as ClaudeStreamEvent;
					if (event.type === 'result') {
						const resultEvent = event as ClaudeResultEvent;
						isError = resultEvent.is_error;
						durationMs = resultEvent.duration_ms;
						costUsd = resultEvent.cost_usd;
						resultSummary = formatResultSummary(resultEvent);
						parsedParts.push(resultSummary);
						continue;
					}
				} catch {
					// Not JSON, will be handled by parseStreamLine
				}

				const parsed = parseStreamLine(trimmedLine);
				if (parsed !== null) {
					parsedParts.push(parsed);
				}
			}

			const parsedText = parsedParts.join('');
			accumulatedText += parsedText;
			return parsedText;
		},

		/**
		 * Get all accumulated text so far
		 */
		getAccumulatedText(): string {
			return accumulatedText;
		},

		/**
		 * Get the final parsed output with metadata
		 */
		getResult(): ParsedOutput {
			// Process any remaining incomplete line
			if (incompleteLineBuffer) {
				const parsed = parseStreamLine(incompleteLineBuffer);
				if (parsed !== null) {
					accumulatedText += parsed;
				}

				incompleteLineBuffer = '';
			}

			return {
				text: accumulatedText,
				resultSummary,
				isError,
				durationMs,
				costUsd,
			};
		},
	};
}
