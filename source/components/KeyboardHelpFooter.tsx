import React from 'react';
import {Text, Box} from 'ink';
import {KEYBOARD_HELP} from '../hooks/index.js';

type Props = {
	isRunning?: boolean;
	isStopping?: boolean;
};

export default function KeyboardHelpFooter({
	isRunning = false,
	isStopping = false,
}: Props) {
	return (
		<Box
			borderStyle="single"
			borderColor="gray"
			paddingX={1}
			marginTop={1}
			flexDirection="row"
			justifyContent="space-between"
		>
			<Box gap={2}>
				<Text color="gray">{KEYBOARD_HELP.tabSwitch}</Text>
				<Text color="gray">|</Text>
				{isRunning && !isStopping && (
					<>
						<Text color="yellow">{KEYBOARD_HELP.stopGraceful}</Text>
						<Text color="gray">|</Text>
					</>
				)}
				{isStopping && (
					<>
						<Text color="yellow">Stopping after current iteration...</Text>
						<Text color="gray">|</Text>
					</>
				)}
				<Text color="red">{KEYBOARD_HELP.cancelImmediate}</Text>
			</Box>
			{isRunning && (
				<Text color="green" bold>
					Running...
				</Text>
			)}
		</Box>
	);
}
