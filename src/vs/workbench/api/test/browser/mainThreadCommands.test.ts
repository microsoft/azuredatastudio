/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { MainThreadCommands } from 'vs/workbench/api/browser/mainThreadCommands';
import { CommandsRegistry, ICommandService } from 'vs/platform/commands/common/commands';
import { SingleProxyRPCProtocol } from 'vs/workbench/api/test/common/testRPCProtocol';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { mock } from 'vs/base/test/common/mock';

suite('MainThreadCommands', function () {

	test('dispose on unregister', function () {

		const commands = new MainThreadCommands(SingleProxyRPCProtocol(null), undefined!, new class extends mock<IExtensionService>() { });
		assert.strictEqual(CommandsRegistry.getCommand('foo'), undefined);

		// register
		commands.$registerCommand('foo');
		assert.ok(CommandsRegistry.getCommand('foo'));

		// unregister
		commands.$unregisterCommand('foo');
		assert.strictEqual(CommandsRegistry.getCommand('foo'), undefined);
	});

	test('unregister all on dispose', function () {

		const commands = new MainThreadCommands(SingleProxyRPCProtocol(null), undefined!, new class extends mock<IExtensionService>() { });
		assert.strictEqual(CommandsRegistry.getCommand('foo'), undefined);

		commands.$registerCommand('foo');
		commands.$registerCommand('bar');

		assert.ok(CommandsRegistry.getCommand('foo'));
		assert.ok(CommandsRegistry.getCommand('bar'));

		commands.dispose();

		assert.strictEqual(CommandsRegistry.getCommand('foo'), undefined);
		assert.strictEqual(CommandsRegistry.getCommand('bar'), undefined);
	});

	test('activate and throw when needed', async function () {

		const activations: string[] = [];
		const runs: string[] = [];

		const commands = new MainThreadCommands(
			SingleProxyRPCProtocol(null),
			new class extends mock<ICommandService>() {
				override executeCommand<T>(id: string): Promise<T | undefined> {
					runs.push(id);
					return Promise.resolve(undefined);
				}
			},
			new class extends mock<IExtensionService>() {
				override activateByEvent(id: string) {
					activations.push(id);
					return Promise.resolve();
				}
			}
		);

		// case 1: arguments and retry
		try {
			activations.length = 0;
			await commands.$executeCommand('bazz', [1, 2, { n: 3 }], true);
			assert.ok(false);
		} catch (e) {
			assert.deepStrictEqual(activations, ['onCommand:bazz']);
			assert.strictEqual((<Error>e).message, '$executeCommand:retry');
		}

		// case 2: no arguments and retry
		runs.length = 0;
		await commands.$executeCommand('bazz', [], true);
		assert.deepStrictEqual(runs, ['bazz']);

		// case 3: arguments and no retry
		runs.length = 0;
		await commands.$executeCommand('bazz', [1, 2, true], false);
		assert.deepStrictEqual(runs, ['bazz']);
	});
});
