/**
 * Shared text utilities for terminal output handling
 */

/**
 * Regex pattern to strip ANSI escape codes from text
 */
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

/**
 * Strip ANSI escape codes from a string
 */
export function stripAnsiCodes(text: string): string {
	return text.replaceAll(ANSI_PATTERN, '');
}

/**
 * Calculate how many terminal rows a line will occupy when rendered
 * Each line wraps based on content width
 */
export function calculateRenderedRows(
	line: string,
	contentWidth: number,
	stripAnsi: boolean = false,
): number {
	if (contentWidth <= 0) return 1;
	if (line.length === 0) return 1;

	const effectiveLine = stripAnsi ? stripAnsiCodes(line) : line;
	return Math.max(1, Math.ceil(effectiveLine.length / contentWidth));
}

/**
 * Result of calculating visible lines from an array
 */
export type VisibleLinesResult = {
	visibleLines: string[];
	scrollInfo: {
		hiddenAbove: number;
		total: number;
	} | null;
};

/**
 * Calculate which lines should be visible given a maximum row count
 * Auto-scrolls to show the latest lines (from the end)
 */
export function calculateVisibleLines(
	lines: string[],
	maxRows: number,
	contentWidth: number,
	stripAnsi: boolean = false,
): VisibleLinesResult {
	if (lines.length === 0) {
		return {
			visibleLines: [],
			scrollInfo: null,
		};
	}

	// Calculate how many terminal rows each line will take
	const lineRowCounts = lines.map(line =>
		calculateRenderedRows(line, contentWidth, stripAnsi),
	);

	// Find the subset of lines that fit within maxRows terminal rows
	// Start from the end (auto-scroll to latest)
	let totalRows = 0;
	let startIndex = lines.length;

	for (let i = lines.length - 1; i >= 0; i--) {
		const rowCount = lineRowCounts[i] ?? 1;
		if (totalRows + rowCount > maxRows) {
			break;
		}

		totalRows += rowCount;
		startIndex = i;
	}

	const visibleLines = lines.slice(startIndex);
	const hiddenAbove = startIndex;

	return {
		visibleLines,
		scrollInfo:
			hiddenAbove > 0
				? {
						hiddenAbove,
						total: lines.length,
				  }
				: null,
	};
}
