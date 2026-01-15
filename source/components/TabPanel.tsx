import React from 'react';
import {Text, Box} from 'ink';
import OutputPanel from './OutputPanel.js';
import ProgressLog from './ProgressLog.js';
import TaskDetailPanel from './TaskDetailPanel.js';
import type {BeadsIssue} from '../types/beads.js';

export type TabId = 'output' | 'progress' | 'ticket';

type Tab = {
	id: TabId;
	label: string;
};

const TABS: Tab[] = [
	{id: 'output', label: 'Output'},
	{id: 'progress', label: 'Progress Log'},
	{id: 'ticket', label: 'Ticket'},
];

type Props = {
	activeTab: TabId;
	outputLines: string[];
	progressFilePath: string;
	selectedTicket?: BeadsIssue | null;
	maxLines?: number;
	contentWidth?: number;
};

export default function TabPanel({
	activeTab,
	outputLines,
	progressFilePath,
	selectedTicket,
	maxLines = 20,
	contentWidth,
}: Props) {
	return (
		<Box flexDirection="column" flexGrow={1}>
			{/* Tab headers */}
			<Box flexDirection="row" gap={2}>
				{TABS.map(tab => {
					const isActive = tab.id === activeTab;
					return (
						<Box key={tab.id}>
							<Text
								bold={isActive}
								color={isActive ? 'cyan' : 'gray'}
								inverse={isActive}
							>
								{isActive ? ` ${tab.label} ` : ` ${tab.label} `}
							</Text>
						</Box>
					);
				})}
				<Box flexGrow={1} />
				<Text color="gray" dimColor>
					Tab to switch
				</Text>
			</Box>

			{/* Tab content */}
			<Box flexDirection="column" flexGrow={1} marginTop={1} overflow="hidden">
				{activeTab === 'output' && (
					<OutputPanel
						lines={outputLines}
						maxLines={maxLines}
						title=""
						contentWidth={contentWidth}
					/>
				)}
				{activeTab === 'progress' && (
					<ProgressLog
						filePath={progressFilePath}
						maxLines={maxLines}
						title=""
						contentWidth={contentWidth}
					/>
				)}
				{activeTab === 'ticket' &&
					(selectedTicket ? (
						<TaskDetailPanel
							task={selectedTicket}
							maxLines={maxLines}
							contentWidth={contentWidth}
						/>
					) : (
						<Box
							flexDirection="column"
							borderStyle="single"
							borderColor="gray"
							paddingX={1}
							flexGrow={1}
						>
							<Text color="gray" dimColor>
								Select a ticket from the sidebar to view details
							</Text>
						</Box>
					))}
			</Box>
		</Box>
	);
}
