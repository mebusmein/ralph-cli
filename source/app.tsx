import React, {useState, useCallback, useEffect, useRef, useMemo} from 'react';
import {Text, Box, useApp, useStdout, useInput} from 'ink';
import {
	SetupWizard,
	MainLayout,
	KeyboardHelpFooter,
	ErrorBoundary,
	ErrorDisplay,
	EpicSelector,
	type TabId,
} from './components/index.js';
import {useKeyboardControls, useBeadsPolling} from './hooks/index.js';
import {
	createIterationEmitter,
	runIterations,
	createPromptGenerator,
	type FormattedOutput,
	getExternalBlockers,
	runBeadsSync,
} from './lib/index.js';
import {checkSetup, getRalphPaths} from './utils/setup-checker.js';
import {
	deriveBranchName,
	getCurrentBranch,
	branchExists,
	createAndSwitchBranch,
	hasUncommittedChanges,
} from './utils/branch-utils.js';
import type {AppView} from './types/state.js';
import type {BeadsIssue, EpicSummary} from './types/beads.js';

type Props = {
	cwd?: string;
	initialIterations?: number;
	logFile?: string;
};

export default function App({
	cwd = process.cwd(),
	initialIterations,
	logFile,
}: Props) {
	const {exit} = useApp();
	const {stdout} = useStdout();
	const paths = getRalphPaths(cwd);

	// Terminal dimensions for fixed-height layout
	const [terminalHeight, setTerminalHeight] = useState(stdout?.rows ?? 24);
	const [terminalWidth, setTerminalWidth] = useState(stdout?.columns ?? 80);

	// Listen for terminal resize events
	useEffect(() => {
		if (!stdout) return;

		const handleResize = () => {
			setTerminalHeight(stdout.rows);
			setTerminalWidth(stdout.columns);
		};

		stdout.on('resize', handleResize);
		// Set initial values
		handleResize();

		return () => {
			stdout.off('resize', handleResize);
		};
	}, [stdout]);

	// Calculate available height for MainLayout (reserve space for footer, completion message, padding)
	const reservedRows = 5;
	const availableHeight = Math.max(10, terminalHeight - reservedRows);

	// Application state
	const [view, setView] = useState<AppView>('setup');
	const [activeTab, setActiveTab] = useState<TabId>('output');
	const [selectedEpic, setSelectedEpic] = useState<EpicSummary | null>(null);
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [externalBlockers, setExternalBlockers] = useState<BeadsIssue[]>([]);
	const [outputMessages, setOutputMessages] = useState<FormattedOutput[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [isStopping, setIsStopping] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const [completionReason, setCompletionReason] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [lastIterations, setLastIterations] = useState<number>(1);

	// Branch switch confirmation state
	const [pendingBranchSwitch, setPendingBranchSwitch] = useState<{
		epic: EpicSummary;
		branchName: string;
		needsCreation: boolean;
	} | null>(null);
	const [uncommittedWarning, setUncommittedWarning] = useState(false);

	// AbortController for immediate cancellation
	const abortControllerRef = useRef<AbortController | null>(null);

	// Ref for graceful stop-after-iteration flag
	const stopAfterIterationRef = useRef<boolean>(false);

	// Convert FormattedOutput[] to string[] for display
	const outputLines = useMemo(
		() => outputMessages.map(msg => msg.content),
		[outputMessages],
	);

	// Use beads polling when we have a selected epic and are on main view
	const {tasks: beadsTasks, loading: tasksLoading} = useBeadsPolling({
		epicId: selectedEpic?.id ?? '',
		intervalMs: 2500,
	});

	// Only use polled tasks when we have a selected epic
	const tasks = selectedEpic ? beadsTasks : [];

	// Fetch external blockers when epic changes
	useEffect(() => {
		if (!selectedEpic) {
			setExternalBlockers([]);
			return;
		}

		let mounted = true;

		async function fetchBlockers() {
			const result = await getExternalBlockers(selectedEpic!.id);
			if (mounted && result.success) {
				setExternalBlockers(result.data);
			}
		}

		void fetchBlockers();

		return () => {
			mounted = false;
		};
	}, [selectedEpic]);

	// Find the selected task from selectedTaskId
	const selectedTask = useMemo(
		() => tasks.find(t => t.id === selectedTaskId) ?? null,
		[tasks, selectedTaskId],
	);

	// Handle epic selection - check branch and switch/create
	const handleEpicSelect = useCallback((epic: EpicSummary) => {
		const branchName = deriveBranchName(epic.title);
		const currentBranch = getCurrentBranch();

		// Already on the correct branch
		if (currentBranch === branchName) {
			setSelectedEpic(epic);
			setView('main');
			return;
		}

		// Check for uncommitted changes
		if (hasUncommittedChanges()) {
			setUncommittedWarning(true);
			setPendingBranchSwitch({
				epic,
				branchName,
				needsCreation: !branchExists(branchName),
			});
			return;
		}

		// Proceed with branch switch
		proceedWithBranchSwitch(epic, branchName);
	}, []);

	// Proceed with branch switch after user confirmation or no uncommitted changes
	const proceedWithBranchSwitch = useCallback(
		(epic: EpicSummary, branchName: string) => {
			const needsCreation = !branchExists(branchName);

			if (needsCreation) {
				const result = createAndSwitchBranch(branchName);
				if (!result.success) {
					setErrorMessage(`Failed to create branch: ${result.error}`);
					setView('error');
					return;
				}
			} else {
				// Switch to existing branch
				try {
					const {execSync} = require('node:child_process');
					execSync(`git checkout ${branchName}`, {
						encoding: 'utf8',
						stdio: ['pipe', 'pipe', 'pipe'],
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : 'Unknown error';
					setErrorMessage(`Failed to switch branch: ${message}`);
					setView('error');
					return;
				}
			}

			setSelectedEpic(epic);
			setUncommittedWarning(false);
			setPendingBranchSwitch(null);
			setView('main');
		},
		[],
	);

	// Handle uncommitted changes warning response
	useInput(
		(input, key) => {
			if (!uncommittedWarning || !pendingBranchSwitch) return;

			if (input.toLowerCase() === 'y' || key.return) {
				// User wants to proceed anyway
				proceedWithBranchSwitch(
					pendingBranchSwitch.epic,
					pendingBranchSwitch.branchName,
				);
			} else if (input.toLowerCase() === 'n' || key.escape) {
				// User cancelled - go back to epic selection
				setUncommittedWarning(false);
				setPendingBranchSwitch(null);
			}
		},
		{isActive: uncommittedWarning},
	);

	// Handle setup wizard completion
	const handleSetupComplete = useCallback((hasPrd: boolean) => {
		// After setup, always go to epic selection (beads workflow)
		// The hasPrd parameter is kept for backward compat but we use beads now
		void hasPrd; // Suppress unused warning
		setView('epic-select');
	}, []);

	// Handle iteration confirmation (start execution)
	const handleIterationConfirm = useCallback(
		(iterations: number) => {
			if (!selectedEpic) return;

			setIsRunning(true);
			setOutputMessages([]);
			setCompletionReason(null);
			setErrorMessage(null);
			setLastIterations(iterations);

			const emitter = createIterationEmitter();
			const abortController = new AbortController();
			abortControllerRef.current = abortController;
			stopAfterIterationRef.current = false;

			// Set up event listeners for beads workflow
			emitter.on('taskStart', task => {
				setSelectedTaskId(task.id);
				setOutputMessages(prev => [
					...prev,
					{
						source: 'assistant',
						content: `\n--- Starting ${task.id}: ${task.title} ---\n`,
					},
				]);
			});

			emitter.on('output', data => {
				setOutputMessages(data);
			});

			emitter.on('taskComplete', (taskId, success) => {
				void taskId;
				void success;
				setSelectedTaskId(null);
			});

			emitter.on('iterationComplete', iteration => {
				setOutputMessages(prev => [
					...prev,
					{
						source: 'assistant',
						content: `\n--- Iteration ${iteration} complete ---\n`,
					},
				]);
			});

			emitter.on('noReadyTasks', () => {
				setOutputMessages(prev => [
					...prev,
					{
						source: 'assistant',
						content: '\n--- No ready tasks (all blocked or closed) ---\n',
					},
				]);
			});

			emitter.on('epicComplete', epicId => {
				setOutputMessages(prev => [
					...prev,
					{
						source: 'assistant',
						content: `\n--- Epic ${epicId} complete! ---\n`,
					},
				]);
			});

			emitter.on('complete', reason => {
				setIsRunning(false);
				setIsStopping(false);
				setSelectedTaskId(null);
				abortControllerRef.current = null;

				const reasonMessages: Record<string, string> = {
					finished: 'All iterations completed',
					all_closed: 'All tasks closed!',
					epic_complete: 'Epic complete! All tasks done.',
					no_ready_tasks: 'No ready tasks - all blocked',
					stopped: 'Stopped by user',
					error: 'Stopped due to error',
				};
				setCompletionReason(reasonMessages[reason] ?? reason);

				// After epic completion, prompt for next epic selection
				if (reason === 'epic_complete') {
					// Clear the selected epic to allow new selection
					setSelectedEpic(null);
					setView('epic-select');
				}
			});

			emitter.on('error', errorMsg => {
				setOutputMessages(prev => [
					...prev,
					{source: 'assistant', content: `\nError: ${errorMsg}\n`},
				]);
			});

			// Start execution with beads workflow
			const promptGenerator = createPromptGenerator({
				cwd,
				epicId: selectedEpic.id,
				epicTitle: selectedEpic.title,
			});

			runIterations(
				{
					iterations,
					epicId: selectedEpic.id,
					promptGenerator,
					logFile,
					shouldStopAfterIteration: () => stopAfterIterationRef.current,
				},
				emitter,
				abortController.signal,
			).catch(error => {
				const message =
					error instanceof Error ? error.message : 'Unknown error';
				setErrorMessage(message);
				setIsRunning(false);
				setIsStopping(false);
				abortControllerRef.current = null;
				setView('error');
			});
		},
		[cwd, selectedEpic, logFile],
	);

	// Handle retry after error
	const handleRetry = useCallback(() => {
		setErrorMessage(null);
		if (selectedEpic) {
			handleIterationConfirm(lastIterations);
		} else {
			setView('epic-select');
		}
	}, [handleIterationConfirm, lastIterations, selectedEpic]);

	// Handle stop after iteration (graceful stop - doesn't kill current process)
	const handleStopAfterIteration = useCallback(() => {
		if (isRunning && !isStopping) {
			setIsStopping(true);
			stopAfterIterationRef.current = true;
		}
	}, [isRunning, isStopping]);

	// Handle immediate cancel
	const handleImmediateCancel = useCallback(() => {
		abortControllerRef.current?.abort();
	}, []);

	// Keyboard controls (only enabled when on main view)
	useKeyboardControls(
		{
			onTabChange: setActiveTab,
			onStopAfterIteration: handleStopAfterIteration,
			onImmediateCancel: handleImmediateCancel,
		},
		{
			activeTab,
			enabled: view === 'main',
		},
	);

	// Auto-start if initialIterations provided and we're on the main view
	useEffect(() => {
		if (
			view === 'main' &&
			!isRunning &&
			initialIterations !== undefined &&
			selectedEpic
		) {
			handleIterationConfirm(initialIterations);
		}
		// Only run once when transitioning to main view with initialIterations
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [view, selectedEpic]);

	// Initial setup check
	useEffect(() => {
		const setupResult = checkSetup(cwd);
		if (setupResult.isComplete && setupResult.isBeadsInitialized) {
			// Go to epic selection instead of loading PRD
			setView('epic-select');
		}
		// If setup is not complete, stay in 'setup' view for SetupWizard
	}, [cwd]);

	// Run beads sync on exit
	const handleExitWithSync = useCallback(async () => {
		setIsSyncing(true);
		const result = await runBeadsSync();
		setIsSyncing(false);
		if (!result.success) {
			// Log warning but don't prevent exit (silent continue)
			console.warn(`bd sync warning: ${result.error}`);
		}

		exit();
	}, [exit]);

	// Sync beads state on component unmount
	useEffect(() => {
		return () => {
			// Run sync on unmount - fire and forget since we're unmounting
			void runBeadsSync().catch(() => {
				// Silent continue on error
			});
		};
	}, []);

	// Render based on current view
	if (view === 'setup') {
		return <SetupWizard cwd={cwd} onComplete={handleSetupComplete} />;
	}

	if (view === 'epic-select') {
		// Show uncommitted changes warning if needed
		if (uncommittedWarning && pendingBranchSwitch) {
			return (
				<Box flexDirection="column" padding={1}>
					<Text color="cyan" bold>
						Ralph CLI
					</Text>
					<Text> </Text>
					<Text color="yellow" bold>
						Warning: Uncommitted changes detected
					</Text>
					<Text> </Text>
					<Text>You have uncommitted changes in your working directory.</Text>
					<Text>
						Switching to branch &quot;{pendingBranchSwitch.branchName}&quot;
						{pendingBranchSwitch.needsCreation ? ' (will be created)' : ''} may
						cause conflicts.
					</Text>
					<Text> </Text>
					<Text color="gray">
						Press Y to proceed anyway, N to cancel and commit your changes
						first.
					</Text>
				</Box>
			);
		}

		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Ralph CLI
				</Text>
				<Text> </Text>
				<EpicSelector onSelect={handleEpicSelect} />
			</Box>
		);
	}

	if (view === 'no-prd') {
		// This view is now deprecated but kept for backward compatibility
		// Users should see epic-select instead
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Ralph CLI
				</Text>
				<Text> </Text>
				<Text color="yellow">No epics found in beads</Text>
				<Text> </Text>
				<Text>To get started:</Text>
				<Text color="gray">
					1. Use beads to create epics with tasks (bd create --type=epic)
				</Text>
				<Text color="gray">2. Run ralph-cli again</Text>
				<Text> </Text>
				<Text color="gray">Press any key to exit...</Text>
			</Box>
		);
	}

	if (view === 'error') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Ralph CLI
				</Text>
				<Text> </Text>
				<ErrorDisplay
					error={new Error(errorMessage ?? 'An unknown error occurred')}
					onRetry={handleRetry}
					onExit={() => void handleExitWithSync()}
				/>
			</Box>
		);
	}

	// Main view with beads workflow
	if (view === 'main' && selectedEpic) {
		// Update epic summary with live data
		const updatedEpic: EpicSummary = {
			...selectedEpic,
			openCount: tasks.filter(t => t.status !== 'closed').length,
			closedCount: tasks.filter(t => t.status === 'closed').length,
			progress:
				tasks.length > 0
					? Math.round(
							(tasks.filter(t => t.status === 'closed').length / tasks.length) *
								100,
					  )
					: 0,
			hasBlockedTasks: tasks.some(t => t.blockedBy.length > 0),
		};

		return (
			<ErrorBoundary
				onRetry={handleRetry}
				onExit={() => void handleExitWithSync()}
			>
				<Box flexDirection="column" height={terminalHeight}>
					<MainLayout
						selectedEpic={updatedEpic}
						tasks={tasks}
						selectedTask={selectedTask}
						externalBlockers={externalBlockers}
						rightPanelView={isRunning ? 'output' : 'task-detail'}
						activeTab={activeTab}
						outputLines={outputLines}
						progressFilePath={paths.progressFile}
						height={availableHeight}
						terminalWidth={terminalWidth}
					/>
					{tasksLoading && (
						<Box paddingX={1}>
							<Text color="gray">Loading tasks...</Text>
						</Box>
					)}
					{completionReason && (
						<Box paddingX={1} marginTop={1}>
							<Text
								color={
									completionReason.includes('complete') ||
									completionReason.includes('closed')
										? 'green'
										: 'yellow'
								}
								bold
							>
								{completionReason}
							</Text>
						</Box>
					)}
					<KeyboardHelpFooter
						isRunning={isRunning}
						isStopping={isStopping}
						isSyncing={isSyncing}
						onStartIterations={!isRunning ? handleIterationConfirm : undefined}
					/>
				</Box>
			</ErrorBoundary>
		);
	}

	return null;
}
