import React from 'react';
import {Text, Box} from 'ink';
import OutputPanel from './OutputPanel.js';
import ProgressLog from './ProgressLog.js';

export type TabId = 'output' | 'progress';

type Tab = {
	id: TabId;
	label: string;
};

const TABS: Tab[] = [
	{id: 'output', label: 'Output'},
	{id: 'progress', label: 'Progress Log'},
];

type Props = {
	activeTab: TabId;
	outputLines: string[];
	progressFilePath: string;
	maxLines?: number;
	onTabChange?: (tab: TabId) => void;
	contentWidth?: number;
};

export default function TabPanel({
	activeTab,
	outputLines,
	progressFilePath,
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
				{activeTab === 'output' ? (
					<OutputPanel
						lines={outputLines}
						maxLines={maxLines}
						title=""
						contentWidth={contentWidth}
					/>
				) : (
					<ProgressLog
						filePath={progressFilePath}
						maxLines={maxLines}
						title=""
						contentWidth={contentWidth}
					/>
				)}
			</Box>
		</Box>
	);
}
