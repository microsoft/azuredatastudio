/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as should from 'should';
import * as sinon from 'sinon';
import * as azdata from 'azdata';
import { DataTierApplicationWizard, PageName } from '../wizard/dataTierApplicationWizard';
import { DacFxDataModel } from '../wizard/api/models';
import { TestContext, createContext } from './testContext';
import { TestDeployConfigPage, TestExtractConfigPage, TestImportConfigPage } from './DacFxTestConfigPages';

let wizard: DataTierApplicationWizard;
let testContext: TestContext;

describe('Dacfx Wizard Pages', function (): void {
	beforeEach(async function (): Promise<void> {
		wizard = new DataTierApplicationWizard();
		wizard.model = <DacFxDataModel>{};
		wizard.model.server = undefined;
	});

	afterEach(function (): void {
		sinon.restore();
	});

	it('Should open and edit deploy config page correctly', async () => {
		testContext = createContext();
		wizard.setPages();

		let deployConfigPage = new TestDeployConfigPage(wizard, wizard.pages.get(PageName.deployConfig).wizardPage, wizard.model, testContext.viewContext.view);
		await deployConfigPage.start();

		// Validate state after start
		should.equal(deployConfigPage.Model.upgradeExisting, true);
		should.equal(deployConfigPage.Model.filePath, undefined);
		should.equal(deployConfigPage.Model.database, undefined);

		// Adding file name in test box should update model path and db
		deployConfigPage.SetFileName();
		testContext.viewContext.onTextChanged.fire(undefined);
		should.equal(deployConfigPage.Model.filePath, 'DummyDacpac');
		should.equal(deployConfigPage.Model.database, 'DummyDacpac');

		// Choosing database should update model db but not path
		deployConfigPage.SetDatabaseDropDown();
		testContext.viewContext.onValueChanged.fire(undefined);
		should.equal(deployConfigPage.Model.filePath, 'DummyDacpac');
		should.equal(deployConfigPage.Model.database, 'DummyDatabase');

		// Changing radio buttons should affect model correctly
		testContext.viewContext.newDatabaseRadioOnClick.fire(undefined);
		should.equal(deployConfigPage.Model.upgradeExisting, false);
		testContext.viewContext.updateExistingRadioOnClick.fire(undefined);
		should.equal(deployConfigPage.Model.upgradeExisting, true);
	});

	it('Should open and edit extract config page correctly', async () => {
		testContext = createContext();
		wizard.setPages();

		let extractConfigPage = new TestExtractConfigPage(wizard, wizard.pages.get(PageName.deployConfig).wizardPage, wizard.model, testContext.viewContext.view);
		await extractConfigPage.start();

		// Validate state after start
		should.equal(extractConfigPage.Model.version, '1.0.0.0');
		should.equal(extractConfigPage.Model.filePath, '');
		should.equal(extractConfigPage.Model.database, undefined);

		// Note : no need to test above function from deploy page since they are from common base class
		// on text change event value in text box should overwrite model value
		extractConfigPage.Model.version = 'dummy';
		testContext.viewContext.onTextChanged.fire(undefined);
		should.equal(extractConfigPage.Model.version, '1.0.0.0');

		// Should autocorrect file name to correct extension type
		extractConfigPage.Model.filePath = 'DummyPath';
		await extractConfigPage.onPageLeave();
		should.equal(extractConfigPage.Model.filePath, 'DummyPath.dacpac');
	});

	it('Should open and edit import config page correctly', async () => {
		testContext = createContext();
		wizard.setPages();
		sinon.stub(azdata.connection, 'getConnections').resolves([mockConnectionProfile]);
		sinon.stub(azdata.connection, 'listDatabases').resolves(['fakeDatabaseName']);

		let importConfigPage = new TestImportConfigPage(wizard, wizard.pages.get(PageName.deployConfig).wizardPage, wizard.model, testContext.viewContext.view);
		await importConfigPage.start();

		let result = await importConfigPage.onPageEnter();
		should(result).equal(true, 'onPageEnter() should successfullly load connection profiles');
	});
});

const mockConnectionProfile: azdata.connection.ConnectionProfile = {
	providerId: 'MSSQL',
	connectionId: 'My Connection ID',
	connectionName: 'My Connection',
	serverName: 'My Server',
	databaseName: 'My Database',
	userName: 'My User',
	password: 'My Pwd',
	authenticationType: 'SqlLogin',
	savePassword: false,
	groupFullName: 'My groupName',
	groupId: 'My GroupId',
	saveProfile: true,
	options: {}
};
