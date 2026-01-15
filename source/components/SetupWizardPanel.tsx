import React from 'react';
import {Text, Box} from 'ink';
import type {SetupCheckItem, SetupCheckResult} from '../types/index.js';
import type {SetupPhase} from '../types/state.js';
import type {
	ScaffoldResult,
	BeadsInitResult,
} from '../utils/setup-scaffolding.js';

/**
 * Scaffolding status for display
 */
export type ScaffoldingStatus = {
	ralphDir?: ScaffoldResult;
	promptFile?: ScaffoldResult;
	progressFile?: ScaffoldResult;
	beads?: BeadsInitResult;
};

type Props = {
	/** Current setup phase */
	phase: SetupPhase;
	/** Result of setup check (for 'prompt' step) */
	checkResult?: SetupCheckResult | null;
	/** Status of scaffolding operations */
	scaffoldStatus?: ScaffoldingStatus;
	/** Error message (for 'error' step) */
	errorMessage?: string | null;
	/** Width of the content area */
	contentWidth?: number;
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

/**
 * SetupWizardPanel - Pure presentation component for setup wizard
 * Displays the current setup state in a panel format suitable for the unified layout
 */
export default function SetupWizardPanel({
	phase,
	checkResult,
	scaffoldStatus = {},
	errorMessage,
	contentWidth,
}: Props): React.ReactElement {
	// Checking phase
	if (phase === 'checking') {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="gray"
				paddingX={1}
				width={contentWidth}
			>
				<Text bold color="cyan">
					Ralph Setup Wizard
				</Text>
				<Text color="gray">Checking setup status...</Text>
			</Box>
		);
	}

	// Prompt phase - show setup status and prompt
	if (phase === 'prompt' && checkResult) {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="gray"
				paddingX={1}
				width={contentWidth}
			>
				<Text bold color="cyan">
					Ralph Setup Wizard
				</Text>
				<Box marginTop={1}>
					<Text>Current setup status:</Text>
				</Box>
				<Box flexDirection="column" marginLeft={2} marginY={1}>
					{checkResult.items.map(item => (
						<ChecklistItem key={item.name} item={item} />
					))}
				</Box>
				<Box marginTop={1}>
					<Text>
						Some required files are missing. Would you like to create them?
					</Text>
				</Box>
				<Text color="gray">Press Y to continue, N to exit</Text>
			</Box>
		);
	}

	// Scaffolding phase - show progress
	if (phase === 'scaffolding') {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="gray"
				paddingX={1}
				width={contentWidth}
			>
				<Text bold color="cyan">
					Ralph Setup Wizard
				</Text>
				<Box marginTop={1}>
					<Text>Setting up Ralph...</Text>
				</Box>
				<ScaffoldItemList status={scaffoldStatus} />
			</Box>
		);
	}

	// Complete phase
	if (phase === 'complete') {
		const wasSetupRun = Object.keys(scaffoldStatus).length > 0;
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="gray"
				paddingX={1}
				width={contentWidth}
			>
				<Text bold color="cyan">
					Ralph Setup Wizard
				</Text>
				<Box marginTop={1}>
					{wasSetupRun ? (
						<Box flexDirection="column">
							<Text color="green">Setup complete!</Text>
							<ScaffoldItemList status={scaffoldStatus} />
							<Box marginTop={1} flexDirection="column">
								<Text>Next steps:</Text>
								<Text color="gray">
									1. Use beads to create an epic with tasks (bd create
									--type=epic)
								</Text>
								<Text color="gray">
									2. Run ralph-cli to select an epic and start
								</Text>
							</Box>
						</Box>
					) : (
						<Text color="green">All setup items are present!</Text>
					)}
				</Box>
				<Box marginTop={1}>
					<Text color="gray">Press C to continue, Q to quit</Text>
				</Box>
			</Box>
		);
	}

	// Error phase
	if (phase === 'error') {
		return (
			<Box
				flexDirection="column"
				borderStyle="round"
				borderColor="gray"
				paddingX={1}
				width={contentWidth}
			>
				<Text bold color="cyan">
					Ralph Setup Wizard
				</Text>
				<Box marginTop={1}>
					<Text color="red">Setup failed!</Text>
				</Box>
				{errorMessage && <Text color="red">{errorMessage}</Text>}
				<ScaffoldItemList status={scaffoldStatus} />
				<Box marginTop={1}>
					<Text color="gray">Press Enter to exit</Text>
				</Box>
			</Box>
		);
	}

	// Fallback - should not reach here
	return (
		<Box
			flexDirection="column"
			borderStyle="round"
			borderColor="gray"
			paddingX={1}
			width={contentWidth}
		>
			<Text color="gray">Loading...</Text>
		</Box>
	);
}
