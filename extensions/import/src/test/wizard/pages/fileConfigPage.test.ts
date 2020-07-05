/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as TypeMoq from 'typemoq';
import * as azdata from 'azdata';
import { FlatFileWizard } from '../../../wizard/flatFileWizard';
import { ApiWrapper } from '../../../common/apiWrapper';
import { ImportDataModel } from '../../../wizard/api/models';
import { TestImportDataModel, TestQueryProvider } from '../../utils.test';
import { FileConfigPage } from '../../../wizard/pages/fileConfigPage';
import * as should from 'should';
import { ImportPage } from '../../../wizard/api/importPage';
import * as constants from '../../../common/constants';

describe('File config page', function () {

	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;
	let wizard: azdata.window.Wizard;
	let page: azdata.window.WizardPage;
	let pages: Map<number, ImportPage> = new Map<number, ImportPage>();
	let apiWrapper: ApiWrapper;
	let fileConfigPage: FileConfigPage;



	this.beforeEach(function () {
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, TypeMoq.It.isAny(), mockApiWrapper.object);
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);
		apiWrapper = new ApiWrapper();
	});

	it('get schema returns active schema first', async function () {
		mockApiWrapper.setup(x => x.getUriForConnection(TypeMoq.It.isAny()));
		let mockQueryProvider = TypeMoq.Mock.ofType(TestQueryProvider);
		let schemaQueryResult: azdata.SimpleExecuteResult = {
			rowCount: 3,
			rows: [
				[
					{ displayValue: 'schema1', isNull: false, invariantCultureDisplayValue: 'schema1' }
				],
				[
					{ displayValue: 'schema2', isNull: false, invariantCultureDisplayValue: 'schema2' }
				],
				[
					{ displayValue: 'schema3', isNull: false, invariantCultureDisplayValue: 'schema3' }
				]
			],
			columnInfo: undefined
		}

		let expectedSchemaValues = [
			{ displayName: 'schema2', name: 'schema2' }, // This should be the first database as it is active in the extension.
			{ displayName: 'schema1', name: 'schema1' },
			{ displayName: 'schema3', name: 'schema3' }
		];

		mockImportModel.object.schema = 'schema2';
		mockImportModel.object.server = {
			providerName: 'MSSQL',
			connectionId: 'testConnectionId',
			options: {}
		};
		mockQueryProvider.setup(x => x.runQueryAndReturn(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(async () => { return schemaQueryResult });
		mockApiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { return mockQueryProvider.object; });

		let importPage = new FileConfigPage(mockFlatFileWizard.object, TypeMoq.It.isAny(), mockImportModel.object, TypeMoq.It.isAny(), TypeMoq.It.isAny(), mockApiWrapper.object);
		let actualSchemaValues = await importPage.getSchemaValues();

		should(expectedSchemaValues).deepEqual(actualSchemaValues);
	});

	it('checking if all components are initialized properly', async function () {
		wizard = apiWrapper.createWizard(constants.wizardNameText);
		page = apiWrapper.createWizardPage(constants.page3NameText);

		await new Promise(function (resolve) {
			page.registerContent(async (view) => {
				fileConfigPage = new FileConfigPage(mockFlatFileWizard.object, page, mockImportModel.object, view, TypeMoq.It.isAny(), apiWrapper);
				pages.set(1, fileConfigPage);
				await fileConfigPage.start().then(() => {
					fileConfigPage.setupNavigationValidator();
					fileConfigPage.onPageEnter();
					resolve();
				});
			});
			wizard.generateScriptButton.hidden = true;

			wizard.pages = [page];
			wizard.open();
		});
		should.notEqual(fileConfigPage.serverDropdown, undefined);
		should.notEqual(fileConfigPage.databaseDropdown, undefined);
		should.notEqual(fileConfigPage.fileTextBox, undefined);
		should.notEqual(fileConfigPage.fileButton, undefined);
		should.notEqual(fileConfigPage.tableNameTextBox, undefined);
		should.notEqual(fileConfigPage.schemaDropdown, undefined);
		should.notEqual(fileConfigPage.form, undefined);
		should.notEqual(fileConfigPage.databaseLoader, undefined);
		should.notEqual(fileConfigPage.schemaLoader, undefined);
	});
});
