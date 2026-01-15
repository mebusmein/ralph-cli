import React, {useMemo, useState, useEffect} from 'react';
import {Text, Box, useInput} from 'ink';
import {
	type BeadsIssue,
	type BeadsStatus,
	type BeadsIssueType,
} from '../types/beads.js';

type Props = {
	tasks: BeadsIssue[];
	selectedTaskId?: string | null;
	onTaskSelect?: (task: BeadsIssue) => void;
	maxHeight?: number;
	availableWidth?: number;
	isActive?: boolean;
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
 * Get the status indicator character for a beads status
 */
function getStatusIndicator(status: BeadsStatus): string {
	switch (status) {
		case 'closed': {
			return '✓';
		}

		case 'in_progress': {
			return '▶';
		}

		case 'open': {
			return '○';
		}
	}
}

/**
 * Get the type icon for a beads issue type
 */
function getTypeIcon(type: BeadsIssueType): string {
	switch (type) {
		case 'task': {
			return '◆';
		}

		case 'bug': {
			return '⚠';
		}

		case 'feature': {
			return '★';
		}

		case 'epic': {
			return '◎';
		}
	}
}

/**
 * Get the color for a beads issue type
 */
function getTypeColor(type: BeadsIssueType): string {
	switch (type) {
		case 'task': {
			return 'white';
		}

		case 'bug': {
			return 'red';
		}

		case 'feature': {
			return 'blue';
		}

		case 'epic': {
			return 'magenta';
		}
	}
}

type TicketItemProps = {
	task: BeadsIssue;
	isSelected: boolean;
	maxTitleLength?: number;
};

function TicketItem({task, isSelected, maxTitleLength}: TicketItemProps) {
	const statusColor = getStatusColor(task.status);
	const statusIndicator = getStatusIndicator(task.status);
	const typeIcon = getTypeIcon(task.type);
	const typeColor = getTypeColor(task.type);
	const isBlocked = task.blockedBy.length > 0;

	// Truncate title if it exceeds maxTitleLength
	let displayTitle = task.title;
	if (maxTitleLength && displayTitle.length > maxTitleLength) {
		displayTitle = displayTitle.slice(0, maxTitleLength - 1) + '…';
	}

	return (
		<Box>
			{/* Status indicator */}
			<Text color={statusColor}>{statusIndicator} </Text>
			{/* Type icon */}
			<Text color={typeColor}>{typeIcon} </Text>
			{/* Blocked indicator */}
			{isBlocked && <Text color="red">⊘ </Text>}
			{/* Task ID */}
			<Text
				color={isSelected ? 'cyan' : undefined}
				bold={isSelected}
				inverse={isSelected}
				dimColor={task.status === 'open' && !isSelected}
			>
				{task.id}
			</Text>
			{/* Task title */}
			<Text
				dimColor={task.status === 'open' && !isSelected}
				color={isSelected ? 'cyan' : undefined}
			>
				{' '}
				- {displayTitle}
			</Text>
		</Box>
	);
}

export default function TicketList({
	tasks,
	selectedTaskId,
	onTaskSelect,
	maxHeight,
	availableWidth,
	isActive = true,
}: Props) {
	// Track selected index for keyboard navigation
	const [selectedIndex, setSelectedIndex] = useState(0);

	// Sync selected index when selectedTaskId changes externally
	useEffect(() => {
		if (selectedTaskId) {
			const index = tasks.findIndex(t => t.id === selectedTaskId);
			if (index >= 0) {
				setSelectedIndex(index);
			}
		}
	}, [selectedTaskId, tasks]);

	// Reset selected index when tasks change
	useEffect(() => {
		if (tasks.length > 0 && selectedIndex >= tasks.length) {
			setSelectedIndex(tasks.length - 1);
		}
	}, [tasks, selectedIndex]);

	// Handle keyboard navigation
	useInput(
		(_input, key) => {
			if (tasks.length === 0) return;

			if (key.upArrow) {
				setSelectedIndex(prev => Math.max(0, prev - 1));
			} else if (key.downArrow) {
				setSelectedIndex(prev => Math.min(tasks.length - 1, prev + 1));
			} else if (key.return) {
				const selectedTask = tasks[selectedIndex];
				if (selectedTask && onTaskSelect) {
					onTaskSelect(selectedTask);
				}
			}
		},
		{isActive},
	);

	// Notify parent of selection changes
	useEffect(() => {
		const selectedTask = tasks[selectedIndex];
		if (selectedTask && onTaskSelect) {
			onTaskSelect(selectedTask);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedIndex]);

	// Get the currently selected task ID
	const currentSelectedId = tasks[selectedIndex]?.id ?? selectedTaskId;

	// Calculate max title length based on available width
	// Format: "○ ◆ ⊘ beads-xxx - Title" = status (2) + type (2) + blocked (2) + id (~10) + separator (3) + title
	const fixedOverhead = 20; // Status, type, possible blocked, ID, separator, padding
	const maxTitleLength = availableWidth
		? Math.max(10, availableWidth - fixedOverhead)
		: undefined;

	// Calculate scroll position to keep selected task visible
	const {visibleTasks, scrollInfo} = useMemo(() => {
		if (!maxHeight || tasks.length <= maxHeight) {
			return {
				visibleTasks: tasks,
				scrollInfo: null,
			};
		}

		// Calculate scroll position to center selected task
		let startIndex = 0;
		if (selectedIndex >= 0) {
			// Try to keep selected task in the middle of the visible area
			const halfVisible = Math.floor(maxHeight / 2);
			startIndex = Math.max(0, selectedIndex - halfVisible);
			// Ensure we don't scroll past the end
			startIndex = Math.min(startIndex, tasks.length - maxHeight);
		}

		const endIndex = Math.min(startIndex + maxHeight, tasks.length);

		return {
			visibleTasks: tasks.slice(startIndex, endIndex),
			scrollInfo: {
				startIndex,
				endIndex,
				total: tasks.length,
				hasMore: endIndex < tasks.length,
				hasPrevious: startIndex > 0,
			},
		};
	}, [tasks, selectedIndex, maxHeight]);

	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				Tasks
			</Text>
			<Box flexDirection="column" marginTop={1}>
				{tasks.length === 0 ? (
					<Text color="gray" dimColor>
						No tasks in this epic
					</Text>
				) : (
					<>
						{scrollInfo?.hasPrevious && (
							<Text color="gray">↑ {scrollInfo.startIndex} more above</Text>
						)}
						{visibleTasks.map(task => (
							<TicketItem
								key={task.id}
								task={task}
								isSelected={task.id === currentSelectedId}
								maxTitleLength={maxTitleLength}
							/>
						))}
						{scrollInfo?.hasMore && (
							<Text color="gray">
								↓ {scrollInfo.total - scrollInfo.endIndex} more below
							</Text>
						)}
					</>
				)}
			</Box>
		</Box>
	);
}
