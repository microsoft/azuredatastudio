/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
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
	let pages: Map<number, ImportPage> = new Map<number, ImportPage>();
	let mockFlatFileProvider: TypeMoq.IMock<FlatFileProvider>;

	beforeEach(function () {

		mockFlatFileProvider = TypeMoq.Mock.ofType(TestFlatFileProvider);
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, mockFlatFileProvider.object);
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);

		wizard = azdata.window.createWizard(constants.wizardNameText);
		page = azdata.window.createWizardPage(constants.page3NameText);

	});

	it('checking if all components are initialized properly', async function () {

		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				modifyColumnsPage = new ModifyColumnsPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny());
				pages.set(1, modifyColumnsPage);
				await modifyColumnsPage.start();
				resolve();
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});

		// checking if all the components are initialized properly
		should.notEqual(modifyColumnsPage.table, undefined, 'table should not be undefined');
		should.notEqual(modifyColumnsPage.text, undefined, 'text should not be undefined');
		should.notEqual(modifyColumnsPage.loading, undefined, 'loading should not be undefined');
		should.notEqual(modifyColumnsPage.form, undefined, 'form should not be undefined');
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

		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				modifyColumnsPage = new ModifyColumnsPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny());
				pages.set(1, modifyColumnsPage);
				await modifyColumnsPage.start();
				resolve();
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
