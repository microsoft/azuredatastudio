/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import { ApiWrapper } from '../../../common/apiWrapper';
import * as constants from '../../../common/constants';
import { FlatFileWizard } from '../../../wizard/flatFileWizard';
import * as should from 'should';
import { ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel, TestFlatFileProvider } from '../../utils.test';
import { ImportPage } from '../../../wizard/api/importPage';
import { SummaryPage } from '../../../wizard/pages/summaryPage';
import { FlatFileProvider, InsertDataResponse } from '../../../services/contracts';

describe('import extension summary page tests', function () {
	let wizard: azdata.window.Wizard;
	let page: azdata.window.WizardPage;
	let summaryPage: SummaryPage;
	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	let pages: Map<number, ImportPage> = new Map<number, ImportPage>();
	let mockFlatFileProvider: TypeMoq.IMock<FlatFileProvider>;

	beforeEach(async function () {
		// Keeping the original behaviour of apiWrapper until some setup is needed to mock stuff
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper, TypeMoq.MockBehavior.Loose);
		mockApiWrapper.callBase = true;

		mockFlatFileProvider = TypeMoq.Mock.ofType(TestFlatFileProvider);

		// mocking FlatFileWizard which is passed as a constructor argument to the page
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, mockFlatFileProvider.object, mockApiWrapper.object);

		// mocking ImportModel which is passes as a constructor argument to the page
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);

		// creating the wizard of which the page is going to be a part of
		wizard = mockApiWrapper.object.createWizard(constants.wizardNameText);

		// creating the wizard page that contains the form
		page = mockApiWrapper.object.createWizardPage(constants.page3NameText);

	});

	it('checking if all components are initialized properly', async function () {
		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				summaryPage = new SummaryPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny(), mockApiWrapper.object);
				pages.set(1, summaryPage);
				await summaryPage.start().then(() => {
					summaryPage.setupNavigationValidator();
					summaryPage.onPageEnter();
					resolve();
				});
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});
		should.notEqual(summaryPage.table, undefined);
		should.notEqual(summaryPage.statusText, undefined);
		should.notEqual(summaryPage.loading, undefined);
		should.notEqual(summaryPage.form, undefined);
	});

	it('handle import updates status Text correctly', async function() {

		let testServerConnection: azdata.connection.Connection = {
			providerName: 'testProviderName',
			connectionId: 'testConnectionId',
			options: {}
		};

		mockImportModel.object.server =  testServerConnection;
		mockImportModel.object.database = 'testDatabase';
		mockImportModel.object.schema = 'testSchema';
		mockImportModel.object.filePath = 'testFilePath';

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

		let testSendInsertDataRequestResponse: InsertDataResponse = {
			result: {
				success: true,
				errorMessage: ''
			}
		};

		mockFlatFileProvider.setup(x => x.sendInsertDataRequest(TypeMoq.It.isAny())).returns(async () => { return testSendInsertDataRequestResponse; });

		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				summaryPage = new SummaryPage(mockFlatFileWizard.object, page, mockImportModel.object, view, mockFlatFileProvider.object, mockApiWrapper.object);
				pages.set(1, summaryPage);
				await summaryPage.start().then(async () => {
					summaryPage.setupNavigationValidator();
					await summaryPage.onPageEnter();
					resolve();
				});
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});


		should.equal(summaryPage.statusText.value,  constants.updateText);

		testSendInsertDataRequestResponse = {
			result: {
				success: false,
				errorMessage: 'testError'
			}
		};

		mockFlatFileProvider.setup(x => x.sendInsertDataRequest(TypeMoq.It.isAny())).returns(async () => { return testSendInsertDataRequestResponse; });
		await summaryPage.onPageEnter();
		should.equal(summaryPage.statusText.value,  '✗ testError');

	});
});
