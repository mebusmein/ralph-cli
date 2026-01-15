import React, {useState, useCallback, useEffect, useRef, useMemo} from 'react';
import {Text, Box, useApp, useStdout, useInput} from 'ink';
import {
	MainLayout,
	KeyboardHelpFooter,
	ErrorBoundary,
	ErrorDisplay,
	TicketSelector,
	SetupWizardPanel,
	WelcomePanel,
	type TabId,
	type TicketSelection,
	type WorkMode,
	type ScaffoldingStatus,
} from './components/index.js';
import {useKeyboardControls, useBeadsPolling} from './hooks/index.js';
import {
	createIterationEmitter,
	runIterations,
	createPromptGenerator,
	type FormattedOutput,
	getExternalBlockers,
	runBeadsSync,
	getTickets,
} from './lib/index.js';
import {checkSetup, getRalphPaths} from './utils/setup-checker.js';
import {isOnMainBranch, getCurrentBranch} from './utils/branch-utils.js';
import {
	createRalphDirectory,
	createPromptTemplate,
	createProgressTemplate,
	initializeBeads,
} from './utils/setup-scaffolding.js';
import type {SetupPhase, SetupCheckResult} from './types/index.js';
import type {BeadsIssue, TicketSummary} from './types/beads.js';

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

	// Application state - unified layout with setupPhase
	const [setupPhase, setSetupPhase] = useState<SetupPhase | null>('checking');
	const [setupCheckResult, setSetupCheckResult] =
		useState<SetupCheckResult | null>(null);
	const [scaffoldStatus, setScaffoldStatus] = useState<ScaffoldingStatus>({});
	const [activeTab, setActiveTab] = useState<TabId>('output');
	const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(
		null,
	);
	const [workMode, setWorkMode] = useState<WorkMode>('specific');
	const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
	const [externalBlockers, setExternalBlockers] = useState<BeadsIssue[]>([]);
	const [outputMessages, setOutputMessages] = useState<FormattedOutput[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [isStopping, setIsStopping] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const [completionReason, setCompletionReason] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [lastIterations, setLastIterations] = useState<number>(1);

	// Ticket selector state (for unified left panel)
	const [selectorTickets, setSelectorTickets] = useState<TicketSummary[]>([]);
	const [selectorIndex, setSelectorIndex] = useState(0);
	const [selectorLoading, setSelectorLoading] = useState(false);
	const [selectorError, setSelectorError] = useState<string | null>(null);

	// Main branch warning state
	const [showMainBranchWarning, setShowMainBranchWarning] = useState(false);
	const [currentBranchName, setCurrentBranchName] = useState<string | null>(
		null,
	);

	// AbortController for immediate cancellation
	const abortControllerRef = useRef<AbortController | null>(null);

	// Ref for graceful stop-after-iteration flag
	const stopAfterIterationRef = useRef<boolean>(false);

	// Convert FormattedOutput[] to string[] for display
	const outputLines = useMemo(
		() => outputMessages.map(msg => msg.content),
		[outputMessages],
	);

	// Determine if we're in the main execution view (no setup phase, ticket selected or all mode)
	const isMainView =
		setupPhase === null && (workMode === 'all' || selectedTicket !== null);

	// Use beads polling when we're in main view
	// In 'all' mode, we poll all open tickets
	// In 'specific' mode, we poll descendants of the selected ticket
	const {tasks: beadsTasks, loading: tasksLoading} = useBeadsPolling({
		ticketId: selectedTicket?.id ?? '',
		workMode,
		intervalMs: 2500,
	});

	// Use polled tasks based on work mode
	const tasks = workMode === 'all' || selectedTicket ? beadsTasks : [];

	// Fetch external blockers when ticket changes (only in specific mode)
	useEffect(() => {
		if (!selectedTicket || workMode === 'all') {
			setExternalBlockers([]);
			return;
		}

		let mounted = true;

		async function fetchBlockers() {
			const result = await getExternalBlockers(selectedTicket!.id);
			if (mounted && result.success) {
				setExternalBlockers(result.data);
			}
		}

		void fetchBlockers();

		return () => {
			mounted = false;
		};
	}, [selectedTicket, workMode]);

	// Find the selected task from selectedTaskId
	const selectedTask = useMemo(
		() => tasks.find(t => t.id === selectedTaskId) ?? null,
		[tasks, selectedTaskId],
	);

	// Handle ticket selection - transition to main view
	const handleTicketSelect = useCallback((selection: TicketSelection) => {
		const {ticket, workMode: selectedWorkMode} = selection;

		setWorkMode(selectedWorkMode);
		setSelectedTicket(selectedWorkMode === 'all' ? null : ticket);
		// Note: Branch switching logic removed - handled by separate task ralph-cli-dm6
	}, []);

	// Handle back to ticket selection (from main view)
	const handleBackToTicketSelect = useCallback(() => {
		if (isRunning) return; // Don't allow back during execution
		setSelectedTicket(null);
		setWorkMode('specific');
		setSelectorIndex(0);
	}, [isRunning]);

	// Run scaffolding for setup
	const runScaffolding = useCallback(() => {
		setSetupPhase('scaffolding');

		try {
			const ralphDir = createRalphDirectory(cwd);
			setScaffoldStatus(prev => ({...prev, ralphDir}));

			const promptFile = createPromptTemplate(cwd);
			setScaffoldStatus(prev => ({...prev, promptFile}));

			const progressFile = createProgressTemplate(cwd);
			setScaffoldStatus(prev => ({...prev, progressFile}));

			const beads = initializeBeads(cwd);
			setScaffoldStatus(prev => ({...prev, beads}));

			const allSuccess =
				ralphDir.success &&
				promptFile.success &&
				progressFile.success &&
				beads.success;

			if (allSuccess) {
				setSetupPhase('complete');
			} else {
				setSetupPhase('error');
				setErrorMessage('Some setup steps failed. See details above.');
			}
		} catch (error) {
			setSetupPhase('error');
			setErrorMessage(
				error instanceof Error ? error.message : 'Unknown error occurred',
			);
		}
	}, [cwd]);

	// Setup keyboard handling (for setup phases)
	useInput(
		(input, key) => {
			if (setupPhase === 'prompt') {
				if (input.toLowerCase() === 'y') {
					runScaffolding();
				} else if (input.toLowerCase() === 'n' || key.escape) {
					exit();
				}
			} else if (setupPhase === 'complete') {
				if (key.return || input.toLowerCase() === 'c') {
					// Move to ticket selection
					setSetupPhase(null);
					// Load tickets
					setSelectorLoading(true);
					void getTickets().then(result => {
						if (result.success) {
							setSelectorTickets(result.data);
						} else {
							setSelectorError(result.error.message);
						}
						setSelectorLoading(false);
					});
				} else if (key.escape || input.toLowerCase() === 'q') {
					exit();
				}
			} else if (setupPhase === 'error') {
				if (key.return || key.escape) {
					exit();
				}
			}
		},
		{isActive: setupPhase !== null},
	);

	// Ticket selector keyboard handling (when in selection mode)
	const isTicketSelectMode =
		setupPhase === null && selectedTicket === null && workMode === 'specific';
	const totalSelectorItems = 1 + selectorTickets.length;

	useInput(
		(_input, key) => {
			if (selectorLoading) return;

			if (key.downArrow) {
				setSelectorIndex(prev => Math.min(prev + 1, totalSelectorItems - 1));
			} else if (key.upArrow) {
				setSelectorIndex(prev => Math.max(prev - 1, 0));
			} else if (key.return) {
				if (selectorIndex === 0) {
					handleTicketSelect({ticket: null, workMode: 'all'});
				} else {
					const ticket = selectorTickets[selectorIndex - 1];
					if (ticket) {
						handleTicketSelect({ticket, workMode: 'specific'});
					}
				}
			}
		},
		{isActive: isTicketSelectMode},
	);

	// Main branch warning dismiss keyboard handler
	useInput(
		(input, key) => {
			// Dismiss warning with 'd', Enter, or Escape
			if (input.toLowerCase() === 'd' || key.return || key.escape) {
				setShowMainBranchWarning(false);
			}
		},
		{isActive: showMainBranchWarning},
	);

	// Handle iteration confirmation (start execution)
	const handleIterationConfirm = useCallback(
		(iterations: number) => {
			// In specific mode, we need a selected ticket
			// In all mode, we run without a specific ticket
			if (workMode === 'specific' && !selectedTicket) return;

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

			emitter.on('complete', reason => {
				setIsRunning(false);
				setIsStopping(false);
				setSelectedTaskId(null);
				abortControllerRef.current = null;

				const reasonMessages: Record<string, string> = {
					finished: 'All iterations completed',
					all_closed: 'All tasks closed!',
					no_ready_tasks: 'No ready tasks - all blocked',
					stopped: 'Stopped by user',
					error: 'Stopped due to error',
				};
				setCompletionReason(reasonMessages[reason] ?? reason);
				// No auto-navigation on completion - user decides when done
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
				ticketId: selectedTicket?.id ?? '',
				ticketTitle: selectedTicket?.title ?? '',
				workMode,
			});

			runIterations(
				{
					iterations,
					ticketId: selectedTicket?.id ?? '',
					workMode,
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
				// Error is shown inline via errorMessage state
			});
		},
		[cwd, selectedTicket, workMode, logFile],
	);

	// Handle retry after error
	const handleRetry = useCallback(() => {
		setErrorMessage(null);
		if (workMode === 'all' || selectedTicket) {
			handleIterationConfirm(lastIterations);
		} else {
			// Go back to ticket selection
			handleBackToTicketSelect();
		}
	}, [
		handleIterationConfirm,
		lastIterations,
		selectedTicket,
		workMode,
		handleBackToTicketSelect,
	]);

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

	// Keyboard controls (only enabled when in main execution view)
	useKeyboardControls(
		{
			onTabChange: setActiveTab,
			onStopAfterIteration: handleStopAfterIteration,
			onImmediateCancel: handleImmediateCancel,
			onBackToTicketSelect: handleBackToTicketSelect,
		},
		{
			activeTab,
			enabled: isMainView,
		},
	);

	// Auto-start if initialIterations provided and we're in main view
	useEffect(() => {
		const canStart =
			isMainView &&
			!isRunning &&
			initialIterations !== undefined &&
			(workMode === 'all' || selectedTicket);

		if (canStart) {
			handleIterationConfirm(initialIterations);
		}
		// Only run once when transitioning to main view with initialIterations
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isMainView, selectedTicket, workMode]);

	// Initial setup check
	useEffect(() => {
		const setupResult = checkSetup(cwd);
		setSetupCheckResult(setupResult);

		// Check if on main/master branch and show warning
		if (isOnMainBranch()) {
			setCurrentBranchName(getCurrentBranch() ?? 'main');
			setShowMainBranchWarning(true);
		}

		if (setupResult.isComplete && setupResult.isBeadsInitialized) {
			// Setup complete - load tickets and skip to selection
			setSetupPhase(null);
			setSelectorLoading(true);
			void getTickets().then(result => {
				if (result.success) {
					setSelectorTickets(result.data);
				} else {
					setSelectorError(result.error.message);
				}
				setSelectorLoading(false);
			});
		} else {
			// Show setup prompt
			setSetupPhase('prompt');
		}
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

	// Calculate content panel width for right column
	const rightPanelWidth = Math.floor(terminalWidth * 0.7) - 5;

	// Update ticket summary with live data (only in specific mode and main view)
	const updatedTicket: TicketSummary | null =
		isMainView && selectedTicket
			? {
					...selectedTicket,
					openCount: tasks.filter(t => t.status !== 'closed').length,
					closedCount: tasks.filter(t => t.status === 'closed').length,
					progress:
						tasks.length > 0
							? Math.round(
									(tasks.filter(t => t.status === 'closed').length /
										tasks.length) *
										100,
							  )
							: 0,
					hasBlockedTasks: tasks.some(t => t.blockedBy.length > 0),
			  }
			: null;

	// Calculate left content based on state
	const leftContent = useMemo(() => {
		// During setup phases - no left content (full-width setup panel)
		if (setupPhase !== null) {
			return null;
		}

		// Ticket selection mode - show embedded selector
		if (!isMainView) {
			return (
				<TicketSelector
					embedded
					selectedIndex={selectorIndex}
					tickets={selectorTickets}
					isLoading={selectorLoading}
					error={selectorError}
					onSelect={handleTicketSelect}
				/>
			);
		}

		// Main view - default task list (handled by MainLayout)
		return undefined;
	}, [
		setupPhase,
		isMainView,
		selectorIndex,
		selectorTickets,
		selectorLoading,
		selectorError,
		handleTicketSelect,
	]);

	// Calculate right content based on state
	const rightContent = useMemo(() => {
		// Setup phases - show setup wizard panel
		if (setupPhase !== null) {
			return (
				<SetupWizardPanel
					phase={setupPhase}
					checkResult={setupCheckResult}
					scaffoldStatus={scaffoldStatus}
					errorMessage={errorMessage}
					contentWidth={rightPanelWidth}
				/>
			);
		}

		// Ticket selection mode - show welcome panel
		if (!isMainView) {
			return <WelcomePanel contentWidth={rightPanelWidth} />;
		}

		// Main view with error - show error inline
		if (errorMessage) {
			return (
				<ErrorDisplay
					error={new Error(errorMessage)}
					onRetry={handleRetry}
					onExit={() => void handleExitWithSync()}
				/>
			);
		}

		// Main view - default content (handled by MainLayout)
		return undefined;
	}, [
		setupPhase,
		setupCheckResult,
		scaffoldStatus,
		errorMessage,
		rightPanelWidth,
		isMainView,
		handleRetry,
		handleExitWithSync,
	]);

	// Calculate header content based on state
	const headerContent = useMemo(() => {
		// Setup phases - show Ralph CLI header
		if (setupPhase !== null) {
			return (
				<Text bold color="cyan">
					Ralph CLI - Setup
				</Text>
			);
		}

		// Ticket selection mode - show selection header
		if (!isMainView) {
			return (
				<Text bold color="cyan">
					Ralph CLI - Select Work
				</Text>
			);
		}

		// Main view - use default header from MainLayout
		return undefined;
	}, [setupPhase, isMainView]);

	// Always render MainLayout with calculated content
	return (
		<ErrorBoundary
			onRetry={handleRetry}
			onExit={() => void handleExitWithSync()}
		>
			<Box flexDirection="column" height={terminalHeight}>
				{showMainBranchWarning && (
					<Box
						borderStyle="round"
						borderColor="yellow"
						paddingX={1}
						marginBottom={1}
					>
						<Text color="yellow" bold>
							Warning:{' '}
						</Text>
						<Text>
							You are on the <Text color="cyan">{currentBranchName}</Text>{' '}
							branch. Consider creating a feature branch before making changes.
						</Text>
						<Text color="gray"> Press </Text>
						<Text color="white" bold>
							d
						</Text>
						<Text color="gray"> to dismiss</Text>
					</Box>
				)}
				<MainLayout
					leftContent={leftContent}
					rightContent={rightContent}
					headerContent={headerContent}
					selectedTicket={updatedTicket}
					workMode={workMode}
					tasks={isMainView ? tasks : []}
					selectedTask={isMainView ? selectedTask : null}
					externalBlockers={isMainView ? externalBlockers : []}
					rightPanelView={isRunning ? 'output' : 'task-detail'}
					activeTab={activeTab}
					outputLines={outputLines}
					progressFilePath={paths.progressFile}
					height={availableHeight}
					terminalWidth={terminalWidth}
				/>
				{isMainView && tasksLoading && (
					<Box paddingX={1}>
						<Text color="gray">Loading tasks...</Text>
					</Box>
				)}
				{isMainView && completionReason && (
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
					onStartIterations={
						isMainView && !isRunning ? handleIterationConfirm : undefined
					}
				/>
			</Box>
		</ErrorBoundary>
	);
}
