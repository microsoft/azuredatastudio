/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as vscode from 'vscode';
import { asPromise, assertNoRpc, closeAllEditors } from '../utils';

suite('vscode - untitled automatic language detection', () => {

	teardown(async function () {
		assertNoRpc();
		await closeAllEditors();
	});

	test('test automatic language detection works', async () => {
		const doc = await vscode.workspace.openTextDocument();
		const editor = await vscode.window.showTextDocument(doc);

		assert.strictEqual(editor.document.languageId, 'plaintext');

		const settingResult = vscode.workspace.getConfiguration().get<boolean>('workbench.editor.languageDetection');
		assert.ok(settingResult);

		const result = await editor.edit(editBuilder => {
			editBuilder.insert(new vscode.Position(0, 0), `{
	"extends": "./tsconfig.base.json",
	"compilerOptions": {
		"removeComments": false,
		"preserveConstEnums": true,
		"sourceMap": false,
		"outDir": "../out/vs",
		"target": "es2020",
		"types": [
			"keytar",
			"mocha",
			"semver",
			"sinon",
			"winreg",
			"trusted-types",
			"wicg-file-system-access"
		],
		"plugins": [
			{
				"name": "tsec",
				"exemptionConfig": "./tsec.exemptions.json"
			}
		]
	},
	"include": [
		"./typings",
		"./vs"
	]
}`);
		});

		assert.ok(result);

		// Changing the language triggers a file to be closed and opened again so wait for that event to happen.
		const newDoc = await asPromise(vscode.workspace.onDidOpenTextDocument, 5000);

		assert.strictEqual(newDoc.languageId, 'json');
	});
});
