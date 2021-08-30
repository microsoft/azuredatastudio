/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import * as sinon from 'sinon';
import * as constants from '../../../common/constants';
import { FlatFileWizard } from '../../../wizard/flatFileWizard';
import * as should from 'should';
import { ColumnMetadata, ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel, TestFlatFileProvider, getAzureAccounts } from '../../utils.test';
import { ImportPage } from '../../../wizard/api/importPage';
import { SummaryPage } from '../../../wizard/pages/summaryPage';
import { FlatFileProvider, InsertDataResponse } from '../../../services/contracts';

describe('import extension summary page tests', function () {

	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;
	let mockFlatFileProvider: TypeMoq.IMock<FlatFileProvider>;

	let summaryPage: SummaryPage;
	let wizard: azdata.window.Wizard;
	let page: azdata.window.WizardPage;
	let pages: Map<number, ImportPage> = new Map<number, ImportPage>();

	beforeEach(async function () {

		mockFlatFileProvider = TypeMoq.Mock.ofType(TestFlatFileProvider);
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, mockFlatFileProvider.object);
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);

		wizard = azdata.window.createWizard(constants.wizardNameText);
		page = azdata.window.createWizardPage(constants.page4NameText);

		sinon.stub(azdata.accounts, 'getAllAccounts').returns(Promise.resolve(getAzureAccounts()));

		sinon.stub(azdata.accounts, 'getAccountSecurityToken').returns(Promise.resolve({
			token: 'azureToken',
			tokenType: 'token'
		}));
		sinon.stub(azdata.connection, 'getConnectionString').returns(Promise.resolve('testConnectionString'));
	});

	this.afterEach(async () => {
		sinon.restore();
	});

	it('checking if all components are initialized properly', async function () {

		await new Promise<void>(function (resolve) {
			page.registerContent(async (view) => {
				summaryPage = new SummaryPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny());
				pages.set(1, summaryPage);
				await summaryPage.start();
				resolve();

			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});

		// checking if all the required components are correctly initialized
		should.notEqual(summaryPage.table, undefined, 'table should not be undefined');
		should.notEqual(summaryPage.statusText, undefined, 'statusText should not be undefined');
		should.notEqual(summaryPage.loading, undefined, 'loading should not be undefined');
		should.notEqual(summaryPage.form, undefined, 'form should not be undefined');

		await summaryPage.onPageLeave();
		await summaryPage.cleanup();

	});

	it('handle import updates status Text correctly', async function () {

		// Creating a test Connection
		let testServerConnection: azdata.connection.Connection = {
			providerName: 'testProviderName',
			connectionId: 'testConnectionId',
			options: {}
		};


		// setting up connection objects in model
		mockImportModel.object.server = testServerConnection;
		mockImportModel.object.database = 'testDatabase';
		mockImportModel.object.schema = 'testSchema';
		mockImportModel.object.filePath = 'testFilePath';

		// Creating test columns
		let testProseColumns = [
			{
				columnName: 'column1',
				dataType: 'nvarchar(50)',
				primaryKey: false,
				nullable: false
			},
			{
				columnName: 'column2',
				dataType: 'nvarchar(50)',
				primaryKey: false,
				nullable: false
			}
		];
		mockImportModel.object.proseColumns = testProseColumns;

		// setting up a test table insert response from FlatFileProvider
		let testSendInsertDataRequestResponse: InsertDataResponse = {
			result: {
				success: true,
				errorMessage: ''
			}
		};
		mockFlatFileProvider.setup(x => x.sendInsertDataRequest(TypeMoq.It.isAny())).returns(async () => { return testSendInsertDataRequestResponse; });

		await new Promise<void>(function (resolve) {
			page.registerContent(async (view) => {
				summaryPage = new SummaryPage(mockFlatFileWizard.object, page, mockImportModel.object, view, mockFlatFileProvider.object);
				pages.set(1, summaryPage);
				await summaryPage.start();
				summaryPage.setupNavigationValidator();
				resolve();
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});

		// Entering the page. This method will try to create table using FlatFileProvider
		await summaryPage.onPageEnter();

		// In case of success we should see the success message
		should.equal(summaryPage.statusText.value, constants.updateText);

		// In case of a failure we should see the error message
		testSendInsertDataRequestResponse = {
			result: {
				success: false,
				errorMessage: 'testError'
			}
		};

		// mocking the insertDataRequest to fail
		mockFlatFileProvider.setup(x => x.sendInsertDataRequest(TypeMoq.It.isAny())).returns(async () => { return testSendInsertDataRequestResponse; });

		// Entering the page. This method will try to create table using FlatFileProvider
		await summaryPage.onPageEnter();
		should.equal(summaryPage.statusText.value, constants.summaryErrorSymbol + 'testError');

	});

	it('Data is inserted with correct account access token in case of Azure MFA connections', async() => {

		// Creating a test AAD MFA connection
		let testServerConnection: azdata.connection.Connection = {
			providerName: 'testProviderName',
			connectionId: 'testConnectionId',
			options: {
				azureAccount: getAzureAccounts()[1].key.accountId,
				azureTenantId: 'azureAccount2Tenant',
				authenticationType: 'AzureMFA'
			}
		};

		// Overriding the behavior of getAccountSecurityToken and making sure
		// it returns only when called with second azure test account and
		// azureTenantId from test connection.
		(<any>azdata.accounts)['getAccountSecurityToken'].restore();
		sinon.stub(azdata.accounts, 'getAccountSecurityToken')
		.withArgs(
			getAzureAccounts()[1],
			'azureAccount2Tenant',
			sinon.match.any
		).returns(
			Promise.resolve({
			token: 'token2',
			tokenType: 'azureTokenType'
		}));

		// setting up connection objects in model
		mockImportModel.object.server = testServerConnection;
		mockImportModel.object.database = 'testDatabase';
		mockImportModel.object.schema = 'testSchema';
		mockImportModel.object.filePath = 'testFilePath';


		let testSendInsertDataRequestResponse: InsertDataResponse = {
			result: {
				success: true,
				errorMessage: ''
			}
		};

		// Creating test columns
		let testProseColumns: ColumnMetadata[] = [
		];
		mockImportModel.object.proseColumns = testProseColumns;

		// Creating a test request params with azure account 2 token
		let testSendInsertDataRequest = {
			connectionString: 'testConnectionString',
			batchSize: 500,
			azureAccessToken: 'token2'
		};

		mockFlatFileProvider.setup(x => x.sendInsertDataRequest(testSendInsertDataRequest)).returns(async () => { return testSendInsertDataRequestResponse; });

		await new Promise<void>(function (resolve) {
			page.registerContent(async (view) => {
				summaryPage = new SummaryPage(mockFlatFileWizard.object, page, mockImportModel.object, view, mockFlatFileProvider.object);
				pages.set(1, summaryPage);
				await summaryPage.start();
				summaryPage.setupNavigationValidator();
				resolve();
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});

		await summaryPage.onPageEnter();

		// Verifying insert data request is called with expected parameters once.
		mockFlatFileProvider.verify(x => x.sendInsertDataRequest(testSendInsertDataRequest), TypeMoq.Times.once());
	});
});
