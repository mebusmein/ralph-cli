import React, {useState} from 'react';
import {Text, Box, useInput} from 'ink';
import {KEYBOARD_HELP} from '../hooks/index.js';

type Props = {
	isRunning?: boolean;
	isStopping?: boolean;
	onStartIterations?: (iterations: number) => void;
};

export default function KeyboardHelpFooter({
	isRunning = false,
	isStopping = false,
	onStartIterations,
}: Props) {
	const [input, setInput] = useState('1');
	const [error, setError] = useState<string | null>(null);

	// Only handle input when not running and onStartIterations is provided
	const inputEnabled = !isRunning && onStartIterations !== undefined;

	useInput(
		(char, key) => {
			if (!inputEnabled) return;

			if (key.return) {
				// Validate and submit
				const value = parseInt(input, 10);
				if (Number.isNaN(value)) {
					setError('Invalid number');
					return;
				}

				if (value <= 0) {
					setError('Must be > 0');
					return;
				}

				if (value > 100) {
					setError('Max 100');
					return;
				}

				setError(null);
				onStartIterations?.(value);
				return;
			}

			if (key.backspace || key.delete) {
				setInput(prev => prev.slice(0, -1));
				setError(null);
				return;
			}

			// Only allow digits
			if (/^\d$/.test(char)) {
				setInput(prev => prev + char);
				setError(null);
			}
		},
		{isActive: inputEnabled},
	);

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
				{/* Iteration input when not running */}
				{!isRunning && onStartIterations && (
					<>
						<Box>
							<Text>Iterations: </Text>
							<Text color="yellow" bold>
								{input || '_'}
							</Text>
							{error && <Text color="red"> ({error})</Text>}
						</Box>
						<Text color="gray">|</Text>
						<Text color="green">Enter: start</Text>
						<Text color="gray">|</Text>
					</>
				)}
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
