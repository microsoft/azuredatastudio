/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { ApiWrapper } from '../../common/apiWrapper';
import  * as Queries  from '../../prediction/queries';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { PredictService } from '../../prediction/predictService';
import { QueryRunner } from '../../common/queryRunner';
import { ImportedModel } from '../../modelManagement/interfaces';
import { PredictParameters, DatabaseTable, TableColumn, PredictColumn } from '../../prediction/interfaces';
import * as path from 'path';
import * as os from 'os';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as fs from 'fs';


interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	importTable: DatabaseTable;
	queryRunner: TypeMoq.IMock<QueryRunner>;
}

function createContext(): TestContext {

	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		importTable: {
			databaseName: 'db',
			tableName: 'tb',
			schema: 'dbo'
		},
		queryRunner: TypeMoq.Mock.ofType(QueryRunner)
	};
}

describe('PredictService', () => {

	it('getDatabaseList should return databases successfully', async function (): Promise<void> {
		const testContext = createContext();
		const expected: string[] = [
			'db1',
			'db2'
		];
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		testContext.apiWrapper.setup(x => x.listDatabases(TypeMoq.It.isAny())).returns(() => { return Promise.resolve(expected); });

		let service = new PredictService(
			testContext.apiWrapper.object,
			testContext.queryRunner.object);
		const actual = await service.getDatabaseList();
		should.deepEqual(actual, expected);
	});

	it('getTableList should return tables successfully', async function (): Promise<void> {
		const testContext = createContext();
		const expected: DatabaseTable[] = [
			{
				databaseName: 'db1',
				schema: 'dbo',
				tableName: 'tb1'
			},
			{
				databaseName: 'db1',
				tableName: 'tb2',
				schema: 'dbo'
			}
		];

		const result = {
			rowCount: 1,
			columnInfo: [],
			rows: [[
				{
					displayValue: 'tb1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'dbo',
					isNull: false,
					invariantCultureDisplayValue: ''
				}
			], [
				{
					displayValue: 'tb2',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'dbo',
					isNull: false,
					invariantCultureDisplayValue: ''
				}
			]]
		};
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(result));
		let service = new PredictService(
			testContext.apiWrapper.object,
			testContext.queryRunner.object);
		const actual = await service.getTableList('db1');
		should.deepEqual(actual, expected);
	});

	it('getTableColumnsList should return table columns successfully', async function (): Promise<void> {
		const testContext = createContext();
		const expected: TableColumn[] = [
			{
				columnName: 'c1',
				dataType: 'INT',
				maxLength: undefined
			},
			{
				columnName: 'c2',
				dataType: 'VARCHAR',
				maxLength: 10
			}
		];
		const table: DatabaseTable =
			{
				databaseName: 'db1',
				schema: 'dbo',
				tableName: 'tb1'
			};

		const result = {
			rowCount: 1,
			columnInfo: [],
			rows: [[
				{
					displayValue: 'c1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'int',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: '',
					isNull: true,
					invariantCultureDisplayValue: ''
				}
			], [
				{
					displayValue: 'c2',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'varchar',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: '10',
					isNull: false,
					invariantCultureDisplayValue: ''
				}
			]]
		};
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });

		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(result));
		let service = new PredictService(
			testContext.apiWrapper.object,
			testContext.queryRunner.object);
		const actual = await service.getTableColumnsList(table);
		should.deepEqual(actual, expected);
	});

	it('generatePredictScript should generate the script successfully using model', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const predictParams: PredictParameters = {
			inputColumns: [
				{
					paramName: 'p1',
					dataType: 'int',
					columnName: '',
					maxLength: undefined
				},
				{
					paramName: 'p2',
					dataType: 'varchar',
					columnName: '',
					maxLength: 10
				}
			],
			outputColumns: [
				{
					paramName: 'o1',
					dataType: 'int',
					columnName: ''
				},
			],
			databaseName: '',
			tableName: '',
			schema: ''
		};
		const model: ImportedModel =
		{
			id: 1,
			modelName: 'name1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1',
			table: testContext.importTable
		};

		let service = new PredictService(
			testContext.apiWrapper.object,
			testContext.queryRunner.object);

		const document: vscode.TextDocument = {
			uri: vscode.Uri.parse('file:///usr/home'),
			fileName: '',
			isUntitled: true,
			languageId: 'sql',
			version: 1,
			isDirty: true,
			isClosed: false,
			save: undefined!,
			eol: undefined!,
			lineCount: 1,
			lineAt: undefined!,
			offsetAt: undefined!,
			positionAt: undefined!,
			getText: undefined!,
			getWordRangeAtPosition: undefined!,
			validateRange: undefined!,
			validatePosition: undefined!
		};
		testContext.apiWrapper.setup(x => x.openTextDocument(TypeMoq.It.isAny())).returns(() => Promise.resolve(document));
		testContext.apiWrapper.setup(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.apiWrapper.setup(x => x.runQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { });

		const actual = await service.generatePredictScript(predictParams, model, undefined);
		should.notEqual(actual, undefined);
		should.equal(actual.indexOf('FROM PREDICT(MODEL = @model') > 0, true);
	});

	it('generatePredictScript should generate the script successfully using file', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const predictParams: PredictParameters = {
			inputColumns: [
				{
					paramName: 'p1',
					dataType: 'int',
					columnName: ''
				},
				{
					paramName: 'p2',
					dataType: 'varchar',
					columnName: ''
				}
			],
			outputColumns: [
				{
					paramName: 'o1',
					dataType: 'int',
					columnName: ''
				},
			],
			databaseName: '',
			tableName: '',
			schema: ''
		};
		const tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
		await fs.promises.writeFile(tempFilePath, 'test');

		let service = new PredictService(
			testContext.apiWrapper.object,
			testContext.queryRunner.object);

		const document: vscode.TextDocument = {
			uri: vscode.Uri.parse('file:///usr/home'),
			fileName: '',
			isUntitled: true,
			languageId: 'sql',
			version: 1,
			isDirty: true,
			isClosed: false,
			save: undefined!,
			eol: undefined!,
			lineCount: 1,
			lineAt: undefined!,
			offsetAt: undefined!,
			positionAt: undefined!,
			getText: undefined!,
			getWordRangeAtPosition: undefined!,
			validateRange: undefined!,
			validatePosition: undefined!
		};
		testContext.apiWrapper.setup(x => x.openTextDocument(TypeMoq.It.isAny())).returns(() => Promise.resolve(document));
		testContext.apiWrapper.setup(x => x.connect(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve());
		testContext.apiWrapper.setup(x => x.runQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => { });

		const actual = await service.generatePredictScript(predictParams, undefined, tempFilePath);
		should.notEqual(actual, undefined);
		should.equal(actual.indexOf('FROM PREDICT(MODEL = 0X') > 0, true);
	});

	it('getInputColumnNames should user column max length for varchar type', async function (): Promise<void> {
		const columns: PredictColumn[] = [
			{
				paramName: 'p1',
				paramType: 'VARCHAR(MAX)',
				columnName: 'c1',
				dataType: 'VARCHAR',
				maxLength: 20
			},
			{
				paramName: 'p2',
				paramType: 'VARCHAR(MAX)',
				columnName: 'c2',
				dataType: 'DATETIME',
				maxLength: undefined
			},
			{
				paramName: 'p3',
				paramType: 'INT',
				columnName: 'c2',
				dataType: 'INT',
				maxLength: undefined
			},
		];

		const tableName = 'tbname';
		let actual = Queries.getInputColumnNames(columns, tableName);
		let expected =`CAST([tbname].[c1] AS VARCHAR(20)) AS p1,\n\tCAST([tbname].[c2] AS VARCHAR(100)) AS p2,\n\t[tbname].[c2] AS p3`;
		should.deepEqual(actual, expected);
	});
});
