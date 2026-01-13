#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
	`
	Usage
	  $ ralph-cli [iterations]

	Options
		--help  Show help

	Examples
	  $ ralph-cli        # Interactive mode - prompts for iterations
	  $ ralph-cli 5      # Run 5 iterations directly
`,
	{
		importMeta: import.meta,
	},
);

// Parse positional argument for iterations
const iterations = cli.input[0] ? parseInt(cli.input[0], 10) : undefined;

render(<App initialIterations={iterations} />);
