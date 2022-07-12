/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { KeyCode } from 'vs/base/common/keyCodes';
import { ChordKeybinding, SimpleKeybinding } from 'vs/base/common/keybindings';
import { OperatingSystem } from 'vs/base/common/platform';
import { organizeImportsCommandId, refactorCommandId } from 'vs/editor/contrib/codeAction/codeAction';
import { CodeActionKeybindingResolver } from 'vs/editor/contrib/codeAction/codeActionMenu';
import { CodeActionKind } from 'vs/editor/contrib/codeAction/types';
import { ResolvedKeybindingItem } from 'vs/platform/keybinding/common/resolvedKeybindingItem';
import { USLayoutResolvedKeybinding } from 'vs/platform/keybinding/common/usLayoutResolvedKeybinding';

suite('CodeActionKeybindingResolver', () => {
	const refactorKeybinding = createCodeActionKeybinding(
		KeyCode.KeyA,
		refactorCommandId,
		{ kind: CodeActionKind.Refactor.value });

	const refactorExtractKeybinding = createCodeActionKeybinding(
		KeyCode.KeyB,
		refactorCommandId,
		{ kind: CodeActionKind.Refactor.append('extract').value });

	const organizeImportsKeybinding = createCodeActionKeybinding(
		KeyCode.KeyC,
		organizeImportsCommandId,
		undefined);

	test('Should match refactor keybindings', async function () {
		const resolver = new CodeActionKeybindingResolver({
			getKeybindings: (): readonly ResolvedKeybindingItem[] => {
				return [refactorKeybinding];
			},
		}).getResolver();

		assert.strictEqual(
			resolver({ title: '' }),
			undefined);

		assert.strictEqual(
			resolver({ title: '', kind: CodeActionKind.Refactor.value }),
			refactorKeybinding.resolvedKeybinding);

		assert.strictEqual(
			resolver({ title: '', kind: CodeActionKind.Refactor.append('extract').value }),
			refactorKeybinding.resolvedKeybinding);

		assert.strictEqual(
			resolver({ title: '', kind: CodeActionKind.QuickFix.value }),
			undefined);
	});

	test('Should prefer most specific keybinding', async function () {
		const resolver = new CodeActionKeybindingResolver({
			getKeybindings: (): readonly ResolvedKeybindingItem[] => {
				return [refactorKeybinding, refactorExtractKeybinding, organizeImportsKeybinding];
			},
		}).getResolver();

		assert.strictEqual(
			resolver({ title: '', kind: CodeActionKind.Refactor.value }),
			refactorKeybinding.resolvedKeybinding);

		assert.strictEqual(
			resolver({ title: '', kind: CodeActionKind.Refactor.append('extract').value }),
			refactorExtractKeybinding.resolvedKeybinding);
	});

	test('Organize imports should still return a keybinding even though it does not have args', async function () {
		const resolver = new CodeActionKeybindingResolver({
			getKeybindings: (): readonly ResolvedKeybindingItem[] => {
				return [refactorKeybinding, refactorExtractKeybinding, organizeImportsKeybinding];
			},
		}).getResolver();

		assert.strictEqual(
			resolver({ title: '', kind: CodeActionKind.SourceOrganizeImports.value }),
			organizeImportsKeybinding.resolvedKeybinding);
	});
});

function createCodeActionKeybinding(keycode: KeyCode, command: string, commandArgs: any) {
	return new ResolvedKeybindingItem(
		new USLayoutResolvedKeybinding(
			new ChordKeybinding([new SimpleKeybinding(false, true, false, false, keycode)]),
			OperatingSystem.Linux),
		command,
		commandArgs,
		undefined,
		false,
		null,
		false);
}

