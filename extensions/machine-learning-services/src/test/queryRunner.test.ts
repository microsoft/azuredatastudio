/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import { ApiWrapper } from '../common/apiWrapper';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { QueryRunner } from '../common/queryRunner';

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	queryProvider: azdata.QueryProvider;
}

function createContext(): TestContext {
	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		queryProvider: {
			providerId: '',
			cancelQuery: undefined,
			runQuery: undefined,
			runQueryStatement: undefined,
			runQueryString: undefined,
			runQueryAndReturn: (ownerUri: string, queryString: string) => { return Promise.resolve(undefined); },
			parseSyntax: undefined,
			getQueryRows: undefined,
			disposeQuery: undefined,
			saveResults: undefined,
			setQueryExecutionOptions: undefined,
			registerOnQueryComplete: undefined,
			registerOnBatchStart: undefined,
			registerOnBatchComplete: undefined,
			registerOnResultSetAvailable: undefined,
			registerOnResultSetUpdated: undefined,
			registerOnMessage: undefined,
			commitEdit: undefined,
			createRow: undefined,
			deleteRow: undefined,
			disposeEdit: undefined,
			initializeEdit: undefined,
			revertCell: undefined,
			revertRow: undefined,
			updateCell: undefined,
			getEditRows: undefined,
			registerOnEditSessionReady: undefined,
		}
	};
}

describe('Query Runner', () => {
	it('getPythonPackages Should return empty list if not provider found', async function (): Promise<void> {
		let testContext = createContext();
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => undefined);

		let actual = await queryRunner.getPythonPackages(connection);
		should.deepEqual(actual, []);
	});

	it('getPythonPackages Should return empty list if not provider throws', async function (): Promise<void> {
		let testContext = createContext();
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.reject(); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.getPythonPackages(connection);
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
				displayValue: '1.1.1',
				isNull: false,
				invariantCultureDisplayValue: ''
			}],
			[{
				displayValue: 'p2',
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
				'version': '1.1.1'
			},
			{
				'name': 'p2',
				'version': '1.1.2'
			}
		];

		let result : azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: undefined,
			rows: rows,
		};
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.getPythonPackages(connection);

		should.deepEqual(actual, expected);
	});

	it('getPythonPackages Should return empty list if provider return no rows', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [
		];
		let expected = [];

		let result : azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: undefined,
			rows: rows,
		};
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.getPythonPackages(connection);

		should.deepEqual(actual, expected);
	});

	it('updateExternalScriptConfig Should update config successfully', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [
		];

		let result : azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: undefined,
			rows: rows,
		};
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.resolve(result); };
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

		let result : azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: undefined,
			rows: rows,
		};
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.resolve(result); };
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

		let result : azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: undefined,
			rows: rows,
		};
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.isPythonInstalled(connection);
		should.deepEqual(actual, expected);
	});

	it('isPythonInstalled Should return false is provider returns no result', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [];
		let expected = false;

		let result : azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: undefined,
			rows: rows,
		};
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.resolve(result); };
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

		let result : azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: undefined,
			rows: rows,
		};
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.resolve(result); };
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

		let result : azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: undefined,
			rows: rows,
		};
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.isMachineLearningServiceEnabled(connection);
		should.deepEqual(actual, expected);
	});

	it('isMachineLearningServiceEnabled Should return false is provider returns no result', async function (): Promise<void> {
		let testContext = createContext();
		let rows: azdata.DbCellValue[][] = [];
		let expected = false;

		let result : azdata.SimpleExecuteResult = {
			rowCount: 2,
			columnInfo: undefined,
			rows: rows,
		};
		let connection  = new azdata.connection.ConnectionProfile();
		let queryRunner = new QueryRunner(testContext.apiWrapper.object);
		testContext.queryProvider.runQueryAndReturn = (ownerUri: string, queryString: string) => { return Promise.resolve(result); };
		testContext.apiWrapper.setup(x => x.getProvider<azdata.QueryProvider>(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => testContext.queryProvider);

		let actual = await queryRunner.isMachineLearningServiceEnabled(connection);
		should.deepEqual(actual, expected);
	});

});
