/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import { DataTierApplicationWizard, PageName } from '../wizard/dataTierApplicationWizard';
import { DacFxDataModel } from '../wizard/api/models';
import { TestContext, createContext } from './testContext';
import { TestDeployConfigPage } from './DacFxTestConfigPages';

let wizard: DataTierApplicationWizard;
let testContext: TestContext;

describe('Dacfx Wizard Pages', function (): void {
	beforeEach(async function (): Promise<void> {
		wizard = new DataTierApplicationWizard();
		wizard.model = <DacFxDataModel>{};
		wizard.model.server = undefined;
	});

	it('Should open and edit deploy config page correctly', async () => {
		testContext = createContext();
		wizard.setPages();

		let deployConfigPage = new TestDeployConfigPage(wizard, wizard.pages.get(PageName.deployConfig).wizardPage, wizard.model, testContext.viewContext.view);
		await deployConfigPage.start();

		should.equal(deployConfigPage.Model.upgradeExisting, true);
		should.equal(deployConfigPage.Model.filePath, undefined);
		should.equal(deployConfigPage.Model.database, undefined);

		await deployConfigPage.SetFileName();
		testContext.viewContext.onTextChanged.fire(undefined);
		should.equal(deployConfigPage.Model.filePath, 'DummyDacpac');
		should.equal(deployConfigPage.Model.database, 'DummyDacpac');

		await deployConfigPage.SetDatabaseDropDown();
		testContext.viewContext.onValueChanged.fire(undefined);
		should.equal(deployConfigPage.Model.filePath, 'DummyDacpac');
		should.equal(deployConfigPage.Model.database, 'DummyDatabase');
	});
});
