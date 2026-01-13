import React, {useMemo} from 'react';
import {Text, Box} from 'ink';
import type {StoryWithStatus, StoryStatus} from '../types/index.js';

type Props = {
	stories: StoryWithStatus[];
	currentStoryId: string | null;
	maxHeight?: number;
};

/**
 * Get the color for a story status
 */
function getStatusColor(status: StoryStatus): string {
	switch (status) {
		case 'passed': {
			return 'green';
		}

		case 'in-progress': {
			return 'yellow';
		}

		case 'failed': {
			return 'red';
		}

		case 'pending':
		default: {
			return 'gray';
		}
	}
}

/**
 * Get the status indicator character for a story
 */
function getStatusIndicator(status: StoryStatus): string {
	switch (status) {
		case 'passed': {
			return '✓';
		}

		case 'in-progress': {
			return '▶';
		}

		case 'failed': {
			return '✗';
		}

		case 'pending':
		default: {
			return '○';
		}
	}
}

type TicketItemProps = {
	story: StoryWithStatus;
	isCurrentStory: boolean;
};

function TicketItem({story, isCurrentStory}: TicketItemProps) {
	const statusColor = getStatusColor(story.status);
	const statusIndicator = getStatusIndicator(story.status);

	return (
		<Box>
			<Text color={statusColor}>{statusIndicator} </Text>
			<Text
				color={isCurrentStory ? 'cyan' : undefined}
				bold={isCurrentStory}
				dimColor={story.status === 'pending' && !isCurrentStory}
			>
				{story.id}
			</Text>
			<Text
				dimColor={story.status === 'pending' && !isCurrentStory}
				color={isCurrentStory ? 'cyan' : undefined}
			>
				{' '}
				- {story.title}
			</Text>
		</Box>
	);
}

export default function TicketList({
	stories,
	currentStoryId,
	maxHeight,
}: Props) {
	// Calculate scroll position to keep current story visible
	const {visibleStories, scrollInfo} = useMemo(() => {
		if (!maxHeight || stories.length <= maxHeight) {
			return {
				visibleStories: stories,
				scrollInfo: null,
			};
		}

		// Find current story index
		const currentIndex = currentStoryId
			? stories.findIndex(s => s.id === currentStoryId)
			: -1;

		// Calculate scroll position to center current story
		let startIndex = 0;
		if (currentIndex >= 0) {
			// Try to keep current story in the middle of the visible area
			const halfVisible = Math.floor(maxHeight / 2);
			startIndex = Math.max(0, currentIndex - halfVisible);
			// Ensure we don't scroll past the end
			startIndex = Math.min(startIndex, stories.length - maxHeight);
		}

		const endIndex = Math.min(startIndex + maxHeight, stories.length);

		return {
			visibleStories: stories.slice(startIndex, endIndex),
			scrollInfo: {
				startIndex,
				endIndex,
				total: stories.length,
				hasMore: endIndex < stories.length,
				hasPrevious: startIndex > 0,
			},
		};
	}, [stories, currentStoryId, maxHeight]);

	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				User Stories
			</Text>
			<Box flexDirection="column" marginTop={1}>
				{scrollInfo?.hasPrevious && (
					<Text color="gray">↑ {scrollInfo.startIndex} more above</Text>
				)}
				{visibleStories.map(story => (
					<TicketItem
						key={story.id}
						story={story}
						isCurrentStory={story.id === currentStoryId}
					/>
				))}
				{scrollInfo?.hasMore && (
					<Text color="gray">
						↓ {scrollInfo.total - scrollInfo.endIndex} more below
					</Text>
				)}
			</Box>
		</Box>
	);
}
