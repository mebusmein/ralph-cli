import React, {useState} from 'react';
import {Text, Box, useInput} from 'ink';
import {type BeadsIssue, type BeadsStatus} from '../types/beads.js';

type Props = {
	blockers: BeadsIssue[];
	isActive?: boolean;
};

/**
 * Get the color for a beads status
 */
function getStatusColor(status: BeadsStatus): string {
	switch (status) {
		case 'closed': {
			return 'green';
		}

		case 'in_progress': {
			return 'yellow';
		}

		case 'open': {
			return 'gray';
		}
	}
}

/**
 * Get the status indicator for a beads status
 */
function getStatusIndicator(status: BeadsStatus): string {
	switch (status) {
		case 'closed': {
			return '✓';
		}

		case 'in_progress': {
			return '▶';
		}

		case 'open': {
			return '○';
		}
	}
}

/**
 * Collapsible section component for displaying external blockers
 * (tasks from other epics that block tasks in the current epic)
 */
export default function ExternalBlockers({
	blockers,
	isActive = false,
}: Props): React.ReactElement {
	const [isExpanded, setIsExpanded] = useState(false);

	useInput(
		(input, key) => {
			if (input === 'e' || key.return) {
				setIsExpanded(prev => !prev);
			}
		},
		{isActive},
	);

	// Don't render anything if there are no blockers
	if (blockers.length === 0) {
		return (
			<Box>
				<Text color="gray" dimColor>
					No external blockers
				</Text>
			</Box>
		);
	}

	const expandIcon = isExpanded ? '▼' : '▶';
	const headerText = `External Blockers (${blockers.length})`;

	return (
		<Box flexDirection="column">
			{/* Collapsible header */}
			<Box>
				<Text inverse={isActive} color="red">
					{expandIcon} {headerText}
				</Text>
				{isActive && (
					<Text color="gray" dimColor>
						{' '}
						(e/Enter to toggle)
					</Text>
				)}
			</Box>

			{/* Expanded blocker list */}
			{isExpanded && (
				<Box flexDirection="column" marginTop={1} marginLeft={2}>
					{blockers.map(blocker => (
						<Box key={blocker.id}>
							<Text color={getStatusColor(blocker.status)}>
								{getStatusIndicator(blocker.status)}
							</Text>
							<Text> </Text>
							<Text color="cyan">{blocker.id}</Text>
							<Text> - </Text>
							<Text>{blocker.title}</Text>
							<Text color="gray" dimColor>
								{' '}
								[{blocker.status.replace('_', ' ')}]
							</Text>
						</Box>
					))}
				</Box>
			)}
		</Box>
	);
}
