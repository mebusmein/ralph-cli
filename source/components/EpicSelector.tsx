import React, {useState, useEffect} from 'react';
import {Text, Box, useInput} from 'ink';
import type {EpicSummary} from '../types/beads.js';
import {getEpics} from '../lib/beads-reader.js';

type Props = {
	onSelect: (epic: EpicSummary) => void;
};

/**
 * Renders a visual progress bar for an epic
 */
function ProgressBar({
	progress,
	width = 10,
}: {
	progress: number;
	width?: number;
}) {
	const filled = Math.round((progress / 100) * width);
	const empty = width - filled;
	const filledBar = '█'.repeat(filled);
	const emptyBar = '░'.repeat(empty);

	return (
		<Text>
			<Text color="green">{filledBar}</Text>
			<Text color="gray">{emptyBar}</Text>
			<Text color="gray"> {progress}%</Text>
		</Text>
	);
}

type EpicItemProps = {
	epic: EpicSummary;
	isSelected: boolean;
};

function EpicItem({epic, isSelected}: EpicItemProps) {
	const taskInfo = `(${epic.closedCount}/${epic.closedCount + epic.openCount})`;
	const blockedIndicator = epic.hasBlockedTasks ? ' ⚠' : '';

	return (
		<Box>
			<Text inverse={isSelected}>
				<Text color={isSelected ? undefined : 'cyan'}>{epic.id}</Text>
				<Text> - {epic.title} </Text>
				<Text color="gray">{taskInfo}</Text>
				<Text color="yellow">{blockedIndicator}</Text>
				<Text> </Text>
				<ProgressBar progress={epic.progress} />
			</Text>
		</Box>
	);
}

export default function EpicSelector({onSelect}: Props) {
	const [epics, setEpics] = useState<EpicSummary[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Fetch epics on mount
	useEffect(() => {
		let mounted = true;

		async function fetchEpics() {
			const result = await getEpics();
			if (!mounted) return;

			if (result.success) {
				setEpics(result.data);
				setError(null);
			} else {
				setError(result.error.message);
			}

			setIsLoading(false);
		}

		void fetchEpics();

		return () => {
			mounted = false;
		};
	}, []);

	// Handle keyboard navigation
	useInput((_input, key) => {
		if (isLoading || epics.length === 0) return;

		if (key.downArrow) {
			setSelectedIndex(prev => Math.min(prev + 1, epics.length - 1));
		} else if (key.upArrow) {
			setSelectedIndex(prev => Math.max(prev - 1, 0));
		} else if (key.return) {
			const selectedEpic = epics[selectedIndex];
			if (selectedEpic) {
				onSelect(selectedEpic);
			}
		}
	});

	if (isLoading) {
		return (
			<Box flexDirection="column">
				<Text bold color="cyan">
					Select Epic
				</Text>
				<Box marginTop={1}>
					<Text color="yellow">Loading epics...</Text>
				</Box>
			</Box>
		);
	}

	if (error) {
		return (
			<Box flexDirection="column">
				<Text bold color="cyan">
					Select Epic
				</Text>
				<Box marginTop={1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			</Box>
		);
	}

	if (epics.length === 0) {
		return (
			<Box flexDirection="column">
				<Text bold color="cyan">
					Select Epic
				</Text>
				<Box marginTop={1}>
					<Text color="gray">
						No epics found. Create one with: bd create --type=epic
						--title=&quot;Your Epic&quot;
					</Text>
				</Box>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text bold color="cyan">
				Select Epic
			</Text>
			<Box flexDirection="column" marginTop={1}>
				{epics.map((epic, index) => (
					<EpicItem
						key={epic.id}
						epic={epic}
						isSelected={index === selectedIndex}
					/>
				))}
			</Box>
			<Box marginTop={1}>
				<Text color="gray">↑/↓ Navigate • Enter Select</Text>
			</Box>
		</Box>
	);
}
