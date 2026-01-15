import React, {useState, useEffect} from 'react';
import {Text, Box, useInput} from 'ink';
import type {TicketSummary, BeadsIssueType} from '../types/beads.js';
import {getTickets} from '../lib/beads-reader.js';

/**
 * Work mode selected by the user
 */
export type WorkMode = 'specific' | 'all';

/**
 * Selection result from TicketSelector
 * - ticket is null when "All tickets" is selected
 * - workMode indicates which mode was chosen
 */
export type TicketSelection = {
	ticket: TicketSummary | null;
	workMode: WorkMode;
};

type Props = {
	onSelect: (selection: TicketSelection) => void;
	/**
	 * When true, renders in embedded mode:
	 * - No header or footer
	 * - No internal keyboard handling (parent controls selection)
	 * - Use selectedIndex for controlled navigation
	 */
	embedded?: boolean;
	/** Controlled selected index (for embedded mode) */
	selectedIndex?: number;
	/** Pre-loaded tickets (for embedded mode, skips internal fetch) */
	tickets?: TicketSummary[];
	/** Loading state (for embedded mode) */
	isLoading?: boolean;
	/** Error message (for embedded mode) */
	error?: string | null;
};

/**
 * Returns the type icon for a ticket type
 */
function getTypeIcon(type: BeadsIssueType): string {
	switch (type) {
		case 'epic':
			return '◎';
		case 'feature':
			return '★';
		case 'bug':
			return '⚠';
		case 'task':
		default:
			return '◆';
	}
}

/**
 * Returns the color for a ticket type
 */
function getTypeColor(type: BeadsIssueType): string {
	switch (type) {
		case 'epic':
			return 'magenta';
		case 'feature':
			return 'blue';
		case 'bug':
			return 'red';
		case 'task':
		default:
			return 'white';
	}
}

/**
 * Renders a visual progress bar for a ticket
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

type TicketItemProps = {
	ticket: TicketSummary;
	isSelected: boolean;
};

function TicketItem({ticket, isSelected}: TicketItemProps) {
	const taskInfo =
		ticket.openCount + ticket.closedCount > 0
			? `(${ticket.closedCount}/${ticket.closedCount + ticket.openCount})`
			: '';
	const blockedIndicator = ticket.hasBlockedTasks ? ' ⊘' : '';
	const typeIcon = getTypeIcon(ticket.type);
	const typeColor = getTypeColor(ticket.type);

	return (
		<Box>
			<Text inverse={isSelected}>
				<Text color={isSelected ? undefined : typeColor}>{typeIcon} </Text>
				<Text color={isSelected ? undefined : 'cyan'}>{ticket.id}</Text>
				<Text> - {ticket.title} </Text>
				{taskInfo && <Text color="gray">{taskInfo}</Text>}
				<Text color="yellow">{blockedIndicator}</Text>
				{ticket.openCount + ticket.closedCount > 0 && (
					<>
						<Text> </Text>
						<ProgressBar progress={ticket.progress} />
					</>
				)}
			</Text>
		</Box>
	);
}

function AllTicketsItem({isSelected}: {isSelected: boolean}) {
	return (
		<Box>
			<Text inverse={isSelected}>
				<Text color={isSelected ? undefined : 'green'}>⚡ </Text>
				<Text bold>[All tickets - AI decides]</Text>
			</Text>
		</Box>
	);
}

export default function TicketSelector({
	onSelect,
	embedded = false,
	selectedIndex: controlledIndex,
	tickets: externalTickets,
	isLoading: externalIsLoading,
	error: externalError,
}: Props) {
	// Internal state (used when not in embedded mode)
	const [internalTickets, setInternalTickets] = useState<TicketSummary[]>([]);
	const [internalSelectedIndex, setInternalSelectedIndex] = useState(0);
	const [internalIsLoading, setInternalIsLoading] = useState(true);
	const [internalError, setInternalError] = useState<string | null>(null);

	// Use external or internal state based on embedded mode
	const tickets =
		embedded && externalTickets ? externalTickets : internalTickets;
	const selectedIndex =
		embedded && controlledIndex !== undefined
			? controlledIndex
			: internalSelectedIndex;
	const isLoading = embedded ? externalIsLoading ?? false : internalIsLoading;
	const error = embedded ? externalError ?? null : internalError;

	// Fetch tickets on mount (only when not embedded)
	useEffect(() => {
		if (embedded) return;

		let mounted = true;

		async function fetchTickets() {
			const result = await getTickets();
			if (!mounted) return;

			if (result.success) {
				setInternalTickets(result.data);
				setInternalError(null);
			} else {
				setInternalError(result.error.message);
			}

			setInternalIsLoading(false);
		}

		void fetchTickets();

		return () => {
			mounted = false;
		};
	}, [embedded]);

	// Handle keyboard navigation (only when not embedded)
	// Total items = 1 (All tickets) + tickets.length
	const totalItems = 1 + tickets.length;

	useInput((_input, key) => {
		// Skip keyboard handling in embedded mode (parent handles it)
		if (embedded) return;
		if (isLoading) return;

		if (key.downArrow) {
			setInternalSelectedIndex(prev => Math.min(prev + 1, totalItems - 1));
		} else if (key.upArrow) {
			setInternalSelectedIndex(prev => Math.max(prev - 1, 0));
		} else if (key.return) {
			if (selectedIndex === 0) {
				// "All tickets" selected
				onSelect({ticket: null, workMode: 'all'});
			} else {
				const selectedTicket = tickets[selectedIndex - 1];
				if (selectedTicket) {
					onSelect({ticket: selectedTicket, workMode: 'specific'});
				}
			}
		}
	});

	// Loading state
	if (isLoading) {
		return (
			<Box flexDirection="column">
				{!embedded && (
					<Text bold color="cyan">
						Select Work
					</Text>
				)}
				<Box marginTop={embedded ? 0 : 1}>
					<Text color="yellow">Loading tickets...</Text>
				</Box>
			</Box>
		);
	}

	// Error state
	if (error) {
		return (
			<Box flexDirection="column">
				{!embedded && (
					<Text bold color="cyan">
						Select Work
					</Text>
				)}
				<Box marginTop={embedded ? 0 : 1}>
					<Text color="red">Error: {error}</Text>
				</Box>
			</Box>
		);
	}

	// Empty state
	if (tickets.length === 0) {
		return (
			<Box flexDirection="column">
				{!embedded && (
					<Text bold color="cyan">
						Select Work
					</Text>
				)}
				<Box marginTop={embedded ? 0 : 1}>
					<Text color="gray">
						No open tickets found. Create one with: bd create --title=&quot;Your
						Task&quot;
					</Text>
				</Box>
			</Box>
		);
	}

	// Normal state with ticket list
	return (
		<Box flexDirection="column">
			{!embedded && (
				<Text bold color="cyan">
					Select Work
				</Text>
			)}
			<Box flexDirection="column" marginTop={embedded ? 0 : 1}>
				{/* "All tickets" option at the top */}
				<AllTicketsItem isSelected={selectedIndex === 0} />
				{/* Separator */}
				<Box marginY={1}>
					<Text color="gray">───────────────────────────────</Text>
				</Box>
				{/* Individual tickets */}
				{tickets.map((ticket, index) => (
					<TicketItem
						key={ticket.id}
						ticket={ticket}
						isSelected={index + 1 === selectedIndex}
					/>
				))}
			</Box>
			{!embedded && (
				<Box marginTop={1}>
					<Text color="gray">↑/↓ Navigate • Enter Select</Text>
				</Box>
			)}
		</Box>
	);
}
