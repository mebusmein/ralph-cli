import {useState, useEffect, useRef} from 'react';
import type {BeadsIssue, BeadsCommandError} from '../types/beads.js';
import {getEpicTasks} from '../lib/beads-reader.js';

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
	/** Epic ID to poll tasks for */
	epicId: string;
	/** Polling interval in milliseconds (default: 2500) */
	intervalMs?: number;
};

/**
 * Hook for polling beads task state at a specified interval.
 *
 * Polls the beads state using getEpicTasks() and returns the current
 * tasks, loading state, and any errors. Cleans up the interval on
 * unmount or when epicId changes.
 *
 * @param options - Configuration options for polling
 * @returns Current polling state with tasks, loading, and error
 */
export function useBeadsPolling(
	options: BeadsPollingOptions,
): BeadsPollingState {
	const {epicId, intervalMs = 2500} = options;

	const [tasks, setTasks] = useState<BeadsIssue[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<BeadsCommandError | null>(null);

	// Track mounted state to prevent updates after unmount
	const mountedRef = useRef(true);

	useEffect(() => {
		mountedRef.current = true;

		const fetchTasks = async (): Promise<void> => {
			const result = await getEpicTasks(epicId);

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

		// Initial fetch
		void fetchTasks();

		// Set up polling interval
		const intervalId = setInterval(() => {
			void fetchTasks();
		}, intervalMs);

		// Cleanup on unmount or when epicId changes
		return () => {
			mountedRef.current = false;
			clearInterval(intervalId);
		};
	}, [epicId, intervalMs]);

	return {tasks, loading, error};
}
