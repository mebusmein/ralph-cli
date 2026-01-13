import React, {useState, useEffect, useMemo} from 'react';
import {Text, Box} from 'ink';
import {readFileSync, watchFile, unwatchFile, existsSync} from 'node:fs';
import {calculateVisibleLines} from '../utils/text-utils.js';

type Props = {
	filePath: string;
	maxLines?: number;
	title?: string;
	contentWidth?: number;
};

export default function ProgressLog({
	filePath,
	maxLines = 20,
	title = 'Progress Log',
	contentWidth = 80,
}: Props): React.ReactElement {
	const [content, setContent] = useState<string>('');
	const [error, setError] = useState<string | null>(null);

	// Read file and set up watcher
	useEffect(() => {
		function readFile(): void {
			if (!existsSync(filePath)) {
				setError('Progress file not found');
				setContent('');
				return;
			}

			try {
				const fileContent = readFileSync(filePath, 'utf-8');
				setContent(fileContent);
				setError(null);
			} catch {
				setError('Failed to read progress file');
			}
		}

		// Initial read
		readFile();

		// Watch for changes
		watchFile(filePath, {interval: 500}, () => {
			readFile();
		});

		// Cleanup
		return () => {
			unwatchFile(filePath);
		};
	}, [filePath]);

	// Split content into lines and calculate visible portion
	const {visibleLines, scrollInfo} = useMemo(() => {
		const lines = content.split('\n');
		return calculateVisibleLines(lines, maxLines, contentWidth, false);
	}, [content, maxLines, contentWidth]);

	const isEmpty =
		visibleLines.length === 0 ||
		(visibleLines.length === 1 && visibleLines[0] === '');

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
				{error ? (
					<Text color="yellow" dimColor>
						{error}
					</Text>
				) : (
					<>
						{scrollInfo && scrollInfo.hiddenAbove > 0 && (
							<Text color="gray" dimColor>
								{'\u2191'} {scrollInfo.hiddenAbove} lines above
							</Text>
						)}
						{isEmpty ? (
							<Text color="gray" dimColor>
								No progress yet...
							</Text>
						) : (
							visibleLines.map((line, index) => (
								<Text key={`${index}-${line.slice(0, 20)}`} wrap="wrap">
									{line}
								</Text>
							))
						)}
					</>
				)}
			</Box>
		</Box>
	);
}
