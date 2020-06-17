/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as utils from '../../common/utils';
import { ApiWrapper } from '../../common/apiWrapper';
import * as TypeMoq from 'typemoq';
import * as should from 'should';
import { Config } from '../../configurations/config';
import { DeployedModelService } from '../../modelManagement/deployedModelService';
import { QueryRunner } from '../../common/queryRunner';
import { ImportedModel } from '../../modelManagement/interfaces';
import { ModelPythonClient } from '../../modelManagement/modelPythonClient';
import * as path from 'path';
import * as os from 'os';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as fs from 'fs';
import { ModelConfigRecent } from '../../modelManagement/modelConfigRecent';
import { DatabaseTable } from '../../prediction/interfaces';
import * as queries from '../../modelManagement/queries';

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	config: TypeMoq.IMock<Config>;
	queryRunner: TypeMoq.IMock<QueryRunner>;
	modelClient: TypeMoq.IMock<ModelPythonClient>;
	recentModels: TypeMoq.IMock<ModelConfigRecent>;
	importTable: DatabaseTable;
}

function createContext(): TestContext {

	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		config: TypeMoq.Mock.ofType(Config),
		queryRunner: TypeMoq.Mock.ofType(QueryRunner),
		modelClient: TypeMoq.Mock.ofType(ModelPythonClient),
		recentModels: TypeMoq.Mock.ofType(ModelConfigRecent),
		importTable: {
			databaseName: 'db',
			tableName: 'tb',
			schema: 'dbo'
		}
	};
}

describe('DeployedModelService', () => {
	it('getDeployedModels should fail with no connection', async function (): Promise<void> {
		const testContext = createContext();
		let connection: azdata.connection.ConnectionProfile;
		let importTable: DatabaseTable = {
			databaseName: 'db',
			tableName: 'tb',
			schema: 'dbo'
		};

		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		await should(service.getDeployedModels(importTable)).rejected();
	});

	it('getDeployedModels should returns models successfully', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const expected: ImportedModel[] = [
			{
				id: 1,
				modelName: 'name1',
				description: 'desc1',
				created: '2018-01-01',
				deploymentTime: '2018-01-01',
				version: '1.1',
				framework: 'onnx',
				frameworkVersion: '1',
				deployedBy: '1',
				runId: 'run1',
				table: testContext.importTable,
				contentLength: 100

			}
		];
		const result = {
			rowCount: 1,
			columnInfo: [],
			rows: [
				[
					{
						displayValue: '1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: 'name1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: 'desc1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: '1.1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: '2018-01-01',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: 'onnx',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: '1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: '2018-01-01',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: '1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: 'run1',
						isNull: false,
						invariantCultureDisplayValue: ''
					},
					{
						displayValue: '100',
						isNull: false,
						invariantCultureDisplayValue: ''
					}
				]
			]
		};
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(result));
		const actual = await service.getDeployedModels(testContext.importTable);
		should.deepEqual(actual, expected);
	});

	it('loadModelParameters should load parameters using python client successfully', async function (): Promise<void> {
		const testContext = createContext();
		const expected = {
			inputs: [
				{
					'name': 'p1',
					'type': 'int'
				},
				{
					'name': 'p2',
					'type': 'varchar'
				}
			],
			outputs: [
				{
					'name': 'o1',
					'type': 'int'
				},
			]
		};
		testContext.modelClient.setup(x => x.loadModelParameters(TypeMoq.It.isAny())).returns(() => Promise.resolve(expected));
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		const actual = await service.loadModelParameters('');
		should.deepEqual(actual, expected);
	});

	it('downloadModel should download model successfully', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		const tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
		await fs.promises.writeFile(tempFilePath, 'test');
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const model: ImportedModel =
		{
			id: 1,
			modelName: 'name1',
			description: 'desc1',
			created: '2018-01-01',
			deploymentTime: '2018-01-01',
			version: '1.1',
			framework: 'onnx',
			frameworkVersion: '1',
			deployedBy: '1',
			runId: 'run1',
			table: testContext.importTable
		};
		const result = {
			rowCount: 1,
			columnInfo: [],
			rows: [
				[
					{
						displayValue: await utils.readFileInHex(tempFilePath),
						isNull: false,
						invariantCultureDisplayValue: ''
					}
				]
			]
		};
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);
		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(result));

		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'db');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'table');
		testContext.config.setup(x => x.registeredModelTableSchemaName).returns(() => 'dbo');
		const actual = await service.downloadModel(model);
		should.notEqual(actual, undefined);
	});

	it('deployLocalModel should returns models successfully', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const model: ImportedModel =
		{
			id: 1,
			modelName: 'name1',
			description: 'desc1',
			created: '2018-01-01',
			deploymentTime: '2018-01-01',
			version: '1.1',
			framework: 'onnx',
			frameworkVersion: '1',
			deployedBy: '1',
			runId: 'run1',
			table: testContext.importTable

		};
		const row = [
				{
					displayValue: '1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'name1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'desc1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: '1.1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: '2018-01-01',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'onnx',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: '1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: '2018-01-01',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: '1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: 'run1',
					isNull: false,
					invariantCultureDisplayValue: ''
				},
				{
					displayValue: '100',
					isNull: false,
					invariantCultureDisplayValue: ''
				},

		];
		const result = {
			rowCount: 1,
			columnInfo: [],
			rows: [row]
		};
		let updatedResult = {
			rowCount: 1,
			columnInfo: [],
			rows: [row, row]
		};
		let deployed = false;
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object,
			testContext.recentModels.object);

		testContext.queryRunner.setup(x => x.runWithDatabaseChange(TypeMoq.It.isAny(), TypeMoq.It.is(x => x.indexOf('INSERT INTO') > 0), TypeMoq.It.isAny())).returns(() => {
			deployed = true;
			return Promise.resolve(result);
		});
		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
			return deployed ? Promise.resolve(updatedResult) : Promise.resolve(result);
		});
		testContext.queryRunner.setup(x => x.runWithDatabaseChange(TypeMoq.It.isAny(), TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(result));

		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'db');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'table');
		testContext.config.setup(x => x.registeredModelTableSchemaName).returns(() => 'dbo');
		let tempFilePath: string = '';
		try {
			tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
			await fs.promises.writeFile(tempFilePath, 'test');
			await should(service.deployLocalModel(tempFilePath, model, testContext.importTable)).resolved();
		}
		finally {
			await utils.deleteFile(tempFilePath);
		}
	});

	it('getConfigureQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();

		testContext.importTable.databaseName = 'd[]b';
		testContext.importTable.tableName = 'ta[b]le';
		testContext.importTable.schema = 'dbo';
		const expected = `
		IF NOT EXISTS
			(  SELECT t.name, s.name
				FROM sys.tables t join sys.schemas s on t.schema_id=t.schema_id
				WHERE t.name = 'ta[b]le'
				AND s.name = 'dbo'
			)
		BEGIN
		CREATE TABLE [dbo].[ta[[b]]le](
			[model_id] [int] IDENTITY(1,1) NOT NULL,
			[model_name] [varchar](256) NOT NULL,
			[model_framework] [varchar](256) NULL,
			[model_framework_version] [varchar](256) NULL,
			[model] [varbinary](max) NOT NULL,
			[model_version] [varchar](256) NULL,
			[model_creation_time] [datetime2] NULL,
			[model_deployment_time] [datetime2] NULL,
			[deployed_by] [int] NULL,
			[model_description] [varchar](256) NULL,
			[run_id] [varchar](256) NULL,
		CONSTRAINT [ta[[b]]le_models_pk] PRIMARY KEY CLUSTERED
		(
			[model_id] ASC
		)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
		) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
		ALTER TABLE [dbo].[ta[[b]]le] ADD  CONSTRAINT [ta[[b]]le_deployment_time]  DEFAULT (getdate()) FOR [model_deployment_time]
		END
	`;
		const actual = queries.getConfigureTableQuery(testContext.importTable);
		should.equal(actual.indexOf(expected) >= 0, true, `actual: ${actual} \n expected: ${expected}`);
	});

	it('getDeployedModelsQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		testContext.importTable.databaseName = 'd[]b';
		testContext.importTable.tableName = 'ta[b]le';
		testContext.importTable.schema = 'dbo';
		const expected = `
		SELECT model_id, model_name, model_description, model_version, model_creation_time, model_framework, model_framework_version, model_deployment_time, deployed_by, run_id, len(model)
		FROM [d[[]]b].[dbo].[ta[[b]]le]
		WHERE model_name not like 'MLmodel' and model_name not like 'conda.yaml'
		ORDER BY model_id
		`;
		const actual = queries.getDeployedModelsQuery(testContext.importTable);
		should.deepEqual(expected, actual);
	});

	it('getInsertModelQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		const model: ImportedModel =
		{
			id: 1,
			modelName: 'name1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1',
			table: testContext.importTable
		};

		const expected = `INSERT INTO [dbo].[tb]
		(model_name, model, model_version, model_description, model_creation_time, model_framework, model_framework_version, run_id)
		VALUES (
			'name1',
			,
			'1.1',
			'desc1',
			'2018-01-01',
			'',
			'',
			'')`;
		const actual = queries.getInsertModelQuery(model, testContext.importTable);
		should.equal(actual.indexOf(expected) >= 0, true, `actual: ${actual} \n expected: ${expected}`);
	});

	it('getModelContentQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		const model: ImportedModel =
		{
			id: 1,
			modelName: 'name1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1',
			table: testContext.importTable
		};

		model.table = {
			databaseName: 'd[]b', tableName: 'ta[b]le', schema: 'dbo'
		};
		const expected = `
		DECLARE @str varbinary(max)

		SELECT @str=model
		FROM [d[[]]b].[dbo].[ta[[b]]le]
		WHERE model_id = 1;

		select substring(@str, 0, 1001) as d0
		`;
		const actual = queries.getModelContentQuery(model);
		should.deepEqual(actual, expected, `actual: ${actual} \n expected: ${expected}`);
	});
});
