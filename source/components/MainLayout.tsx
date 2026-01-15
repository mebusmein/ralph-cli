import React from 'react';
import {Box, Text} from 'ink';
import TicketList from './TicketList.js';
import TabPanel, {type TabId} from './TabPanel.js';
import TaskDetailPanel from './TaskDetailPanel.js';
import ExternalBlockers from './ExternalBlockers.js';
import type {BeadsIssue, EpicSummary} from '../types/beads.js';

/**
 * View mode for the right panel
 */
export type RightPanelView = 'task-detail' | 'output';

type Props = {
	selectedEpic: EpicSummary;
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

export default function MainLayout({
	selectedEpic,
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
	// Account for: epic header (2), external blockers (2), border top/bottom (2), scroll indicator (1)
	const contentPanelReserved = 7;
	const effectiveMaxLines = height
		? Math.max(3, height - contentPanelReserved)
		: maxLines;

	// Reserve lines for external blockers section in left panel
	const externalBlockersReserved = externalBlockers.length > 0 ? 2 : 1;
	const taskListMaxHeight = effectiveMaxLines - externalBlockersReserved;

	return (
		<Box flexDirection="column" height={height} overflow="hidden">
			{/* Epic header */}
			<Box marginBottom={1}>
				<Text bold color="magenta">
					◎ {selectedEpic.title}
				</Text>
				<Text color="gray">
					{' '}
					({selectedEpic.closedCount}/
					{selectedEpic.openCount + selectedEpic.closedCount} tasks •{' '}
					{Math.round(selectedEpic.progress)}%)
				</Text>
			</Box>

			{/* Main content area */}
			<Box flexDirection="row" flexGrow={1} overflow="hidden">
				{/* Left column: TicketList + ExternalBlockers (~30%) */}
				<Box flexDirection="column" width="30%" paddingRight={1}>
					<TicketList
						tasks={tasks}
						selectedTaskId={selectedTask?.id}
						onTaskSelect={onTaskSelect}
						maxHeight={taskListMaxHeight}
						availableWidth={leftColumnWidth}
						isActive={isTaskListActive}
					/>
					<Box marginTop={1}>
						<ExternalBlockers
							blockers={externalBlockers}
							isActive={isExternalBlockersActive}
						/>
					</Box>
				</Box>

				{/* Right column: TaskDetailPanel or TabPanel (~70%) */}
				<Box flexDirection="column" flexGrow={1} width="70%">
					{rightPanelView === 'task-detail' && selectedTask ? (
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
					)}
				</Box>
			</Box>
		</Box>
	);
}
