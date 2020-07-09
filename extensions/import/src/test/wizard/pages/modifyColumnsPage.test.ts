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
import { ModifyColumnsPage } from '../../../wizard/pages/modifyColumnsPage';
import { ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel, TestFlatFileProvider } from '../../utils.test';
import { ImportPage } from '../../../wizard/api/importPage';
import { FlatFileProvider } from '../../../services/contracts';

describe('import extension modify Column Page', function () {
	let wizard: azdata.window.Wizard;
	let page: azdata.window.WizardPage;
	let modifyColumnsPage: ModifyColumnsPage;
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

		// Opening the wizard and initializing the page as ModifyColumnsPage
		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				modifyColumnsPage = new ModifyColumnsPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny(), mockApiWrapper.object);
				pages.set(1, modifyColumnsPage);
				await modifyColumnsPage.start().then(() => {
					resolve();
				});
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});

		// checking if all the components are initialized properly
		should.notEqual(modifyColumnsPage.table, undefined);
		should.notEqual(modifyColumnsPage.text, undefined);
		should.notEqual(modifyColumnsPage.loading, undefined);
		should.notEqual(modifyColumnsPage.form, undefined);
	});

	it('handleImport updates table value correctly when import is successful', async function() {


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

		let testTableData = [
			[ 'column1', 'nvarchar(50)', false, false],
			[ 'column2', 'nvarchar(50)', false, false]
		];

		mockImportModel.object.proseColumns = testProseColumns;


		// Opening the wizard and initializing the page as ModifyColumnsPage
		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				modifyColumnsPage = new ModifyColumnsPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny(), mockApiWrapper.object);
				pages.set(1, modifyColumnsPage);
				await modifyColumnsPage.start().then(async () => {
					resolve();
				});
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});


		await modifyColumnsPage.onPageEnter();

		// checking if all the required components are correctly initialized
		should.deepEqual(modifyColumnsPage.table.data, testTableData);

	});
});
