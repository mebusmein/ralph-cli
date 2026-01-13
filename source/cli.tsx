#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const helpText = `
	Usage
	  $ ralph-cli [iterations]

	Options
	  --help, -h            Show this help message
	  --log-file, -l <path> Log raw JSON output to file

	Examples
	  $ ralph-cli        # Interactive mode - prompts for iterations
	  $ ralph-cli 5      # Run 5 iterations directly
	  $ ralph-cli 5 --log-file output.json  # Log raw output to file
`;

// Handle -h flag manually (meow's autoHelp only works with --help)
if (process.argv.includes('-h') || process.argv.includes('--help')) {
	console.log(helpText);
	process.exit(0);
}

const cli = meow(helpText, {
	importMeta: import.meta,
	autoHelp: false,
	flags: {
		logFile: {
			type: 'string',
			shortFlag: 'l',
		},
	},
});

// Parse positional argument for iterations
const iterationsArg = cli.input[0];
let iterations: number | undefined;

if (iterationsArg !== undefined) {
	const parsed = Number.parseInt(iterationsArg, 10);
	if (Number.isNaN(parsed) || parsed <= 0) {
		console.error(
			`Error: iterations must be a positive integer, got "${iterationsArg}"`,
		);
		process.exit(1);
	}

	iterations = parsed;
}

render(<App initialIterations={iterations} logFile={cli.flags.logFile} />);
