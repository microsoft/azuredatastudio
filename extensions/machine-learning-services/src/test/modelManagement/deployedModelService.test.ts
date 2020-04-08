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
import { RegisteredModel } from '../../modelManagement/interfaces';
import { ModelPythonClient } from '../../modelManagement/modelPythonClient';
import * as path from 'path';
import * as os from 'os';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import * as fs from 'fs';

interface TestContext {

	apiWrapper: TypeMoq.IMock<ApiWrapper>;
	config: TypeMoq.IMock<Config>;
	queryRunner: TypeMoq.IMock<QueryRunner>;
	modelClient: TypeMoq.IMock<ModelPythonClient>;
}

function createContext(): TestContext {

	return {
		apiWrapper: TypeMoq.Mock.ofType(ApiWrapper),
		config: TypeMoq.Mock.ofType(Config),
		queryRunner: TypeMoq.Mock.ofType(QueryRunner),
		modelClient: TypeMoq.Mock.ofType(ModelPythonClient)
	};
}

describe('DeployedModelService', () => {
	it('getDeployedModels should fail with no connection', async function (): Promise<void> {
		const testContext = createContext();
		let connection: azdata.connection.ConnectionProfile;

		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object);
		await should(service.getDeployedModels()).rejected();
	});

	it('getDeployedModels should returns models successfully', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const expected: RegisteredModel[] = [
			{
				id: 1,
				artifactName: 'name1',
				title: 'title1',
				description: 'desc1',
				created: '2018-01-01',
				version: '1.1'
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
						displayValue: 'title1',
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
					}
				]
			]
		};
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object);
		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => Promise.resolve(result));

		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'db');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'table');
		const actual = await service.getDeployedModels();
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
			testContext.modelClient.object);
		const actual = await service.loadModelParameters('');
		should.deepEqual(actual, expected);
	});

	it('downloadModel should download model successfully', async function (): Promise<void> {
		const testContext = createContext();
		const connection = new azdata.connection.ConnectionProfile();
		const tempFilePath = path.join(os.tmpdir(), `ads_ml_temp_${UUID.generateUuid()}`);
		await fs.promises.writeFile(tempFilePath, 'test');
		testContext.apiWrapper.setup(x => x.getCurrentConnection()).returns(() => { return Promise.resolve(connection); });
		const model: RegisteredModel =
		{
			id: 1,
			artifactName: 'name1',
			title: 'title1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1'
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
			testContext.modelClient.object);
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
		const model: RegisteredModel =
		{
			id: 1,
			artifactName: 'name1',
			title: 'title1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1'
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
				displayValue: 'title1',
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
			}
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
			testContext.modelClient.object);
		testContext.modelClient.setup(x => x.deployModel(connection, '')).returns(() => {
			deployed = true;
			return Promise.resolve();
		});
		testContext.queryRunner.setup(x => x.safeRunQuery(TypeMoq.It.isAny(), TypeMoq.It.isAny())).returns(() => {
			return deployed ? Promise.resolve(updatedResult) : Promise.resolve(result);
		});

		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'db');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'table');
		testContext.config.setup(x => x.registeredModelTableSchemaName).returns(() => 'dbo');
		await should(service.deployLocalModel('', model)).resolved();
	});

	it('getConfigureQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		const dbName = 'curre[n]tDb';
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object);
		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'd[]b');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'ta[b]le');
		testContext.config.setup(x => x.registeredModelTableSchemaName).returns(() => 'dbo');
		const expected = `
		IF NOT EXISTS (
			SELECT [name]
				FROM sys.databases
				WHERE [name] = N'd[]b'
		)
		CREATE DATABASE [d[[]]b]
		GO
		USE [d[[]]b]
		IF EXISTS
			(  SELECT [t.name], [s.name]
				FROM sys.tables t join sys.schemas s on t.schema_id=t.schema_id
				WHERE [t.name] = 'ta[b]le'
				AND [s.name] = 'dbo'
			)
		BEGIN
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='name')
				ALTER TABLE [dbo].[ta[[b]]le] ADD [name] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='version')
				ALTER TABLE [dbo].[ta[[b]]le] ADD [version] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='created')
			BEGIN
				ALTER TABLE [dbo].[ta[[b]]le] ADD [created] [datetime] NULL
				ALTER TABLE [dbo].[ta[[b]]le] ADD CONSTRAINT CONSTRAINT_NAME DEFAULT GETDATE() FOR created
			END
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[ta[[b]]le]') AND NAME='description')
				ALTER TABLE [dbo].[ta[[b]]le] ADD [description] [varchar](256) NULL
		END
		Else
		BEGIN
		CREATE TABLE [dbo].[ta[[b]]le](
			[artifact_id] [int] IDENTITY(1,1) NOT NULL,
			[artifact_name] [varchar](256) NOT NULL,
			[group_path] [varchar](256) NOT NULL,
			[artifact_content] [varbinary](max) NOT NULL,
			[artifact_initial_size] [bigint] NULL,
			[name] [varchar](256) NULL,
			[version] [varchar](256) NULL,
			[created] [datetime] NULL,
			[description] [varchar](256) NULL,
		CONSTRAINT [artifact_pk] PRIMARY KEY CLUSTERED
		(
			[artifact_id] ASC
		)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
		) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
		ALTER TABLE [dbo].[artifacts] ADD  CONSTRAINT [CONSTRAINT_NAME]  DEFAULT (getdate()) FOR [created]
		END
	`;
		const actual = service.getConfigureQuery(dbName);
		should.equal(actual.indexOf(expected) > 0, true);
	});

	it('getDeployedModelsQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object);
		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'd[]b');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'ta[b]le');
		testContext.config.setup(x => x.registeredModelTableSchemaName).returns(() => 'dbo');
		const expected = `
		SELECT artifact_id, artifact_name, name, description, version, created
		FROM [d[[]]b].[dbo].[ta[[b]]le]
		WHERE artifact_name not like 'MLmodel' and artifact_name not like 'conda.yaml'
		Order by artifact_id
		`;
		const actual = service.getDeployedModelsQuery();
		should.deepEqual(expected, actual);
	});

	it('getUpdateModelQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		const dbName = 'curre[n]tDb';
		const model: RegisteredModel =
		{
			id: 1,
			artifactName: 'name1',
			title: 'title1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1'
		};

		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object);
		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'd[]b');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'ta[b]le');
		testContext.config.setup(x => x.registeredModelTableSchemaName).returns(() => 'dbo');
		const expected = `
		UPDATE [dbo].[ta[[b]]le]
		SET
		name = 'title1',
		version = '1.1',
		description = 'desc1'
		WHERE artifact_id = 1`;
		const actual = service.getUpdateModelQuery(dbName, model);
		should.equal(actual.indexOf(expected) > 0, true);
		//should.deepEqual(actual, expected);

	});

	it('getModelContentQuery should escape db name', async function (): Promise<void> {
		const testContext = createContext();
		const model: RegisteredModel =
		{
			id: 1,
			artifactName: 'name1',
			title: 'title1',
			description: 'desc1',
			created: '2018-01-01',
			version: '1.1'
		};

		let service = new DeployedModelService(
			testContext.apiWrapper.object,
			testContext.config.object,
			testContext.queryRunner.object,
			testContext.modelClient.object);
		testContext.config.setup(x => x.registeredModelDatabaseName).returns(() => 'd[]b');
		testContext.config.setup(x => x.registeredModelTableName).returns(() => 'ta[b]le');
		testContext.config.setup(x => x.registeredModelTableSchemaName).returns(() => 'dbo');
		const expected = `
		SELECT artifact_content
		FROM [d[[]]b].[dbo].[ta[[b]]le]
		WHERE artifact_id = 1;
		`;
		const actual = service.getModelContentQuery(model);
		should.deepEqual(actual, expected);
	});
});
