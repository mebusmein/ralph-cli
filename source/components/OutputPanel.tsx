import React, {useMemo} from 'react';
import {Text, Box} from 'ink';

type Props = {
	lines: string[];
	maxLines?: number;
	title?: string;
};

export default function OutputPanel({
	lines,
	maxLines = 20,
	title = 'Output',
}: Props) {
	// Calculate visible lines based on maxLines, auto-scroll to latest
	const {visibleLines, scrollInfo} = useMemo(() => {
		// Apply buffer limit if needed
		const bufferedLines = lines;

		if (bufferedLines.length <= maxLines) {
			return {
				visibleLines: bufferedLines,
				scrollInfo: null,
			};
		}

		// Show the last maxLines lines (auto-scroll to bottom)
		const startIndex = bufferedLines.length - maxLines;
		const visibleLines = bufferedLines.slice(startIndex);

		return {
			visibleLines,
			scrollInfo: {
				hiddenAbove: startIndex,
				total: bufferedLines.length,
			},
		};
	}, [lines, maxLines]);

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Text bold color="cyan">
				{title}
			</Text>
			<Box
				flexDirection="column"
				marginTop={1}
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
				flexGrow={1}
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
						<Text key={`${index}-${line.slice(0, 20)}`} wrap="truncate">
							{line}
						</Text>
					))
				)}
			</Box>
		</Box>
	);
}
