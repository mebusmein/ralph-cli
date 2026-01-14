import test from 'ava';
import {readPRDFile} from './source/lib/prd-reader.js';
import {findNextIncompleteStory} from './source/lib/iteration-executor.js';
import {createStreamFormatter} from './source/lib/stream-formatter.js';
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

// Tests for stream formatter JSON validation fix (US-031)
test('createStreamFormatter ignores JSON content that looks like stream messages', t => {
	const formatter = createStreamFormatter();

	// Simulate a user message containing tool_result with JSON file content
	// The JSON file content happens to have a "type" field but isn't a valid StreamMessage
	const validMessage =
		'{"type":"assistant","message":{"content":[{"type":"text","text":"Let me read that file."}]}}';
	const invalidJsonWithType = '{"type":"assistant","version":"1.0"}'; // Missing required message.content
	const prdJsonContent = '{"branchName":"test","userStories":[]}'; // Not a StreamMessage at all

	// Valid message should be processed
	const result1 = formatter.processChunk(validMessage + '\n');
	t.is(result1.length, 1);
	t.is(result1[0]?.source, 'assistant');

	// Invalid JSON that has type field but wrong structure should be ignored
	const result2 = formatter.processChunk(invalidJsonWithType + '\n');
	// Should still just have the 1 message from before (invalid one was ignored)
	t.is(result2.length, 1);

	// PRD JSON content should be ignored (doesn't match StreamMessage structure)
	const result3 = formatter.processChunk(prdJsonContent + '\n');
	t.is(result3.length, 1);
});

test('createStreamFormatter correctly validates assistant message structure', t => {
	const formatter = createStreamFormatter();

	// Valid assistant message
	const valid =
		'{"type":"assistant","message":{"content":[{"type":"text","text":"Hello"}]}}';
	const result1 = formatter.processChunk(valid + '\n');
	t.is(result1.length, 1);

	// Invalid: missing message field
	const formatter2 = createStreamFormatter();
	const invalid1 = '{"type":"assistant"}';
	const result2 = formatter2.processChunk(invalid1 + '\n');
	t.is(result2.length, 0);

	// Invalid: message.content not an array
	const formatter3 = createStreamFormatter();
	const invalid2 = '{"type":"assistant","message":{"content":"string"}}';
	const result3 = formatter3.processChunk(invalid2 + '\n');
	t.is(result3.length, 0);
});

test('createStreamFormatter correctly validates user message structure', t => {
	const formatter = createStreamFormatter();

	// Valid user message
	const valid =
		'{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"123","content":"result"}]}}';
	const result1 = formatter.processChunk(valid + '\n');
	t.is(result1.length, 1);
	t.is(result1[0]?.source, 'user');

	// Invalid: missing message.content array
	const formatter2 = createStreamFormatter();
	const invalid = '{"type":"user","message":{}}';
	const result2 = formatter2.processChunk(invalid + '\n');
	t.is(result2.length, 0);
});
