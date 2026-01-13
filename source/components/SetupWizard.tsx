import React, {useState, useEffect, useCallback} from 'react';
import {Text, Box, useInput, useApp} from 'ink';
import {checkSetup} from '../utils/setup-checker.js';
import {
	createRalphDirectory,
	createPromptTemplate,
	createPrdTemplate,
	createProgressTemplate,
	installRalphPlanSkill,
	type ScaffoldResult,
} from '../utils/setup-scaffolding.js';
import type {SetupCheckItem, SetupCheckResult} from '../types/index.js';

type SetupStep = 'checking' | 'prompt' | 'scaffolding' | 'complete' | 'error';

type ScaffoldingStatus = {
	ralphDir?: ScaffoldResult;
	promptFile?: ScaffoldResult;
	prdFile?: ScaffoldResult;
	progressFile?: ScaffoldResult;
	ralphPlanSkill?: ScaffoldResult;
};

type Props = {
	cwd?: string;
	onComplete: (hasPrd: boolean) => void;
};

function StatusIcon({exists}: {exists: boolean}) {
	return exists ? <Text color="green">[*]</Text> : <Text color="red">[ ]</Text>;
}

function ScaffoldStatusIcon({result}: {result?: ScaffoldResult}) {
	if (!result) {
		return <Text color="gray">[.]</Text>;
	}

	if (!result.success) {
		return <Text color="red">[X]</Text>;
	}

	if (result.created) {
		return <Text color="green">[+]</Text>;
	}

	return <Text color="yellow">[=]</Text>;
}

function ChecklistItem({item}: {item: SetupCheckItem}) {
	return (
		<Box>
			<StatusIcon exists={item.exists} />
			<Text> {item.name}</Text>
		</Box>
	);
}

function ScaffoldItem({name, result}: {name: string; result?: ScaffoldResult}) {
	let statusText = '';
	if (result) {
		if (!result.success) {
			statusText = ` - Error: ${result.error}`;
		} else if (result.created) {
			statusText = ' - Created';
		} else {
			statusText = ' - Already exists';
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

export default function SetupWizard({cwd = process.cwd(), onComplete}: Props) {
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
			// All setup is complete, check if PRD has stories
			setStep('complete');
		} else {
			// Need to prompt for setup
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

			const prdFile = createPrdTemplate(cwd);
			setScaffoldStatus(prev => ({...prev, prdFile}));

			const progressFile = createProgressTemplate(cwd);
			setScaffoldStatus(prev => ({...prev, progressFile}));

			const ralphPlanSkill = installRalphPlanSkill(cwd);
			setScaffoldStatus(prev => ({...prev, ralphPlanSkill}));

			// Check if all succeeded
			const allSuccess =
				ralphDir.success &&
				promptFile.success &&
				prdFile.success &&
				progressFile.success &&
				ralphPlanSkill.success;

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
				// Check if prd.json exists and has stories
				const result = checkSetup(cwd);
				const prdItem = result.items.find(item => item.name === 'prd.json');
				onComplete(prdItem?.exists ?? false);
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
				<Box flexDirection="column" marginLeft={2} marginY={1}>
					<ScaffoldItem
						name=".ralph directory"
						result={scaffoldStatus.ralphDir}
					/>
					<ScaffoldItem name="prompt.txt" result={scaffoldStatus.promptFile} />
					<ScaffoldItem name="prd.json" result={scaffoldStatus.prdFile} />
					<ScaffoldItem
						name="progress.txt"
						result={scaffoldStatus.progressFile}
					/>
					<ScaffoldItem
						name="ralph-plan skill"
						result={scaffoldStatus.ralphPlanSkill}
					/>
				</Box>
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
						<Box flexDirection="column" marginLeft={2} marginY={1}>
							<ScaffoldItem
								name=".ralph directory"
								result={scaffoldStatus.ralphDir}
							/>
							<ScaffoldItem
								name="prompt.txt"
								result={scaffoldStatus.promptFile}
							/>
							<ScaffoldItem name="prd.json" result={scaffoldStatus.prdFile} />
							<ScaffoldItem
								name="progress.txt"
								result={scaffoldStatus.progressFile}
							/>
							<ScaffoldItem
								name="ralph-plan skill"
								result={scaffoldStatus.ralphPlanSkill}
							/>
						</Box>
						<Text> </Text>
						<Text>Next steps:</Text>
						<Text color="gray">
							1. Run /ralph-plan to create user stories in .ralph/prd.json
						</Text>
						<Text color="gray">2. Create a feature branch</Text>
						<Text color="gray">3. Run ralph-cli to start iterating</Text>
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
				<Box flexDirection="column" marginLeft={2} marginY={1}>
					<ScaffoldItem
						name=".ralph directory"
						result={scaffoldStatus.ralphDir}
					/>
					<ScaffoldItem name="prompt.txt" result={scaffoldStatus.promptFile} />
					<ScaffoldItem name="prd.json" result={scaffoldStatus.prdFile} />
					<ScaffoldItem
						name="progress.txt"
						result={scaffoldStatus.progressFile}
					/>
					<ScaffoldItem
						name="ralph-plan skill"
						result={scaffoldStatus.ralphPlanSkill}
					/>
				</Box>
				<Text> </Text>
				<Text color="gray">Press Enter to exit</Text>
			</Box>
		);
	}

	return null;
}
