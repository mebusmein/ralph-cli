import React, {useState, useEffect, useMemo} from 'react';
import {Text, Box} from 'ink';
import {readFileSync, watchFile, unwatchFile, existsSync} from 'node:fs';

/**
 * Calculate how many terminal rows a line will occupy when rendered
 */
function calculateRenderedRows(line: string, contentWidth: number): number {
	if (contentWidth <= 0) return 1;
	if (line.length === 0) return 1;
	return Math.max(1, Math.ceil(line.length / contentWidth));
}

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

	// Split content into lines and calculate visible portion (accounting for line wrapping)
	const {visibleLines, scrollInfo} = useMemo(() => {
		const lines = content.split('\n');

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
	}, [content, maxLines, contentWidth]);

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
