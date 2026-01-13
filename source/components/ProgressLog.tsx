import React, {useState, useEffect, useMemo} from 'react';
import {Text, Box} from 'ink';
import {readFileSync, watchFile, unwatchFile, existsSync} from 'node:fs';

type Props = {
	filePath: string;
	maxLines?: number;
	title?: string;
};

export default function ProgressLog({
	filePath,
	maxLines = 20,
	title = 'Progress Log',
}: Props) {
	const [content, setContent] = useState<string>('');
	const [error, setError] = useState<string | null>(null);

	// Read file and set up watcher
	useEffect(() => {
		const readFile = () => {
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
		};

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

		if (lines.length <= maxLines) {
			return {
				visibleLines: lines,
				scrollInfo: null,
			};
		}

		// Show the last maxLines lines (auto-scroll to bottom)
		const startIndex = lines.length - maxLines;
		const visibleLines = lines.slice(startIndex);

		return {
			visibleLines,
			scrollInfo: {
				hiddenAbove: startIndex,
				total: lines.length,
			},
		};
	}, [content, maxLines]);

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
				{error ? (
					<Text color="yellow" dimColor>
						{error}
					</Text>
				) : (
					<>
						{scrollInfo && scrollInfo.hiddenAbove > 0 && (
							<Text color="gray" dimColor>
								↑ {scrollInfo.hiddenAbove} lines above
							</Text>
						)}
						{visibleLines.length === 0 ||
						(visibleLines.length === 1 && visibleLines[0] === '') ? (
							<Text color="gray" dimColor>
								No progress yet...
							</Text>
						) : (
							visibleLines.map((line, index) => (
								<Text key={`${index}-${line.slice(0, 20)}`} wrap="truncate">
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
