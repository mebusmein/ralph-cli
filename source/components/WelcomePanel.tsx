import React from 'react';
import {Text, Box} from 'ink';

type Props = {
	/** Width of the content area */
	contentWidth?: number;
};

/**
 * WelcomePanel - Displayed in the right column when no ticket is selected
 * Shows a welcome message and quick-start instructions
 */
export default function WelcomePanel({contentWidth}: Props) {
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="gray"
			paddingX={1}
			width={contentWidth}
		>
			<Box marginBottom={1}>
				<Text bold color="cyan">
					Welcome to Ralph
				</Text>
			</Box>

			<Text color="gray">Select a ticket from the list to get started.</Text>
			<Box marginTop={1}>
				<Text color="gray">
					Use <Text color="white">↑/↓</Text> to navigate and{' '}
					<Text color="white">Enter</Text> to select.
				</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				<Text bold color="white">
					Quick tips:
				</Text>
				<Text color="gray">
					• <Text color="green">⚡ All tickets</Text> - Let AI decide what to
					work on
				</Text>
				<Text color="gray">
					• <Text color="magenta">◎ Epics</Text> - Work through a specific epic
				</Text>
				<Text color="gray">
					• <Text color="blue">★ Features</Text> - Individual feature work
				</Text>
			</Box>
		</Box>
	);
}
