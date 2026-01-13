import React, {useMemo} from 'react';
import {Text, Box} from 'ink';

/**
 * Calculate how many terminal rows a line will occupy when rendered
 * Each line wraps based on content width
 */
function calculateRenderedRows(line: string, contentWidth: number): number {
	if (contentWidth <= 0) return 1;
	if (line.length === 0) return 1;
	// Strip ANSI codes for accurate length calculation
	const strippedLine = line.replaceAll(/\x1b\[[0-9;]*m/g, '');
	return Math.max(1, Math.ceil(strippedLine.length / contentWidth));
}

type Props = {
	lines: string[];
	maxLines?: number;
	title?: string;
	contentWidth?: number;
};

export default function OutputPanel({
	lines,
	maxLines = 20,
	title = 'Output',
	contentWidth = 80,
}: Props) {
	// Calculate visible lines based on actual rendered rows (accounting for line wrapping)
	const {visibleLines, scrollInfo} = useMemo(() => {
		if (lines.length === 0) {
			return {
				visibleLines: [],
				scrollInfo: null,
			};
		}

		// Calculate how many terminal rows each line will take
		const lineRowCounts = lines.map(line =>
			calculateRenderedRows(line, contentWidth),
		);

		// Find the subset of lines that fit within maxLines terminal rows
		// Start from the end (auto-scroll to latest)
		let totalRows = 0;
		let startIndex = lines.length;

		for (let i = lines.length - 1; i >= 0; i--) {
			const rowCount = lineRowCounts[i] ?? 1;
			if (totalRows + rowCount > maxLines) {
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
	}, [lines, maxLines, contentWidth]);

	return (
		<Box flexDirection="column" flexGrow={1} overflow="hidden">
			{title && (
				<Text bold color="cyan">
					{title}
				</Text>
			)}
			<Box
				flexDirection="column"
				marginTop={title ? 1 : 0}
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
				flexGrow={1}
				height={maxLines + 2}
				overflow="hidden"
			>
				{scrollInfo && scrollInfo.hiddenAbove > 0 && (
					<Text color="gray" dimColor>
						↑ {scrollInfo.hiddenAbove} lines above
					</Text>
				)}
				{visibleLines.length === 0 ? (
					<Text color="gray" dimColor>
						Waiting for output...
					</Text>
				) : (
					visibleLines.map((line, index) => (
						<Text key={`${index}-${line.slice(0, 20)}`} wrap="wrap">
							{line}
						</Text>
					))
				)}
			</Box>
		</Box>
	);
}
