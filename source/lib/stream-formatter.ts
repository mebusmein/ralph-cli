/**
 * Formatter for Claude stream-json output for CLI display
 *
 * Parses and formats the stream-json format output from Claude CLI
 * for display in a terminal interface.
 */

import {stripAnsiCodes} from '../utils/text-utils.js';

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
	reset: '\x1b[0m',
	cyan: '\x1b[36m',
	red: '\x1b[31m',
	green: '\x1b[32m',
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
	content: unknown; // Can be string or object (e.g., when tool reads JSON files)
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
 * Type guard to validate that a parsed JSON object is a valid StreamMessage
 *
 * This prevents arbitrary JSON content (e.g., from file reads) from being
 * incorrectly parsed as stream protocol messages.
 */
function isValidStreamMessage(obj: unknown): obj is StreamMessage {
	if (typeof obj !== 'object' || obj === null) {
		return false;
	}

	const record = obj as Record<string, unknown>;
	const messageType = record['type'];

	if (typeof messageType !== 'string') {
		return false;
	}

	switch (messageType) {
		case 'assistant': {
			// Assistant messages must have message.content array
			const message = record['message'];
			if (typeof message !== 'object' || message === null) {
				return false;
			}
			const messageRecord = message as Record<string, unknown>;
			const content = messageRecord['content'];
			return Array.isArray(content);
		}

		case 'user': {
			// User messages must have message.content array
			const message = record['message'];
			if (typeof message !== 'object' || message === null) {
				return false;
			}
			const messageRecord = message as Record<string, unknown>;
			const content = messageRecord['content'];
			return Array.isArray(content);
		}

		case 'system': {
			// System messages just need the type field (subtype is optional)
			return true;
		}

		case 'result': {
			// Result messages just need the type field
			// Other fields (cost_usd, duration_ms, is_error) are optional
			return true;
		}

		default:
			return false;
	}
}

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
 * Normalize a string by replacing newlines and tabs with spaces
 * This prevents multi-line content from breaking the TUI layout
 */
function normalizeWhitespace(text: string): string {
	return text.replaceAll(/[\n\r\t]+/g, ' ').replaceAll(/\s{2,}/g, ' ');
}

/**
 * Truncate a string if it exceeds the maximum length
 * Also normalizes whitespace to prevent TUI layout issues
 */
function truncate(
	text: string,
	maxLength: number = MAX_CONTENT_LENGTH,
): string {
	const normalized = normalizeWhitespace(text);
	if (normalized.length <= maxLength) {
		return normalized;
	}
	return normalized.slice(0, maxLength) + '... [truncated]';
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
	content: unknown,
	isError: boolean,
	toolResult?: {stdout?: string; stderr?: string; is_error?: boolean} | string,
): string {
	// Determine actual content and error status
	// Content may be an object (e.g., when reading JSON files), so ensure it's a string
	let displayContent: string =
		typeof content === 'string'
			? content
			: content !== null && content !== undefined
			? JSON.stringify(content)
			: '';
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
	const statusIcon = actualIsError ? '\u2717' : '\u2713';

	if (!displayContent || displayContent.trim() === '') {
		return `${statusColor}${statusIcon}${COLORS.reset}\n`;
	}

	return `${statusColor}${statusIcon}${COLORS.reset} ${COLORS.gray}${truncate(
		displayContent,
	)}${COLORS.reset}\n`;
}

/**
 * Extract raw text content from an assistant message for parsing
 * Includes text content and tool_use names/descriptions (no ANSI codes)
 */
function extractRawAssistantContent(message: AssistantMessage): string {
	const parts: string[] = [];

	for (const item of message.message.content) {
		if (item.type === 'text') {
			parts.push(item.text);
		} else if (item.type === 'tool_use') {
			const inputSummary = summarizeToolInput(item.input);
			parts.push(`[${item.name}] ${inputSummary}`);
		}
	}

	return parts.join('\n');
}

/**
 * Format an assistant message
 */
function formatAssistantMessage(message: AssistantMessage): string {
	const parts: string[] = [];

	for (const item of message.message.content) {
		if (item.type === 'text') {
			parts.push(item.text);
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

	parts.push(
		`\n${COLORS.bold}\u2501\u2501\u2501 ${statusColor}${status}${COLORS.reset}`,
	);

	if (message.duration_ms !== undefined) {
		const seconds = Math.floor(message.duration_ms / 1000);
		parts.push(` ${COLORS.gray}in ${seconds}s${COLORS.reset}`);
	}

	if (message.cost_usd !== undefined) {
		const cost = Math.floor(message.cost_usd * 100) / 100;
		parts.push(` ${COLORS.gray}($${cost})${COLORS.reset}`);
	}

	parts.push(` ${COLORS.bold}\u2501\u2501\u2501${COLORS.reset}\n`);

	return parts.join('');
}

/**
 * Parse and format a single line of stream-json output with source information
 */
function formatStreamLineWithSource(line: string): FormattedOutput | null {
	const trimmedLine = line.trim();

	if (!trimmedLine) {
		return null;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(trimmedLine);
	} catch {
		return null;
	}

	// Validate the parsed JSON matches expected StreamMessage structure
	// This prevents file content (e.g., from Read tool) from being incorrectly
	// processed as stream protocol messages
	if (!isValidStreamMessage(parsed)) {
		return null;
	}

	const message = parsed;

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
			return null;

		default:
			return null;
	}
}

/**
 * Filter messages for display: show assistant messages plus messages after the last assistant message
 *
 * The logic:
 * 1. Find the index of the last assistant message
 * 2. Include all assistant messages
 * 3. Include all messages (user/tool_result) that come after the last assistant message
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

	// If no assistant messages, return all messages
	if (lastAssistantIndex === -1) {
		return messages;
	}

	// Filter: keep all assistant messages, and all messages after the last assistant
	const filtered: FormattedOutput[] = [];
	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		if (!message) continue;

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

/**
 * Creates a stream formatter that processes chunks, accumulates output,
 * and provides filtered display along with raw text content for parsing
 */
export function createStreamFormatter(): {
	processChunk: (chunk: string) => FormattedOutput[];
	getFilteredOutput: () => FormattedOutput[];
	getRawTextContent: () => string;
} {
	const allMessages: FormattedOutput[] = [];
	const rawTextParts: string[] = [];
	let incompleteLineBuffer = '';

	function processLineForRawContent(line: string): void {
		const trimmedLine = line.trim();
		if (!trimmedLine) return;

		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmedLine);
		} catch {
			return;
		}

		// Validate before processing
		if (!isValidStreamMessage(parsed)) {
			return;
		}

		if (parsed.type === 'assistant') {
			const rawContent = extractRawAssistantContent(parsed);
			if (rawContent) {
				rawTextParts.push(rawContent);
			}
		}
	}

	return {
		processChunk(chunk: string): FormattedOutput[] {
			const fullChunk = incompleteLineBuffer + chunk;
			incompleteLineBuffer = '';

			const lines = fullChunk.split('\n');

			if (!chunk.endsWith('\n') && lines.length > 0) {
				incompleteLineBuffer = lines.pop() ?? '';
			}

			const newMessages: FormattedOutput[] = [];

			for (const line of lines) {
				processLineForRawContent(line);

				const formatted = formatStreamLineWithSource(line);
				if (formatted !== null) {
					allMessages.push(formatted);
					newMessages.push(formatted);
				}
			}

			return filterMessagesForDisplay(allMessages);
		},

		getFilteredOutput(): FormattedOutput[] {
			if (incompleteLineBuffer) {
				processLineForRawContent(incompleteLineBuffer);

				const formatted = formatStreamLineWithSource(incompleteLineBuffer);
				if (formatted !== null) {
					allMessages.push(formatted);
				}
				incompleteLineBuffer = '';
			}

			return filterMessagesForDisplay(allMessages);
		},

		getRawTextContent(): string {
			if (incompleteLineBuffer) {
				processLineForRawContent(incompleteLineBuffer);
			}

			return stripAnsiCodes(rawTextParts.join('\n'));
		},
	};
}
