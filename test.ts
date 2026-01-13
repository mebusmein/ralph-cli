import test from 'ava';
import {readPRDFile} from './source/lib/prd-reader.js';
import {findNextIncompleteStory} from './source/lib/iteration-executor.js';
import type {UserStory} from './source/types/prd.js';

test('readPRDFile returns file_not_found for missing file', t => {
	const result = readPRDFile('/nonexistent/path/prd.json');
	t.false(result.success);
	if (!result.success) {
		t.is(result.error.type, 'file_not_found');
	}
});

test('findNextIncompleteStory returns first incomplete story by priority', t => {
	const stories: UserStory[] = [
		{
			id: 'US-003',
			title: 'Third story',
			acceptanceCriteria: [],
			priority: 3,
			passes: false,
			notes: '',
		},
		{
			id: 'US-001',
			title: 'First story',
			acceptanceCriteria: [],
			priority: 1,
			passes: true,
			notes: '',
		},
		{
			id: 'US-002',
			title: 'Second story',
			acceptanceCriteria: [],
			priority: 2,
			passes: false,
			notes: '',
		},
	];

	const next = findNextIncompleteStory(stories);
	t.is(next?.id, 'US-002');
});

test('findNextIncompleteStory returns undefined when all stories pass', t => {
	const stories: UserStory[] = [
		{
			id: 'US-001',
			title: 'First story',
			acceptanceCriteria: [],
			priority: 1,
			passes: true,
			notes: '',
		},
		{
			id: 'US-002',
			title: 'Second story',
			acceptanceCriteria: [],
			priority: 2,
			passes: true,
			notes: '',
		},
	];

	const next = findNextIncompleteStory(stories);
	t.is(next, undefined);
});
