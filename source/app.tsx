import React, {useState, useCallback, useEffect, useRef} from 'react';
import {Text, Box, useApp} from 'ink';
import {
	SetupWizard,
	MainLayout,
	IterationPrompt,
	KeyboardHelpFooter,
	type TabId,
} from './components/index.js';
import {useKeyboardControls} from './hooks/index.js';
import {
	readPRDFile,
	createIterationEmitter,
	runIterations,
	getStoriesWithStatus,
	createPromptGenerator,
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
	const paths = getRalphPaths(cwd);

	// Application state
	const [view, setView] = useState<AppView>('setup');
	const [activeTab, setActiveTab] = useState<TabId>('output');
	const [stories, setStories] = useState<StoryWithStatus[]>([]);
	const [currentStoryId, setCurrentStoryId] = useState<string | null>(null);
	const [outputLines, setOutputLines] = useState<string[]>([]);
	const [isRunning, setIsRunning] = useState(false);
	const [isStopping, setIsStopping] = useState(false);
	const [completionReason, setCompletionReason] = useState<string | null>(null);

	// AbortController for cancellation
	const abortControllerRef = useRef<AbortController | null>(null);

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
			setOutputLines([]);
			setCompletionReason(null);

			const emitter = createIterationEmitter();
			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			// Set up event listeners
			emitter.on('storyStart', story => {
				setCurrentStoryId(story.id);
				setStories(prev =>
					prev.map(s =>
						s.id === story.id ? {...s, status: 'in-progress'} : s,
					),
				);
				setOutputLines(prev => [
					...prev,
					`\n--- Starting ${story.id}: ${story.title} ---\n`,
				]);
			});

			emitter.on('output', data => {
				setOutputLines(prev => [...prev, data]);
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
				setOutputLines(prev => [
					...prev,
					`\n--- Iteration ${iteration} complete ---\n`,
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
				setOutputLines(prev => [...prev, `\nError: ${errorMsg}\n`]);
			});

			// Start execution
			const promptGenerator = createPromptGenerator(cwd);
			runIterations(
				{
					iterations,
					prdPath: paths.prdFile,
					promptGenerator,
					logFile,
				},
				emitter,
				abortController.signal,
			).catch(error => {
				setOutputLines(prev => [
					...prev,
					`\nFatal error: ${
						error instanceof Error ? error.message : 'Unknown error'
					}\n`,
				]);
				setIsRunning(false);
				setView('complete');
			});
		},
		[cwd, paths.prdFile, loadPRD, logFile],
	);

	// Handle iteration cancel
	const handleIterationCancel = useCallback(() => {
		exit();
	}, [exit]);

	// Handle stop after iteration
	const handleStopAfterIteration = useCallback(() => {
		if (isRunning && !isStopping) {
			setIsStopping(true);
			abortControllerRef.current?.abort();
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

	if (view === 'running' || view === 'complete') {
		return (
			<Box flexDirection="column" height="100%">
				<MainLayout
					stories={stories}
					currentStoryId={currentStoryId}
					activeTab={activeTab}
					outputLines={outputLines}
					progressFilePath={paths.progressFile}
					onTabChange={setActiveTab}
				/>
				{completionReason && (
					<Box paddingX={1} marginTop={1}>
						<Text
							color={
								completionReason === 'All stories passed!' ? 'green' : 'yellow'
							}
							bold
						>
							{completionReason}
						</Text>
					</Box>
				)}
				<KeyboardHelpFooter isRunning={isRunning} isStopping={isStopping} />
			</Box>
		);
	}

	return null;
}
