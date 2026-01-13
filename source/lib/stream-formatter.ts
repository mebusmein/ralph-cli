/**
 * Formatter for Claude stream-json output for CLI display
 *
 * Parses and formats the stream-json format output from Claude CLI
 * for display in a terminal interface.
 */

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
	reset: '\x1b[0m',
	cyan: '\x1b[36m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	gray: '\x1b[90m',
	bold: '\x1b[1m',
} as const;

/**
 * Maximum length for tool input/output before truncation
 */
const MAX_CONTENT_LENGTH = 200;

/**
 * Content types in assistant messages
 */
type AssistantContentItem =
	| {type: 'text'; text: string}
	| {
			type: 'tool_use';
			id: string;
			name: string;
			input: Record<string, unknown>;
	  };

/**
 * Content types in user messages
 */
type UserContentItem = {
	type: 'tool_result';
	tool_use_id: string;
	content: string;
	is_error?: boolean;
};

/**
 * Top-level message structure for assistant messages
 */
type AssistantMessage = {
	type: 'assistant';
	message: {
		content: AssistantContentItem[];
		usage?: {
			input_tokens: number;
			output_tokens: number;
		};
	};
};

/**
 * Top-level message structure for user messages
 */
type UserMessage = {
	type: 'user';
	message: {
		content: UserContentItem[];
	};
	tool_use_result?:
		| {
				stdout?: string;
				stderr?: string;
				is_error?: boolean;
		  }
		| string;
};

/**
 * Top-level message structure for system messages
 */
type SystemMessage = {
	type: 'system';
	subtype?: string;
};

/**
 * Top-level message structure for result messages
 */
type ResultMessage = {
	type: 'result';
	cost_usd?: number;
	duration_ms?: number;
	is_error?: boolean;
};

/**
 * Union of all message types
 */
type StreamMessage =
	| AssistantMessage
	| UserMessage
	| SystemMessage
	| ResultMessage;

/**
 * Source type for formatted output - used for filtering
 */
export type FormattedOutputSource = 'assistant' | 'user' | 'result' | 'system';

/**
 * Formatted output with source information for filtering
 */
export type FormattedOutput = {
	source: FormattedOutputSource;
	content: string;
};

/**
 * Truncate a string if it exceeds the maximum length
 */
function truncate(
	text: string,
	maxLength: number = MAX_CONTENT_LENGTH,
): string {
	if (text.length <= maxLength) {
		return text;
	}
	return text.slice(0, maxLength) + '... [truncated]';
}

/**
 * Summarize tool input for display
 */
function summarizeToolInput(input: Record<string, unknown>): string {
	const entries = Object.entries(input);
	if (entries.length === 0) {
		return '{}';
	}

	const parts: string[] = [];
	for (const [key, value] of entries) {
		let valueStr: string;
		if (typeof value === 'string') {
			valueStr = truncate(value, 50);
		} else if (Array.isArray(value)) {
			valueStr = `[${value.length} items]`;
		} else if (typeof value === 'object' && value !== null) {
			valueStr = '{...}';
		} else {
			valueStr = String(value);
		}
		parts.push(`${key}: ${valueStr}`);
	}

	return parts.join(', ');
}

/**
 * Format a text content item
 */
function formatTextContent(text: string): string {
	return text;
}

/**
 * Format a tool_use content item
 */
function formatToolUse(name: string, input: Record<string, unknown>): string {
	const inputSummary = summarizeToolInput(input);
	return `${COLORS.cyan}[${name}]${COLORS.reset} ${COLORS.gray}${truncate(
		inputSummary,
	)}${COLORS.reset}\n`;
}

/**
 * Format a tool_result content item
 */
function formatToolResult(
	content: string,
	isError: boolean,
	toolResult?: {stdout?: string; stderr?: string; is_error?: boolean} | string,
): string {
	// Determine actual content and error status
	let displayContent = content;
	let actualIsError = isError;

	if (typeof toolResult === 'object' && toolResult !== null) {
		if (toolResult.is_error) {
			actualIsError = true;
		}
		if (toolResult.stderr && toolResult.stderr.trim()) {
			displayContent = toolResult.stderr;
			actualIsError = true;
		} else if (toolResult.stdout) {
			displayContent = toolResult.stdout;
		}
	} else if (
		typeof toolResult === 'string' &&
		toolResult.startsWith('Error:')
	) {
		actualIsError = true;
		displayContent = toolResult;
	}

	const statusColor = actualIsError ? COLORS.red : COLORS.green;
	const statusIcon = actualIsError ? '✗' : '✓';

	if (!displayContent || displayContent.trim() === '') {
		return `${statusColor}${statusIcon}${COLORS.reset}\n`;
	}

	return `${statusColor}${statusIcon}${COLORS.reset} ${COLORS.gray}${truncate(
		displayContent,
	)}${COLORS.reset}\n`;
}

/**
 * Format an assistant message
 */
function formatAssistantMessage(message: AssistantMessage): string {
	const parts: string[] = [];

	for (const item of message.message.content) {
		if (item.type === 'text') {
			parts.push(formatTextContent(item.text));
		} else if (item.type === 'tool_use') {
			parts.push(formatToolUse(item.name, item.input));
		}
	}

	return parts.join('');
}

/**
 * Format a user message (tool results)
 */
function formatUserMessage(message: UserMessage): string {
	const parts: string[] = [];

	for (const item of message.message.content) {
		if (item.type === 'tool_result') {
			parts.push(
				formatToolResult(
					item.content,
					item.is_error ?? false,
					message.tool_use_result,
				),
			);
		}
	}

	return parts.join('');
}

/**
 * Format a result message with cost/duration info
 */
function formatResultMessage(message: ResultMessage): string {
	const parts: string[] = [];

	const status = message.is_error ? 'Error' : 'Completed';
	const statusColor = message.is_error ? COLORS.red : COLORS.green;

	parts.push(`\n${COLORS.bold}━━━ ${statusColor}${status}${COLORS.reset}`);

	if (message.duration_ms !== undefined) {
		const seconds = Math.floor(message.duration_ms / 1000);
		parts.push(` ${COLORS.gray}in ${seconds}s${COLORS.reset}`);
	}

	if (message.cost_usd !== undefined) {
		const cost = Math.floor(message.cost_usd * 100) / 100;
		parts.push(` ${COLORS.gray}($${cost})${COLORS.reset}`);
	}

	parts.push(` ${COLORS.bold}━━━${COLORS.reset}\n`);

	return parts.join('');
}

/**
 * Parse and format a single line of stream-json output
 *
 * @param line - A single line of JSON from the stream
 * @returns Formatted string for display, or null if the line should be filtered out
 */
export function formatStreamLine(line: string): string | null {
	const result = formatStreamLineWithSource(line);
	return result?.content ?? null;
}

/**
 * Parse and format a single line of stream-json output with source information
 *
 * @param line - A single line of JSON from the stream
 * @returns FormattedOutput with source and content, or null if the line should be filtered out
 */
export function formatStreamLineWithSource(
	line: string,
): FormattedOutput | null {
	const trimmedLine = line.trim();

	if (!trimmedLine) {
		return null;
	}

	let message: StreamMessage;
	try {
		message = JSON.parse(trimmedLine) as StreamMessage;
	} catch {
		// Not valid JSON, skip
		return null;
	}

	switch (message.type) {
		case 'assistant': {
			const content = formatAssistantMessage(message);
			return content ? {source: 'assistant', content} : null;
		}

		case 'user': {
			const content = formatUserMessage(message);
			return content ? {source: 'user', content} : null;
		}

		case 'result': {
			const content = formatResultMessage(message);
			return content ? {source: 'result', content} : null;
		}

		case 'system':
			// Filter out system messages (init, etc.)
			return null;

		default:
			return null;
	}
}

/**
 * Creates a streaming formatter that processes chunks and accumulates output
 *
 * @returns Object with methods to process chunks and get accumulated formatted output
 */
export function createStreamFormatter(): {
	processChunk: (chunk: string) => string;
	getAccumulatedOutput: () => string;
} {
	let accumulatedOutput = '';
	let incompleteLineBuffer = '';

	return {
		/**
		 * Process a chunk of stream data and return formatted output
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

			const formattedParts: string[] = [];

			for (const line of lines) {
				const formatted = formatStreamLine(line);
				if (formatted !== null) {
					formattedParts.push(formatted);
				}
			}

			const formattedText = formattedParts.join('');
			accumulatedOutput += formattedText;
			return formattedText;
		},

		/**
		 * Get all accumulated formatted output
		 */
		getAccumulatedOutput(): string {
			// Process any remaining incomplete line
			if (incompleteLineBuffer) {
				const formatted = formatStreamLine(incompleteLineBuffer);
				if (formatted !== null) {
					accumulatedOutput += formatted;
				}
				incompleteLineBuffer = '';
			}

			return accumulatedOutput;
		},
	};
}

/**
 * Creates a filtering stream formatter that tracks message sources and filters output
 * Shows only assistant messages, plus user/tool_result messages after the latest assistant message
 *
 * @returns Object with methods to process chunks and get filtered output
 */
export function createFilteringStreamFormatter(): {
	processChunk: (chunk: string) => FormattedOutput[];
	getFilteredOutput: () => FormattedOutput[];
} {
	const allMessages: FormattedOutput[] = [];
	let incompleteLineBuffer = '';

	return {
		/**
		 * Process a chunk of stream data and return filtered formatted outputs
		 */
		processChunk(chunk: string): FormattedOutput[] {
			// Prepend any incomplete line from the previous chunk
			const fullChunk = incompleteLineBuffer + chunk;
			incompleteLineBuffer = '';

			const lines = fullChunk.split('\n');

			// Check if the last line is incomplete (no newline at end)
			if (!chunk.endsWith('\n') && lines.length > 0) {
				incompleteLineBuffer = lines.pop() ?? '';
			}

			const newMessages: FormattedOutput[] = [];

			for (const line of lines) {
				const formatted = formatStreamLineWithSource(line);
				if (formatted !== null) {
					allMessages.push(formatted);
					newMessages.push(formatted);
				}
			}

			// Return filtered messages for display
			return filterMessagesForDisplay(allMessages);
		},

		/**
		 * Get all filtered formatted output
		 */
		getFilteredOutput(): FormattedOutput[] {
			// Process any remaining incomplete line
			if (incompleteLineBuffer) {
				const formatted = formatStreamLineWithSource(incompleteLineBuffer);
				if (formatted !== null) {
					allMessages.push(formatted);
				}
				incompleteLineBuffer = '';
			}

			return filterMessagesForDisplay(allMessages);
		},
	};
}

/**
 * Filter messages for display: show assistant messages plus messages after the last assistant message
 *
 * The logic:
 * 1. Find the index of the last assistant message
 * 2. Include all assistant messages
 * 3. Include all messages (user/tool_result) that come after the last assistant message
 *
 * This way, the user sees all assistant output, plus the current "live" tool results
 * that are happening in response to the latest assistant action.
 */
export function filterMessagesForDisplay(
	messages: FormattedOutput[],
): FormattedOutput[] {
	if (messages.length === 0) {
		return [];
	}

	// Find index of the last assistant message
	let lastAssistantIndex = -1;
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i]?.source === 'assistant') {
			lastAssistantIndex = i;
			break;
		}
	}

	// If no assistant messages, return all messages (might be early in stream)
	if (lastAssistantIndex === -1) {
		return messages;
	}

	// Filter: keep all assistant messages, and all messages after the last assistant
	const filtered: FormattedOutput[] = [];
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (!message) continue;

		// Include if it's an assistant message OR if it comes after the last assistant message
		// Also always include 'result' type (completion summary)
		if (
			message.source === 'assistant' ||
			message.source === 'result' ||
			i > lastAssistantIndex
		) {
			filtered.push(message);
		}
	}

	return filtered;
}
