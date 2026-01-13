import React, {useState} from 'react';
import {Text, Box, useInput} from 'ink';

type Props = {
	defaultValue?: number;
	onConfirm: (iterations: number) => void;
	onCancel?: () => void;
};

export default function IterationPrompt({
	defaultValue = 1,
	onConfirm,
	onCancel,
}: Props) {
	const [input, setInput] = useState(String(defaultValue));
	const [error, setError] = useState<string | null>(null);

	useInput((char, key) => {
		if (key.escape) {
			onCancel?.();
			return;
		}

		if (key.return) {
			// Validate and submit
			const value = parseInt(input, 10);
			if (Number.isNaN(value)) {
				setError('Please enter a valid number');
				return;
			}

			if (value <= 0) {
				setError('Number must be greater than 0');
				return;
			}

			if (value > 100) {
				setError('Maximum 100 iterations allowed');
				return;
			}

			setError(null);
			onConfirm(value);
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
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Text color="cyan" bold>
				Ralph CLI
			</Text>
			<Text> </Text>
			<Text>How many iterations would you like to run?</Text>
			<Text color="gray">
				Each iteration picks the next highest priority incomplete story.
			</Text>
			<Text> </Text>
			<Box>
				<Text>Iterations: </Text>
				<Text color="yellow" bold>
					{input || '_'}
				</Text>
				<Text color="gray" dimColor>
					{' '}
					(default: {defaultValue})
				</Text>
			</Box>
			{error && (
				<Box marginTop={1}>
					<Text color="red">{error}</Text>
				</Box>
			)}
			<Text> </Text>
			<Text color="gray">Press Enter to confirm, Escape to cancel</Text>
		</Box>
	);
}
