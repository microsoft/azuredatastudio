/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';
import * as minimist from 'minimist';
import { afterSuite, beforeSuite } from '../../../utils';
import assert = require('assert');

const SQL_INSTANCE_CONNECTION_ID = 'sql2019';

export function setup(opts: minimist.ParsedArgs) {
	describe('SQL Query Editor', () => {
		setupCommonTests(opts);
	});
}

export function setupWeb(opts: minimist.ParsedArgs) {
	describe('SQL Query Editor', () => {
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

	it('can execute a query', async function () {
		const app = this.app as Application;
		await app.workbench.queryEditors.newUntitledQuery();
		const untitled = 'SQLQuery_1';
		await app.workbench.editor.waitForTypeInEditor(untitled, 'SELECT product FROM sys.servers');
		const testSqlConnection = this.app.getConnectionById(SQL_INSTANCE_CONNECTION_ID);
		await app.workbench.queryEditor.commandBar.connect();
		await app.workbench.connectionDialog.waitForConnectionDialog();
		await app.workbench.connectionDialog.fillConnectionDialog(testSqlConnection);
		await app.workbench.queryEditor.commandBar.run();
		await app.workbench.queryEditor.waitForResults();
		await new Promise(resolve => setTimeout(resolve, 1000));
		const element = await app.code.waitForElement('div.slick-cell.l1.r1 > span');
		assert.strictEqual(element.textContent, 'SQL Server');
	});
}

