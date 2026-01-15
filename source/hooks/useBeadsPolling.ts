import {useState, useEffect, useRef} from 'react';
import type {BeadsIssue, BeadsCommandError} from '../types/beads.js';
import type {WorkMode} from '../components/TicketSelector.js';
import {getTicketDescendants, getAllOpenTickets} from '../lib/beads-reader.js';

/**
 * State returned by the useBeadsPolling hook
 */
export type BeadsPollingState = {
	tasks: BeadsIssue[];
	loading: boolean;
	error: BeadsCommandError | null;
};

/**
 * Options for the useBeadsPolling hook
 */
export type BeadsPollingOptions = {
	/** Ticket ID to poll tasks for (specific mode only) */
	ticketId: string;
	/** Work mode: 'specific' polls descendants, 'all' polls all open tickets */
	workMode: WorkMode;
	/** Polling interval in milliseconds (default: 2500) */
	intervalMs?: number;
};

/**
 * Hook for polling beads task state at a specified interval.
 *
 * In 'specific' mode: Polls descendants of the selected ticket
 * In 'all' mode: Polls all open tickets in the project
 *
 * @param options - Configuration options for polling
 * @returns Current polling state with tasks, loading, and error
 */
export function useBeadsPolling(
	options: BeadsPollingOptions,
): BeadsPollingState {
	const {ticketId, workMode, intervalMs = 2500} = options;

	const [tasks, setTasks] = useState<BeadsIssue[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<BeadsCommandError | null>(null);

	// Track mounted state to prevent updates after unmount
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;

		const fetchTasks = async (): Promise<void> => {
			// Choose the right query based on work mode
			const result =
				workMode === 'all'
					? await getAllOpenTickets()
					: await getTicketDescendants(ticketId);

			if (!mountedRef.current) {
				return;
			}

			if (result.success) {
				setTasks(result.data);
				setError(null);
			} else {
				setError(result.error);
			}

			setLoading(false);
		};

		// Only fetch if we have a valid context
		// In 'specific' mode, we need a ticketId
		// In 'all' mode, we always fetch
		if (workMode === 'all' || ticketId) {
			void fetchTasks();

			// Set up polling interval
			const intervalId = setInterval(() => {
				void fetchTasks();
			}, intervalMs);

			// Cleanup on unmount or when dependencies change
			return () => {
				mountedRef.current = false;
				clearInterval(intervalId);
			};
		}

		// No ticketId in specific mode - return empty
		setTasks([]);
		setLoading(false);

		return () => {
			mountedRef.current = false;
		};
	}, [ticketId, workMode, intervalMs]);

	return {tasks, loading, error};
}
