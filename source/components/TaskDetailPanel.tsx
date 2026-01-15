import React, {useMemo} from 'react';
import {Text, Box} from 'ink';
import {type BeadsIssue, type BeadsStatus} from '../types/beads.js';
import {calculateVisibleLines} from '../utils/text-utils.js';

type Props = {
	task: BeadsIssue;
	maxLines?: number;
	contentWidth?: number;
};

/**
 * Get the color for a beads status
 */
function getStatusColor(status: BeadsStatus): string {
	switch (status) {
		case 'closed': {
			return 'green';
		}

		case 'in_progress': {
			return 'yellow';
		}

		case 'open': {
			return 'gray';
		}
	}
}

/**
 * Render a markdown checklist line with visual checkbox
 */
function renderChecklistLine(line: string): React.ReactElement {
	// Match markdown checkbox pattern: - [ ] or - [x]
	const checkboxMatch = /^(\s*)-\s*\[([ xX])\]\s*(.*)$/.exec(line);

	if (checkboxMatch) {
		const [, indent = '', checked = ' ', text = ''] = checkboxMatch;
		const isChecked = checked.toLowerCase() === 'x';
		return (
			<Text>
				{indent}
				<Text color={isChecked ? 'green' : 'gray'}>
					{isChecked ? '☑' : '☐'}
				</Text>{' '}
				<Text dimColor={isChecked}>{text}</Text>
			</Text>
		);
	}

	return <Text>{line}</Text>;
}

/**
 * Render a list of blocker/blocked issue IDs
 */
function renderIssueList(
	issues: string[],
	label: string,
	color: string,
): React.ReactElement | null {
	if (issues.length === 0) {
		return null;
	}

	return (
		<Box flexDirection="column" marginTop={1}>
			<Text bold color={color}>
				{label}:
			</Text>
			{issues.map(id => (
				<Text key={id} color="gray">
					{'  '}• {id}
				</Text>
			))}
		</Box>
	);
}

export default function TaskDetailPanel({
	task,
	maxLines = 20,
	contentWidth = 60,
}: Props): React.ReactElement {
	// Convert description to lines for scroll calculation
	const descriptionLines = useMemo(
		() => task.description.split('\n'),
		[task.description],
	);

	const {visibleLines, scrollInfo} = useMemo(
		() => calculateVisibleLines(descriptionLines, maxLines - 8, contentWidth),
		[descriptionLines, maxLines, contentWidth],
	);

	const statusColor = getStatusColor(task.status);

	return (
		<Box flexDirection="column" flexGrow={1} overflow="hidden">
			{/* Header with title and status */}
			<Box marginBottom={1}>
				<Text bold color="cyan">
					{task.id}
				</Text>
				<Text> - </Text>
				<Text bold>{task.title}</Text>
			</Box>

			{/* Status indicator */}
			<Box marginBottom={1}>
				<Text>Status: </Text>
				<Text color={statusColor} bold>
					{task.status.replace('_', ' ')}
				</Text>
				<Text> | Type: </Text>
				<Text color="blue">{task.type}</Text>
				<Text> | Priority: </Text>
				<Text color="magenta">{task.priority}</Text>
			</Box>

			{/* Description box with scrolling */}
			<Box
				flexDirection="column"
				borderStyle="single"
				borderColor="gray"
				paddingX={1}
				flexGrow={1}
				height={maxLines - 6}
				overflow="hidden"
			>
				{scrollInfo && scrollInfo.hiddenAbove > 0 && (
					<Text color="gray" dimColor>
						{'\u2191'} {scrollInfo.hiddenAbove} lines above
					</Text>
				)}
				{visibleLines.length === 0 ? (
					<Text color="gray" dimColor>
						No description
					</Text>
				) : (
					visibleLines.map((line, index) => (
						<Box key={`line-${index}`}>{renderChecklistLine(line)}</Box>
					))
				)}
			</Box>

			{/* Blocked by section */}
			{renderIssueList(task.blockedBy, 'Blocked by', 'red')}

			{/* Blocks section */}
			{renderIssueList(task.blocks, 'Blocks', 'yellow')}
		</Box>
	);
}
