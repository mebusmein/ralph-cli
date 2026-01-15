import React, {type ReactNode} from 'react';
import {Box, Text} from 'ink';
import TicketList from './TicketList.js';
import TabPanel, {type TabId} from './TabPanel.js';
import TaskDetailPanel from './TaskDetailPanel.js';
import ExternalBlockers from './ExternalBlockers.js';
import type {BeadsIssue, TicketSummary} from '../types/beads.js';
import type {WorkMode} from './TicketSelector.js';

/**
 * View mode for the right panel
 */
export type RightPanelView = 'task-detail' | 'output';

type Props = {
	/**
	 * Custom left panel content (overrides default TicketList)
	 * When provided, renders this instead of the task list
	 */
	leftContent?: ReactNode;
	/**
	 * Custom right panel content (overrides default TabPanel/TaskDetailPanel)
	 * When provided, renders this instead of the detail panel
	 */
	rightContent?: ReactNode;
	/**
	 * Custom header content (overrides default ticket/epic header)
	 * When provided, renders this in the header area
	 */
	headerContent?: ReactNode;
	selectedTicket: TicketSummary | null;
	workMode: WorkMode;
	tasks: BeadsIssue[];
	externalBlockers?: BeadsIssue[];
	selectedTask?: BeadsIssue | null;
	onTaskSelect?: (task: BeadsIssue) => void;
	rightPanelView: RightPanelView;
	activeTab: TabId;
	outputLines: string[];
	progressFilePath: string;
	maxLines?: number;
	height?: number;
	terminalWidth?: number;
	isTaskListActive?: boolean;
	isExternalBlockersActive?: boolean;
};

/**
 * Returns the type icon for a ticket type
 */
function getTypeIcon(type: string): string {
	switch (type) {
		case 'epic':
			return '◎';
		case 'feature':
			return '★';
		case 'bug':
			return '⚠';
		case 'task':
		default:
			return '◆';
	}
}

export default function MainLayout({
	leftContent,
	rightContent,
	headerContent: customHeaderContent,
	selectedTicket,
	workMode,
	tasks,
	externalBlockers = [],
	selectedTask,
	onTaskSelect,
	rightPanelView,
	activeTab,
	outputLines,
	progressFilePath,
	maxLines = 20,
	height,
	terminalWidth = 80,
	isTaskListActive = true,
	isExternalBlockersActive = false,
}: Props) {
	// Calculate content panel width (70% of terminal width minus padding/borders)
	// Left column is 30%, right is 70%
	// Account for: left padding (1), right panel border (2), right panel paddingX (2)
	const rightPanelWidth = Math.floor(terminalWidth * 0.7) - 5;

	// Calculate left column width for TicketList (30% of terminal width minus padding)
	// Account for: paddingRight (1)
	const leftColumnWidth = Math.floor(terminalWidth * 0.3) - 1;

	// Calculate max visible lines for content panels
	// Account for: header (2), external blockers (2), border top/bottom (2), scroll indicator (1)
	const contentPanelReserved = 7;
	const effectiveMaxLines = height
		? Math.max(3, height - contentPanelReserved)
		: maxLines;

	// Reserve lines for external blockers section in left panel
	const externalBlockersReserved = externalBlockers.length > 0 ? 2 : 1;
	const taskListMaxHeight = effectiveMaxLines - externalBlockersReserved;

	// Default header content based on work mode (used when no custom header provided)
	const defaultHeaderContent =
		workMode === 'all' ? (
			<>
				<Text bold color="green">
					⚡ All tickets - AI decides
				</Text>
				<Text color="gray"> ({tasks.length} open)</Text>
			</>
		) : selectedTicket ? (
			<>
				<Text bold color="magenta">
					{getTypeIcon(selectedTicket.type)} {selectedTicket.title}
				</Text>
				<Text color="gray">
					{' '}
					({selectedTicket.closedCount}/
					{selectedTicket.openCount + selectedTicket.closedCount} tasks •{' '}
					{Math.round(selectedTicket.progress)}%)
				</Text>
			</>
		) : null;

	// Use custom header if provided, otherwise use default
	const headerContent = customHeaderContent ?? defaultHeaderContent;

	// Default left content: TicketList + ExternalBlockers
	const defaultLeftContent = (
		<>
			<TicketList
				tasks={tasks}
				selectedTaskId={selectedTask?.id}
				onTaskSelect={onTaskSelect}
				maxHeight={taskListMaxHeight}
				availableWidth={leftColumnWidth}
				isActive={isTaskListActive}
			/>
			{externalBlockers.length > 0 && (
				<Box marginTop={1}>
					<ExternalBlockers
						blockers={externalBlockers}
						isActive={isExternalBlockersActive}
					/>
				</Box>
			)}
		</>
	);

	// Default right content: TaskDetailPanel or TabPanel
	const defaultRightContent =
		rightPanelView === 'task-detail' && selectedTask ? (
			<TaskDetailPanel
				task={selectedTask}
				maxLines={effectiveMaxLines}
				contentWidth={rightPanelWidth}
			/>
		) : (
			<TabPanel
				activeTab={activeTab}
				outputLines={outputLines}
				progressFilePath={progressFilePath}
				maxLines={effectiveMaxLines}
				contentWidth={rightPanelWidth}
			/>
		);

	return (
		<Box flexDirection="column" height={height} overflow="hidden">
			{/* Header */}
			<Box marginBottom={1}>{headerContent}</Box>

			{/* Main content area */}
			<Box flexDirection="row" flexGrow={1} overflow="hidden">
				{/* Left column (~30%) */}
				<Box flexDirection="column" width="30%" paddingRight={1}>
					{leftContent ?? defaultLeftContent}
				</Box>

				{/* Right column (~70%) */}
				<Box flexDirection="column" flexGrow={1} width="70%">
					{rightContent ?? defaultRightContent}
				</Box>
			</Box>
		</Box>
	);
}
