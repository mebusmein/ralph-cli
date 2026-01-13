import React, {useMemo} from 'react';
import {Text, Box} from 'ink';
import {calculateVisibleLines} from '../utils/text-utils.js';

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
}: Props): React.ReactElement {
	const {visibleLines, scrollInfo} = useMemo(
		() => calculateVisibleLines(lines, maxLines, contentWidth, true),
		[lines, maxLines, contentWidth],
	);

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
						{'\u2191'} {scrollInfo.hiddenAbove} lines above
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
