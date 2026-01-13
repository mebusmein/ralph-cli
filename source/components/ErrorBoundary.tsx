import React from 'react';
import {Text, Box, useInput, useApp} from 'ink';

type ErrorDisplayProps = {
	error: Error;
	errorInfo?: React.ErrorInfo;
	onRetry?: () => void;
	onExit?: () => void;
};

/**
 * Presentational component for displaying errors with retry/exit options
 */
export function ErrorDisplay({
	error,
	errorInfo,
	onRetry,
	onExit,
}: ErrorDisplayProps) {
	const {exit} = useApp();

	useInput((input, key) => {
		if (input.toLowerCase() === 'r' && onRetry) {
			onRetry();
		} else if (input.toLowerCase() === 'q' || key.escape) {
			if (onExit) {
				onExit();
			} else {
				exit();
			}
		}
	});

	return (
		<Box flexDirection="column" padding={1}>
			<Text color="red" bold>
				An error occurred
			</Text>
			<Text> </Text>
			<Box flexDirection="column" marginLeft={2}>
				<Text color="red">{error.message}</Text>
				{errorInfo?.componentStack && (
					<Box marginTop={1} flexDirection="column">
						<Text color="gray" dimColor>
							Component stack:
						</Text>
						<Text color="gray" dimColor>
							{errorInfo.componentStack.split('\n').slice(0, 5).join('\n')}
						</Text>
					</Box>
				)}
			</Box>
			<Text> </Text>
			<Box>
				{onRetry && <Text color="gray">Press R to retry, </Text>}
				<Text color="gray">Q to quit</Text>
			</Box>
		</Box>
	);
}

type ErrorBoundaryState = {
	hasError: boolean;
	error: Error | null;
	errorInfo: React.ErrorInfo | null;
};

type ErrorBoundaryProps = {
	children: React.ReactNode;
	onRetry?: () => void;
	onExit?: () => void;
	fallback?: React.ReactNode;
};

/**
 * Error boundary component that catches React errors and displays an error UI.
 * This must be a class component because error boundaries require componentDidCatch
 * and getDerivedStateFromError lifecycle methods.
 */
export class ErrorBoundary extends React.Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = {
			hasError: false,
			error: null,
			errorInfo: null,
		};
	}

	static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
		return {
			hasError: true,
			error,
		};
	}

	override componentDidCatch(_error: Error, errorInfo: React.ErrorInfo): void {
		this.setState({
			errorInfo,
		});
	}

	handleRetry = () => {
		this.setState({
			hasError: false,
			error: null,
			errorInfo: null,
		});
		this.props.onRetry?.();
	};

	override render() {
		const {hasError, error, errorInfo} = this.state;
		const {children, fallback, onExit} = this.props;

		if (hasError && error) {
			if (fallback) {
				return fallback;
			}

			return (
				<ErrorDisplay
					error={error}
					errorInfo={errorInfo ?? undefined}
					onRetry={this.props.onRetry ? this.handleRetry : undefined}
					onExit={onExit}
				/>
			);
		}

		return children;
	}
}

export default ErrorBoundary;
