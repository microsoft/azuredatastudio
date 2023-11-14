/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { formatOptions, Option, OptionDescriptions, Subcommand, parseArgs, ErrorReporter } from 'vs/platform/environment/node/argv';
import { addArg } from 'vs/platform/environment/node/argvHelper';

function o(description: string, type: 'boolean' | 'string' | 'string[]' = 'string'): Option<any> {
	return {
		description, type
	};
}
function c(description: string, options: OptionDescriptions<any>): Subcommand<any> {
	return {
		description, type: 'subcommand', options
	};
}

suite('formatOptions', () => {

	test('Text should display small columns correctly', () => {
		assert.deepStrictEqual(
			formatOptions({
				'add': o('bar')
			}, 80),
			['  --add        bar']
		);
		assert.deepStrictEqual(
			formatOptions({
				'add': o('bar'),
				'wait': o('ba'),
				'trace': o('b')
			}, 80),
			[
				'  --add        bar',
				'  --wait       ba',
				'  --trace      b'
			]);
	});

	test('Text should wrap', () => {
		assert.deepStrictEqual(
			formatOptions({
				'add': o((<any>'bar ').repeat(9))
			}, 40),
			[
				'  --add        bar bar bar bar bar bar',
				'               bar bar bar'
			]);
	});

	test('Text should revert to the condensed view when the terminal is too narrow', () => {
		assert.deepStrictEqual(
			formatOptions({
				'add': o((<any>'bar ').repeat(9))
			}, 30),
			[
				'  --add',
				'      bar bar bar bar bar bar bar bar bar '
			]);
	});

	test('addArg', () => {
		assert.deepStrictEqual(addArg([], 'foo'), ['foo']);
		assert.deepStrictEqual(addArg([], 'foo', 'bar'), ['foo', 'bar']);
		assert.deepStrictEqual(addArg(['foo'], 'bar'), ['foo', 'bar']);
		assert.deepStrictEqual(addArg(['--wait'], 'bar'), ['--wait', 'bar']);
		assert.deepStrictEqual(addArg(['--wait', '--', '--foo'], 'bar'), ['--wait', 'bar', '--', '--foo']);
		assert.deepStrictEqual(addArg(['--', '--foo'], 'bar'), ['bar', '--', '--foo']);
	});

	test('subcommands', () => {
		assert.deepStrictEqual(
			formatOptions({
				'testcmd': c('A test command', { add: o('A test command option') })
			}, 30),
			[
				'  --testcmd',
				'      A test command'
			]);
	});
});

suite('parseArgs', () => {
	function newErrorReporter(result: string[] = [], command = ''): ErrorReporter & { result: string[] } {
		const commandPrefix = command ? command + '-' : '';
		return {
			onDeprecatedOption: (deprecatedId) => result.push(`${commandPrefix}onDeprecatedOption ${deprecatedId}`),
			onUnknownOption: (id) => result.push(`${commandPrefix}onUnknownOption ${id}`),
			onEmptyValue: (id) => result.push(`${commandPrefix}onEmptyValue ${id}`),
			onMultipleValues: (id, usedValue) => result.push(`${commandPrefix}onMultipleValues ${id} ${usedValue}`),
			getSubcommandReporter: (c) => newErrorReporter(result, commandPrefix + c),
			result
		};
	}

	function assertParse<T>(options: OptionDescriptions<T>, input: string[], expected: T, expectedErrors: string[]) {
		const errorReporter = newErrorReporter();
		assert.deepStrictEqual(parseArgs(input, options, errorReporter), expected);
		assert.deepStrictEqual(errorReporter.result, expectedErrors);
	}

	test('subcommands', () => {

		interface TestArgs1 {
			testcmd?: {
				testArg?: string;
				_: string[];
			};
			_: string[];
		}

		const options1: OptionDescriptions<TestArgs1> = {
			'testcmd': c('A test command', {
				testArg: o('A test command option'),
				_: { type: 'string[]' }
			}),
			_: { type: 'string[]' }
		};
		assertParse(
			options1,
			['testcmd', '--testArg=foo'],
			{ testcmd: { testArg: 'foo', '_': [] }, '_': [] },
			[]
		);
		assertParse(
			options1,
			['testcmd', '--testArg=foo', '--testX'],
			{ testcmd: { testArg: 'foo', '_': [] }, '_': [] },
			['testcmd-onUnknownOption testX']
		);

		interface TestArgs2 {
			testcmd?: {
				testArg?: string;
				testX?: boolean;
				_: string[];
			};
			testX?: boolean;
			_: string[];
		}

		const options2: OptionDescriptions<TestArgs2> = {
			'testcmd': c('A test command', {
				testArg: o('A test command option')
			}),
			testX: { type: 'boolean', global: true, description: '' },
			_: { type: 'string[]' }
		};
		assertParse(
			options2,
			['testcmd', '--testArg=foo', '--testX'],
			{ testcmd: { testArg: 'foo', testX: true, '_': [] }, '_': [] },
			[]
		);
	});
});
