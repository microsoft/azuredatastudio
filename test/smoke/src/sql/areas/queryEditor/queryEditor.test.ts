/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';
import * as minimist from 'minimist';
import { afterSuite, beforeSuite } from '../../../utils';

export function setup(opts: minimist.ParsedArgs) {
	describe('Query Editor', () => {
		setupCommonTests(opts);

		it.skip('can new file, connect and execute', async function () {
			const app = this.app as Application;
			await app.workbench.queryEditors.newUntitledQuery();
			const untitled = 'SQLQuery_1';
			await app.workbench.editor.waitForTypeInEditor(untitled, 'select * from employees');
			await app.workbench.queryEditor.commandBar.connect();
			await app.workbench.connectionDialog.waitForConnectionDialog();
			await app.workbench.connectionDialog.setProvider('Sqlite');
			await app.workbench.connectionDialog.setTarget('File', 'chinook.db');
			await app.workbench.connectionDialog.connect();
			await app.workbench.queryEditor.commandBar.run();
			await app.workbench.queryEditor.waitForResults();

			await app.workbench.quickaccess.runCommand('workbench.action.revertAndCloseActiveEditor');
		});
	});
}

export function setupWeb(opts: minimist.ParsedArgs) {
	describe('Query Editor', () => {
		setupCommonTests(opts);
	});
}

function setupCommonTests(opts: minimist.ParsedArgs): void {
	beforeSuite(opts);
	afterSuite(opts);
	afterEach(async function (): Promise<void> {
		const app = this.app as Application;
		await app.workbench.quickaccess.runCommand('workbench.action.closeAllEditors');
	});

	it.skip('can open, connect and execute file', async function () {
		const app = this.app as Application;
		await openAndExecuteFile(app, 'test.sql');
	});

	it.skip('can open, connect and execute file with spaces', async function () {
		const app = this.app as Application;
		await openAndExecuteFile(app, 'testWithSpaces.sql');
	});
	it.skip('can open, connect and execute file with escaped spaces', async function () {
		const app = this.app as Application;
		await openAndExecuteFile(app, 'testWithEscapedSpaces.sql');
	});
}

async function openAndExecuteFile(app: Application, filename: string): Promise<void> {
	await app.workbench.quickaccess.openFile(filename);
	await app.workbench.queryEditor.commandBar.connect();
	await app.workbench.connectionDialog.waitForConnectionDialog();
	await app.workbench.connectionDialog.setProvider('Sqlite');
	await app.workbench.connectionDialog.setTarget('File', 'chinook.db');
	await app.workbench.connectionDialog.connect();

	await app.workbench.queryEditor.commandBar.run();
	await app.workbench.queryEditor.waitForResults();
}
