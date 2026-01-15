import {useInput, useApp} from 'ink';
import type {TabId} from '../components/TabPanel.js';

export type KeyboardCallbacks = {
	onTabChange?: (tab: TabId) => void;
	onStopAfterIteration?: () => void;
	onImmediateCancel?: () => void;
	onBackToTicketSelect?: () => void;
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
 * - 'b': Go back to ticket selection
 */
export function useKeyboardControls(
	callbacks: KeyboardCallbacks,
	options: Options,
): void {
	const {exit} = useApp();
	const {activeTab, enabled = true} = options;

	useInput(
		(input, key) => {
			// Tab key: cycle through tabs (output -> progress -> ticket -> output)
			if (key.tab) {
				const tabOrder: TabId[] = ['output', 'progress', 'ticket'];
				const currentIndex = tabOrder.indexOf(activeTab);
				const nextIndex = (currentIndex + 1) % tabOrder.length;
				callbacks.onTabChange?.(tabOrder[nextIndex]!);
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

			// 'b': go back to ticket selection
			if (input === 'b') {
				callbacks.onBackToTicketSelect?.();
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
	backToTickets: 'b: back to tickets',
};
