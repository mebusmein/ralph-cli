import React, {useState, useCallback, useEffect, useRef, useMemo} from 'react';
import {Text, Box, useApp, useStdout} from 'ink';
import {
	SetupWizard,
	MainLayout,
	IterationPrompt,
	KeyboardHelpFooter,
	ErrorBoundary,
	ErrorDisplay,
	type TabId,
} from './components/index.js';
import {useKeyboardControls} from './hooks/index.js';
import {
	readPRDFile,
	createIterationEmitter,
	runIterations,
	getStoriesWithStatus,
	createPromptGenerator,
	type FormattedOutput,
} from './lib/index.js';
import {checkSetup, getRalphPaths} from './utils/setup-checker.js';
import type {AppView, StoryWithStatus} from './types/state.js';

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
	// Footer: 3 rows (border + content + margin)
	// Completion message: 2 rows (when shown)
	// Top padding: 0
	const reservedRows = 5;
	const availableHeight = Math.max(10, terminalHeight - reservedRows);

	// Application state
	const [view, setView] = useState<AppView>('setup');
	const [activeTab, setActiveTab] = useState<TabId>('output');
	const [stories, setStories] = useState<StoryWithStatus[]>([]);
	const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
	const [outputMessages, setOutputMessages] = useState<FormattedOutput[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [isStopping, setIsStopping] = useState(false);
	const [completionReason, setCompletionReason] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [lastIterations, setLastIterations] = useState<number>(1);

	// AbortController for immediate cancellation
	const abortControllerRef = useRef<AbortController | null>(null);

	// Ref for graceful stop-after-iteration flag
	const stopAfterIterationRef = useRef<boolean>(false);

	// Convert FormattedOutput[] to string[] for display
	const outputLines = useMemo(
		() => outputMessages.map(msg => msg.content),
		[outputMessages],
	);

	// Load PRD and check if it has stories
	const loadPRD = useCallback(() => {
		const result = readPRDFile(paths.prdFile);
		if (result.success && result.config.userStories.length > 0) {
			setStories(getStoriesWithStatus(result.config.userStories, null));
			return true;
		}

		return false;
	}, [paths.prdFile]);

	// Handle setup wizard completion
	const handleSetupComplete = useCallback(
		(hasPrd: boolean) => {
			if (hasPrd) {
				const hasStories = loadPRD();
				if (hasStories) {
					// If initialIterations provided, skip the prompt
					if (initialIterations !== undefined) {
						setView('running');
					} else {
						setView('iteration-prompt');
					}
				} else {
					setView('no-prd');
				}
			} else {
				setView('no-prd');
			}
		},
		[loadPRD, initialIterations],
	);

	// Handle iteration confirmation
	const handleIterationConfirm = useCallback(
		(iterations: number) => {
			setView('running');
			setIsRunning(true);
			setOutputMessages([]);
			setCompletionReason(null);
			setErrorMessage(null);
			setLastIterations(iterations);

			const emitter = createIterationEmitter();
			const abortController = new AbortController();
			abortControllerRef.current = abortController;
			stopAfterIterationRef.current = false;

			// Set up event listeners
			emitter.on('storyStart', story => {
				setCurrentStoryId(story.id);
				setStories(prev =>
					prev.map(s =>
						s.id === story.id ? {...s, status: 'in-progress'} : s,
					),
				);
				// Add story start as an assistant message for visibility
				setOutputMessages(prev => [
					...prev,
					{
						source: 'assistant',
						content: `\n--- Starting ${story.id}: ${story.title} ---\n`,
					},
				]);
			});

			emitter.on('output', data => {
				// data is the filtered FormattedOutput[] - replace the current messages
				// with the filtered view (which includes all assistant + recent user messages)
				setOutputMessages(data);
			});

			emitter.on('storyComplete', (storyId, success) => {
				setStories(prev =>
					prev.map(s =>
						s.id === storyId
							? {...s, status: success ? 'passed' : 'failed'}
							: s,
					),
				);
				setCurrentStoryId(null);
			});

			emitter.on('iterationComplete', iteration => {
				setOutputMessages(prev => [
					...prev,
					{
						source: 'assistant',
						content: `\n--- Iteration ${iteration} complete ---\n`,
					},
				]);
				// Reload PRD to get updated statuses
				loadPRD();
			});

			emitter.on('complete', reason => {
				setIsRunning(false);
				setIsStopping(false);
				setCurrentStoryId(null);
				abortControllerRef.current = null;

				const reasonMessages: Record<string, string> = {
					finished: 'All iterations completed',
					all_passed: 'All stories passed!',
					stopped: 'Stopped by user',
					error: 'Stopped due to error',
				};
				setCompletionReason(reasonMessages[reason] ?? reason);
				setView('complete');
			});

			emitter.on('error', errorMsg => {
				setOutputMessages(prev => [
					...prev,
					{source: 'assistant', content: `\nError: ${errorMsg}\n`},
				]);
			});

			// Start execution
			const promptGenerator = createPromptGenerator(cwd);
			runIterations(
				{
					iterations,
					prdPath: paths.prdFile,
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
		[cwd, paths.prdFile, loadPRD, logFile],
	);

	// Handle iteration cancel
	const handleIterationCancel = useCallback(() => {
		exit();
	}, [exit]);

	// Handle retry after error
	const handleRetry = useCallback(() => {
		setErrorMessage(null);
		loadPRD();
		handleIterationConfirm(lastIterations);
	}, [loadPRD, handleIterationConfirm, lastIterations]);

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

	// Keyboard controls
	useKeyboardControls(
		{
			onTabChange: setActiveTab,
			onStopAfterIteration: handleStopAfterIteration,
			onImmediateCancel: handleImmediateCancel,
		},
		{
			activeTab,
			enabled: view === 'running' || view === 'complete',
		},
	);

	// Auto-start if initialIterations provided and we're on the running view
	useEffect(() => {
		if (view === 'running' && !isRunning && initialIterations !== undefined) {
			handleIterationConfirm(initialIterations);
		}
	}, [view, isRunning, initialIterations, handleIterationConfirm]);

	// Initial setup check
	useEffect(() => {
		const setupResult = checkSetup(cwd);
		if (setupResult.isComplete) {
			const hasStories = loadPRD();
			if (hasStories) {
				if (initialIterations !== undefined) {
					setView('running');
				} else {
					setView('iteration-prompt');
				}
			} else {
				setView('no-prd');
			}
		}
		// If setup is not complete, stay in 'setup' view for SetupWizard
	}, [cwd, loadPRD, initialIterations]);

	// Render based on current view
	if (view === 'setup') {
		return <SetupWizard cwd={cwd} onComplete={handleSetupComplete} />;
	}

	if (view === 'no-prd') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Ralph CLI
				</Text>
				<Text> </Text>
				<Text color="yellow">No user stories found in prd.json</Text>
				<Text> </Text>
				<Text>To get started:</Text>
				<Text color="gray">
					1. Run /ralph-plan in Claude to create user stories
				</Text>
				<Text color="gray">2. Create a feature branch for your work</Text>
				<Text color="gray">3. Run ralph-cli again</Text>
				<Text> </Text>
				<Text color="gray">Press any key to exit...</Text>
			</Box>
		);
	}

	if (view === 'iteration-prompt') {
		return (
			<IterationPrompt
				defaultValue={1}
				onConfirm={handleIterationConfirm}
				onCancel={handleIterationCancel}
			/>
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
					onExit={exit}
				/>
			</Box>
		);
	}

	if (view === 'running' || view === 'complete') {
		return (
			<ErrorBoundary onRetry={handleRetry} onExit={exit}>
				<Box flexDirection="column" height={terminalHeight}>
					<MainLayout
						stories={stories}
						currentStoryId={currentStoryId}
						activeTab={activeTab}
						outputLines={outputLines}
						progressFilePath={paths.progressFile}
						onTabChange={setActiveTab}
						height={availableHeight}
						terminalWidth={terminalWidth}
					/>
					{completionReason && (
						<Box paddingX={1} marginTop={1}>
							<Text
								color={
									completionReason === 'All stories passed!'
										? 'green'
										: 'yellow'
								}
								bold
							>
								{completionReason}
							</Text>
						</Box>
					)}
					<KeyboardHelpFooter isRunning={isRunning} isStopping={isStopping} />
				</Box>
			</ErrorBoundary>
		);
	}

	return null;
}
