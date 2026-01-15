import React, {useState, useEffect, useCallback} from 'react';
import {Text, Box, useInput, useApp} from 'ink';
import {checkSetup} from '../utils/setup-checker.js';
import {
	createRalphDirectory,
	createPromptTemplate,
	createProgressTemplate,
	initializeBeads,
	type ScaffoldResult,
	type BeadsInitResult,
} from '../utils/setup-scaffolding.js';
import type {SetupCheckItem, SetupCheckResult} from '../types/index.js';

type SetupStep = 'checking' | 'prompt' | 'scaffolding' | 'complete' | 'error';

type ScaffoldingStatus = {
	ralphDir?: ScaffoldResult;
	promptFile?: ScaffoldResult;
	progressFile?: ScaffoldResult;
	beads?: BeadsInitResult;
};

type Props = {
	cwd?: string;
	onComplete: (hasPrd: boolean) => void;
};

/**
 * Configuration for scaffold items to display
 */
const SCAFFOLD_ITEMS: Array<{key: keyof ScaffoldingStatus; name: string}> = [
	{key: 'ralphDir', name: '.ralph directory'},
	{key: 'promptFile', name: 'prompt.txt'},
	{key: 'progressFile', name: 'progress.txt'},
	{key: 'beads', name: '.beads (issue tracker)'},
];

function StatusIcon({exists}: {exists: boolean}): React.ReactElement {
	if (exists) {
		return <Text color="green">[*]</Text>;
	}
	return <Text color="red">[ ]</Text>;
}

/**
 * Type guard to check if result is a ScaffoldResult
 */
function isScaffoldResult(
	result: ScaffoldResult | BeadsInitResult,
): result is ScaffoldResult {
	return 'created' in result;
}

/**
 * Type guard to check if result is a BeadsInitResult
 */
function isBeadsInitResult(
	result: ScaffoldResult | BeadsInitResult,
): result is BeadsInitResult {
	return 'initialized' in result;
}

function ScaffoldStatusIcon({
	result,
}: {
	result?: ScaffoldResult | BeadsInitResult;
}): React.ReactElement {
	if (!result) {
		return <Text color="gray">[.]</Text>;
	}

	if (!result.success) {
		return <Text color="red">[X]</Text>;
	}

	// Handle ScaffoldResult
	if (isScaffoldResult(result)) {
		if (result.created) {
			return <Text color="green">[+]</Text>;
		}
		return <Text color="yellow">[=]</Text>;
	}

	// Handle BeadsInitResult
	if (isBeadsInitResult(result)) {
		if (result.initialized) {
			return <Text color="green">[+]</Text>;
		}
		if (result.alreadyInitialized) {
			return <Text color="yellow">[=]</Text>;
		}
	}

	return <Text color="yellow">[=]</Text>;
}

function ChecklistItem({item}: {item: SetupCheckItem}): React.ReactElement {
	return (
		<Box>
			<StatusIcon exists={item.exists} />
			<Text> {item.name}</Text>
		</Box>
	);
}

function ScaffoldItem({
	name,
	result,
}: {
	name: string;
	result?: ScaffoldResult | BeadsInitResult;
}): React.ReactElement {
	let statusText = '';
	if (result) {
		if (!result.success) {
			statusText = ` - Error: ${result.error}`;
		} else if (isScaffoldResult(result)) {
			statusText = result.created ? ' - Created' : ' - Already exists';
		} else if (isBeadsInitResult(result)) {
			if (result.initialized) {
				statusText = ' - Initialized';
			} else if (result.alreadyInitialized) {
				statusText = ' - Already initialized';
			}
		}
	}

	return (
		<Box>
			<ScaffoldStatusIcon result={result} />
			<Text> {name}</Text>
			{statusText && (
				<Text color={result?.success ? 'gray' : 'red'}>{statusText}</Text>
			)}
		</Box>
	);
}

function ScaffoldItemList({
	status,
}: {
	status: ScaffoldingStatus;
}): React.ReactElement {
	return (
		<Box flexDirection="column" marginLeft={2} marginY={1}>
			{SCAFFOLD_ITEMS.map(({key, name}) => (
				<ScaffoldItem key={key} name={name} result={status[key]} />
			))}
		</Box>
	);
}

export default function SetupWizard({
	cwd = process.cwd(),
	onComplete,
}: Props): React.ReactElement | null {
	const {exit} = useApp();
	const [step, setStep] = useState<SetupStep>('checking');
	const [checkResult, setCheckResult] = useState<SetupCheckResult | null>(null);
	const [scaffoldStatus, setScaffoldStatus] = useState<ScaffoldingStatus>({});
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	// Run initial check
	useEffect(() => {
		const result = checkSetup(cwd);
		setCheckResult(result);

		if (result.isComplete) {
			setStep('complete');
		} else {
			setStep('prompt');
		}
	}, [cwd]);

	const runScaffolding = useCallback(() => {
		setStep('scaffolding');

		try {
			// Run each scaffolding step and update status
			const ralphDir = createRalphDirectory(cwd);
			setScaffoldStatus(prev => ({...prev, ralphDir}));

			const promptFile = createPromptTemplate(cwd);
			setScaffoldStatus(prev => ({...prev, promptFile}));

			const progressFile = createProgressTemplate(cwd);
			setScaffoldStatus(prev => ({...prev, progressFile}));

			// Initialize beads issue tracker
			const beads = initializeBeads(cwd);
			setScaffoldStatus(prev => ({...prev, beads}));

			// Check if all succeeded
			const allSuccess =
				ralphDir.success &&
				promptFile.success &&
				progressFile.success &&
				beads.success;

			if (allSuccess) {
				setStep('complete');
			} else {
				setStep('error');
				setErrorMessage('Some setup steps failed. See details above.');
			}
		} catch (error) {
			setStep('error');
			setErrorMessage(
				error instanceof Error ? error.message : 'Unknown error occurred',
			);
		}
	}, [cwd]);

	useInput((input, key) => {
		if (step === 'prompt') {
			if (input.toLowerCase() === 'y') {
				runScaffolding();
			} else if (input.toLowerCase() === 'n' || key.escape) {
				exit();
			}
		} else if (step === 'complete') {
			if (key.return || input.toLowerCase() === 'c') {
				const result = checkSetup(cwd);
				// Pass true if beads is initialized (replaces prd.json check)
				onComplete(result.isBeadsInitialized);
			} else if (key.escape || input.toLowerCase() === 'q') {
				exit();
			}
		} else if (step === 'error') {
			if (key.return || key.escape) {
				exit();
			}
		}
	});

	// Render based on current step
	if (step === 'checking') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan">Ralph Setup Wizard</Text>
				<Text color="gray">Checking setup status...</Text>
			</Box>
		);
	}

	if (step === 'prompt' && checkResult) {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Ralph Setup Wizard
				</Text>
				<Text> </Text>
				<Text>Current setup status:</Text>
				<Box flexDirection="column" marginLeft={2} marginY={1}>
					{checkResult.items.map(item => (
						<ChecklistItem key={item.name} item={item} />
					))}
				</Box>
				<Text> </Text>
				<Text>
					Some required files are missing. Would you like to create them?
				</Text>
				<Text color="gray">Press Y to continue, N to exit</Text>
			</Box>
		);
	}

	if (step === 'scaffolding') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Ralph Setup Wizard
				</Text>
				<Text> </Text>
				<Text>Setting up Ralph...</Text>
				<ScaffoldItemList status={scaffoldStatus} />
			</Box>
		);
	}

	if (step === 'complete') {
		const wasSetupRun = Object.keys(scaffoldStatus).length > 0;
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Ralph Setup Wizard
				</Text>
				<Text> </Text>
				{wasSetupRun ? (
					<>
						<Text color="green">Setup complete!</Text>
						<ScaffoldItemList status={scaffoldStatus} />
						<Text> </Text>
						<Text>Next steps:</Text>
						<Text color="gray">
							1. Use beads to create an epic with tasks (bd create --type=epic)
						</Text>
						<Text color="gray">
							2. Run ralph-cli to select an epic and start
						</Text>
					</>
				) : (
					<Text color="green">All setup items are present!</Text>
				)}
				<Text> </Text>
				<Text color="gray">Press C to continue, Q to quit</Text>
			</Box>
		);
	}

	if (step === 'error') {
		return (
			<Box flexDirection="column" padding={1}>
				<Text color="cyan" bold>
					Ralph Setup Wizard
				</Text>
				<Text> </Text>
				<Text color="red">Setup failed!</Text>
				{errorMessage && <Text color="red">{errorMessage}</Text>}
				<ScaffoldItemList status={scaffoldStatus} />
				<Text> </Text>
				<Text color="gray">Press Enter to exit</Text>
			</Box>
		);
	}

	return null;
}
