import React from 'react';
import {Box} from 'ink';
import TicketList from './TicketList.js';
import TabPanel, {type TabId} from './TabPanel.js';
import type {BeadsIssue} from '../types/beads.js';

type Props = {
	tasks: BeadsIssue[];
	selectedTaskId?: string | null;
	onTaskSelect?: (task: BeadsIssue) => void;
	activeTab: TabId;
	outputLines: string[];
	progressFilePath: string;
	maxLines?: number;
	height?: number;
	terminalWidth?: number;
	isTaskListActive?: boolean;
};

export default function MainLayout({
	tasks,
	selectedTaskId,
	onTaskSelect,
	activeTab,
	outputLines,
	progressFilePath,
	maxLines = 20,
	height,
	terminalWidth = 80,
	isTaskListActive = true,
}: Props) {
	// Calculate content panel width (70% of terminal width minus padding/borders)
	// Left column is 30%, right is 70%
	// Account for: left padding (1), right panel border (2), right panel paddingX (2)
	const rightPanelWidth = Math.floor(terminalWidth * 0.7) - 5;

	// Calculate left column width for TicketList (30% of terminal width minus padding)
	// Account for: paddingRight (1)
	const leftColumnWidth = Math.floor(terminalWidth * 0.3) - 1;

	// Calculate max visible lines for content panels
	// Account for: title (1), tab headers (1), margin (1), border top/bottom (2), scroll indicator (1)
	const contentPanelReserved = 6;
	const effectiveMaxLines = height
		? Math.max(3, height - contentPanelReserved)
		: maxLines;

	return (
		<Box flexDirection="row" height={height} overflow="hidden">
			{/* Left column: TicketList (~30%) */}
			<Box flexDirection="column" width="30%" paddingRight={1}>
				<TicketList
					tasks={tasks}
					selectedTaskId={selectedTaskId}
					onTaskSelect={onTaskSelect}
					maxHeight={effectiveMaxLines}
					availableWidth={leftColumnWidth}
					isActive={isTaskListActive}
				/>
			</Box>

			{/* Right column: TabPanel (~70%) */}
			<Box flexDirection="column" flexGrow={1} width="70%">
				<TabPanel
					activeTab={activeTab}
					outputLines={outputLines}
					progressFilePath={progressFilePath}
					maxLines={effectiveMaxLines}
					contentWidth={rightPanelWidth}
				/>
			</Box>
		</Box>
	);
}
