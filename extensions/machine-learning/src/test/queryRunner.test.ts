/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { QueryRunner } from '../common/queryRunner';
import { IPackageDetails } from '../typings/notebookServices';

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	queryProvider: azdata.QueryProvider;
}

function createContext(): TestContext {
	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		queryProvider: {
			providerId: '',
			cancelQuery: () => { return Promise.reject(); },
			runQuery: () => { return Promise.reject(); },
			runQueryStatement: () => { return Promise.reject(); },
			runQueryString: () => { return Promise.reject(); },
			runQueryAndReturn: () => { return Promise.reject(); },
			parseSyntax: () => { return Promise.reject(); },
			getQueryRows: () => { return Promise.reject(); },
			disposeQuery: () => { return Promise.reject(); },
			saveResults: () => { return Promise.reject(); },
			setQueryExecutionOptions: () => { return Promise.reject(); },
			registerOnQueryComplete: () => { return Promise.reject(); },
			registerOnBatchStart: () => { return Promise.reject(); },
			registerOnBatchComplete: () => { return Promise.reject(); },
			registerOnResultSetAvailable: () => { return Promise.reject(); },
			registerOnResultSetUpdated: () => { return Promise.reject(); },
			registerOnMessage: () => { return Promise.reject(); },
			commitEdit: () => { return Promise.reject(); },
			createRow: () => { return Promise.reject(); },
			deleteRow: () => { return Promise.reject(); },
			disposeEdit: () => { return Promise.reject(); },
			initializeEdit: () => { return Promise.reject(); },
			revertCell: () => { return Promise.reject(); },
			revertRow: () => { return Promise.reject(); },
			updateCell: () => { return Promise.reject(); },
			getEditRows: () => { return Promise.reject(); },
			registerOnEditSessionReady: () => { return Promise.reject(); },
		}
	};
}

describe('Query Runner', () => {
	it('getPythonPackages Should return empty list if not provider found', async function (): Promise<void> {
		let testContext = createContext();
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		let queryProvider: azdata.QueryProvider;
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => queryProvider);

		let actual = await queryRunner.getPythonPackages(connection, connection.databaseName);
		should.deepEqual(actual, []);
	});

	it('getPythonPackages Should return empty list if not provider throws', async function (): Promise<void> {
		let testContext = createContext();
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.reject(); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.getPythonPackages(connection, connection.databaseName);
		should.deepEqual(actual, []);
	});

	it('getPythonPackages Should return list if provider runs the query successfully', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [
			[{
				displayValue: 'p1',
				isNull: false,
				invariantCultureDisplayValue: ''
			}, {
				displayValue: '0',
				isNull: false,
				invariantCultureDisplayValue: ''
			},
			{
				displayValue: '1.1.1',
				isNull: false,
				invariantCultureDisplayValue: ''
			}],
			[{
				displayValue: 'p2',
				isNull: false,
				invariantCultureDisplayValue: ''
			}, {
				displayValue: '1',
				isNull: false,
				invariantCultureDisplayValue: ''
			}, {
				displayValue: '1.1.2',
				isNull: false,
				invariantCultureDisplayValue: ''
			}]
		];
		let expected = [
			{
				'name': 'p1',
				'readonly': false,
				'version': '1.1.1'
			},
			{
				'name': 'p2',
				'readonly': true,
				'version': '1.1.2'
			}
		];

		let result: azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: [],
			rows: rows,
		};
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.getPythonPackages(connection, connection.databaseName);

		should.deepEqual(actual, expected);
	});

	it('getPythonPackages Should return empty list if provider return no rows', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [
		];
		let expected: IPackageDetails[] = [];

		let result: azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: [],
			rows: rows,
		};
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.getPythonPackages(connection, connection.databaseName);

		should.deepEqual(actual, expected);
	});

	it('updateExternalScriptConfig Should update config successfully', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [
		];

		let result: azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: [],
			rows: rows,
		};
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		await should(queryRunner.updateExternalScriptConfig(connection, true)).resolved();

	});

	it('isPythonInstalled Should return true is provider returns valid result', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [
			[{
				displayValue: '1',
				isNull: false,
				invariantCultureDisplayValue: ''
			}]
		];
		let expected = true;

		let result: azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: [],
			rows: rows,
		};
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.isPythonInstalled(connection);
		should.deepEqual(actual, expected);
	});

	it('isPythonInstalled Should return true is provider returns 0 as result', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [
			[{
				displayValue: '0',
				isNull: false,
				invariantCultureDisplayValue: ''
			}]
		];
		let expected = false;

		let result: azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: [],
			rows: rows,
		};
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.isPythonInstalled(connection);
		should.deepEqual(actual, expected);
	});

	it('isPythonInstalled Should return false is provider returns no result', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [];
		let expected = false;

		let result: azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: [],
			rows: rows,
		};
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.isPythonInstalled(connection);
		should.deepEqual(actual, expected);
	});

	it('isMachineLearningServiceEnabled Should return true is provider returns valid result', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [
			[{
				displayValue: '1',
				isNull: false,
				invariantCultureDisplayValue: ''
			}]
		];
		let expected = true;

		let result: azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: [],
			rows: rows,
		};
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.isMachineLearningServiceEnabled(connection);
		should.deepEqual(actual, expected);
	});

	it('isMachineLearningServiceEnabled Should return true is provider returns 0 as result', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [
			[{
				displayValue: '0',
				isNull: false,
				invariantCultureDisplayValue: ''
			}]
		];
		let expected = false;

		let result: azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: [],
			rows: rows,
		};
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.isMachineLearningServiceEnabled(connection);
		should.deepEqual(actual, expected);
	});

	it('isMachineLearningServiceEnabled Should return false is provider returns no result', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [];
		let expected = false;

		let result: azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: [],
			rows: rows,
		};
		let connection = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = () => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.isMachineLearningServiceEnabled(connection);
		should.deepEqual(actual, expected);
	});

});
