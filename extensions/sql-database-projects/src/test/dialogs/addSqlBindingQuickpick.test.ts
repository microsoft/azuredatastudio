/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as should from 'should';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as baselines from '../baselines/baselines';
import * as templates from '../../templates/templates';
import * as utils from '../../common/utils';

import { TestContext } from '../testContext';
import { launchAddSqlBindingQuickpick } from '../../dialogs/addSqlBindingQuickpick';
import { PackageHelper } from '../../tools/packageHelper';

let testContext: TestContext;

describe('Add SQL Binding quick pick', () => {
	before(async function (): Promise<void> {
		await templates.loadTemplates(path.join(__dirname, '..', '..', '..', 'resources', 'templates'));
		await baselines.loadBaselines();
	});

	it('Should show error if the file contains no Azure Functions', async function (): Promise<void> {
		sinon.stub(utils, 'getAzureFunctionService').resolves(testContext.azureFunctionService.object);
		const spy = sinon.spy(vscode.window, 'showErrorMessage');

		await launchAddSqlBindingQuickpick(vscode.Uri.file(''), new PackageHelper(testContext.outputChannel));

		// const msg = constants.fileAlreadyExists(tableName);
		should(spy.calledOnce).be.true('showErrorMessage should have been called exactly once');
		// should(spy.calledWith(msg)).be.true(`showErrorMessage not called with expected message '${msg}' Actual '${spy.getCall(0).args[0]}'`);
	});
});
