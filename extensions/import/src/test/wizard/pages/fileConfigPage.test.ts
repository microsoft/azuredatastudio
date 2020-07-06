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

describe('import extension wizard pages', function () {

	let mockFlatFileWizard: TypeMoq.IMock<FlatFileWizard>;
	let mockApiWrapper: TypeMoq.IMock<ApiWrapper>;
	let mockImportModel: TypeMoq.IMock<ImportDataModel>;

	this.beforeEach(function () {
		mockApiWrapper = TypeMoq.Mock.ofType(ApiWrapper);
		mockFlatFileWizard = TypeMoq.Mock.ofType(FlatFileWizard, TypeMoq.MockBehavior.Loose, undefined, TypeMoq.It.isAny(), mockApiWrapper.object);
		mockImportModel = TypeMoq.Mock.ofType(TestImportDataModel, TypeMoq.MockBehavior.Loose);
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
});
