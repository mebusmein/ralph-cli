import React from 'react';
import {Box} from 'ink';
import TicketList from './TicketList.js';
import TabPanel, {type TabId} from './TabPanel.js';
import type {StoryWithStatus} from '../types/index.js';

type Props = {
	stories: StoryWithStatus[];
	currentStoryId: string | null;
	activeTab: TabId;
	outputLines: string[];
	progressFilePath: string;
	maxLines?: number;
	onTabChange?: (tab: TabId) => void;
};

export default function MainLayout({
	stories,
	currentStoryId,
	activeTab,
	outputLines,
	progressFilePath,
	maxLines = 20,
	onTabChange,
}: Props) {
	return (
		<Box flexDirection="row" flexGrow={1}>
			{/* Left column: TicketList (~30%) */}
			<Box flexDirection="column" width="30%" paddingRight={1}>
				<TicketList
					stories={stories}
					currentStoryId={currentStoryId}
					maxHeight={maxLines}
				/>
			</Box>

			{/* Right column: TabPanel (~70%) */}
			<Box flexDirection="column" flexGrow={1} width="70%">
				<TabPanel
					activeTab={activeTab}
					outputLines={outputLines}
					progressFilePath={progressFilePath}
					maxLines={maxLines}
					onTabChange={onTabChange}
				/>
			</Box>
		</Box>
	);
}
