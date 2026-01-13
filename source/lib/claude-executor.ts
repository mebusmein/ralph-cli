import {spawn, type ChildProcess} from 'node:child_process';
import {createWriteStream, type WriteStream} from 'node:fs';
import type {ClaudeExecutionOptions} from '../types/config.js';

/**
 * Result of Claude execution
 */
export type ClaudeExecutionResult =
	| {success: true; exitCode: number}
	| {success: false; error: ClaudeExecutionError};

/**
 * Error types for Claude execution
 */
export type ClaudeExecutionError = {
	type: 'spawn_failed' | 'process_error' | 'aborted';
	message: string;
	exitCode?: number;
};

/**
 * Spawns and executes the Claude CLI with the given prompt
 *
 * @param options - Execution options including prompt, output callback, and abort signal
 * @returns Promise that resolves when the process completes
 */
export async function executeClaudeCommand(
	options: ClaudeExecutionOptions,
): Promise<ClaudeExecutionResult> {
	const {prompt, onOutput, signal, logFile} = options;

	return new Promise(resolve => {
		let childProcess: ChildProcess;
		let logStream: WriteStream | undefined;

		try {
			childProcess = spawn(
				'claude',
				[
					'--dangerously-skip-permissions',
					'--output-format',
					'stream-json',
					'--print',
					'--verbose',
					prompt,
				],
				{
					stdio: ['ignore', 'pipe', 'pipe'],
					shell: false,
				},
			);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : 'Unknown error';
			resolve({
				success: false,
				error: {
					type: 'spawn_failed',
					message: `Failed to spawn Claude process: ${errorMessage}`,
				},
			});
			return;
		}

		// Handle abort signal
		if (signal) {
			const abortHandler = () => {
				childProcess.kill('SIGTERM');
			};

			signal.addEventListener('abort', abortHandler, {once: true});

			// Clean up abort listener when process exits
			childProcess.once('exit', () => {
				signal.removeEventListener('abort', abortHandler);
			});

			// If already aborted, kill immediately
			if (signal.aborted) {
				childProcess.kill('SIGTERM');
				resolve({
					success: false,
					error: {
						type: 'aborted',
						message: 'Execution was aborted',
					},
				});
				return;
			}
		}

		// Create log stream if logFile is specified
		if (logFile) {
			logStream = createWriteStream(logFile, {flags: 'a'});
		}

		// Stream stdout to callback and log file
		if (childProcess.stdout) {
			childProcess.stdout.on('data', (data: Buffer) => {
				const dataStr = data.toString();
				if (onOutput) {
					onOutput(dataStr);
				}
				if (logStream) {
					logStream.write(data);
				}
			});
		}

		// Capture stderr for error reporting
		let stderrOutput = '';
		if (childProcess.stderr) {
			childProcess.stderr.on('data', (data: Buffer) => {
				stderrOutput += data.toString();
			});
		}

		// Handle process errors
		childProcess.on('error', (error: Error) => {
			resolve({
				success: false,
				error: {
					type: 'spawn_failed',
					message: `Claude process error: ${error.message}`,
				},
			});
		});

		// Handle process exit
		childProcess.on('exit', (code, sig) => {
			// Close log stream if open
			if (logStream) {
				logStream.end();
			}

			// Check if aborted via signal
			if (signal?.aborted) {
				resolve({
					success: false,
					error: {
						type: 'aborted',
						message: 'Execution was aborted',
					},
				});
				return;
			}

			// Check if killed by signal
			if (sig) {
				resolve({
					success: false,
					error: {
						type: 'process_error',
						message: `Claude process was killed by signal: ${sig}`,
					},
				});
				return;
			}

			const exitCode = code ?? 0;

			// Non-zero exit code indicates error
			if (exitCode !== 0) {
				resolve({
					success: false,
					error: {
						type: 'process_error',
						message:
							stderrOutput || `Claude process exited with code ${exitCode}`,
						exitCode,
					},
				});
				return;
			}

			resolve({
				success: true,
				exitCode,
			});
		});
	});
}
