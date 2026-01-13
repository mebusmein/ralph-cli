import {useInput, useApp} from 'ink';
import type {TabId} from '../components/TabPanel.js';

export type KeyboardCallbacks = {
	onTabChange?: (tab: TabId) => void;
	onStopAfterIteration?: () => void;
	onImmediateCancel?: () => void;
};

type Options = {
	activeTab: TabId;
	enabled?: boolean;
};

/**
 * Hook for handling keyboard controls in the main application view.
 *
 * Keybindings:
 * - Tab: Switch between Output/Progress tabs
 * - Ctrl+C: Cancel immediately
 * - Ctrl+X or 'q': Stop after current iteration completes
 */
export function useKeyboardControls(
	callbacks: KeyboardCallbacks,
	options: Options,
): void {
	const {exit} = useApp();
	const {activeTab, enabled = true} = options;

	useInput(
		(input, key) => {
			// Tab key: switch between tabs
			if (key.tab) {
				const newTab: TabId = activeTab === 'output' ? 'progress' : 'output';
				callbacks.onTabChange?.(newTab);
				return;
			}

			// Ctrl+C: immediate cancel (handled by Ink by default, but we can add custom logic)
			if (key.ctrl && input === 'c') {
				callbacks.onImmediateCancel?.();
				exit();
				return;
			}

			// Ctrl+X or 'q': stop after current iteration
			if ((key.ctrl && input === 'x') || input === 'q') {
				callbacks.onStopAfterIteration?.();
				return;
			}
		},
		{isActive: enabled},
	);
}

/**
 * Help text for keyboard controls, to be displayed in a footer.
 */
export const KEYBOARD_HELP = {
	tabSwitch: 'Tab: switch tabs',
	stopGraceful: 'q/Ctrl+X: stop after iteration',
	cancelImmediate: 'Ctrl+C: cancel now',
};

/**
 * Get formatted help text for display in a footer.
 */
export function getKeyboardHelpText(): string {
	return `${KEYBOARD_HELP.tabSwitch} | ${KEYBOARD_HELP.stopGraceful} | ${KEYBOARD_HELP.cancelImmediate}`;
}
