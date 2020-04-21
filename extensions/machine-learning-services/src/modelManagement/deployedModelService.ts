/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ApiWrapper } from '../common/apiWrapper';
import * as utils from '../common/utils';
import { Config } from '../configurations/config';
import { QueryRunner } from '../common/queryRunner';
import { RegisteredModel, RegisteredModelDetails, ModelParameters } from './interfaces';
import { ModelPythonClient } from './modelPythonClient';
import * as constants from '../common/constants';
import { DatabaseTable } from '../prediction/interfaces';
import { ModelConfigRecent } from './modelConfigRecent';

/**
 * Service to deployed models
 */
export class DeployedModelService {

	/**
	 * Creates new instance
	 */
	constructor(
		private _apiWrapper: ApiWrapper,
		private _config: Config,
		private _queryRunner: QueryRunner,
		private _modelClient: ModelPythonClient,
		private _recentModelService: ModelConfigRecent) {
	}

	/**
	 * Returns deployed models
	 */
	public async getDeployedModels(table: DatabaseTable): Promise<RegisteredModel[]> {
		let connection = await this.getCurrentConnection();
		let list: RegisteredModel[] = [];
		if (!table.databaseName || !table.tableName || !table.schema) {
			return [];
		}
		if (connection) {
			const query = this.getDeployedModelsQuery(table);
			let result = await this._queryRunner.safeRunQuery(connection, query);
			if (result && result.rows && result.rows.length > 0) {
				result.rows.forEach(row => {
					list.push(this.loadModelData(row, table));
				});
			}
		} else {
			throw Error(constants.noConnectionError);
		}
		return list;
	}

	/**
	 * Downloads model
	 * @param model model object
	 */
	public async downloadModel(model: RegisteredModel): Promise<string> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			const query = this.getModelContentQuery(model);
			let result = await this._queryRunner.safeRunQuery(connection, query);
			if (result && result.rows && result.rows.length > 0) {
				const content = result.rows[0][0].displayValue;
				return await utils.writeFileFromHex(content);
			} else {
				throw Error(constants.invalidModelToSelectError);
			}
		} else {
			throw Error(constants.noConnectionError);
		}
	}

	/**
	 * Loads model parameters
	 */
	public async loadModelParameters(filePath: string): Promise<ModelParameters> {
		return await this._modelClient.loadModelParameters(filePath);
	}

	/**
	 * Deploys local model
	 * @param filePath model file path
	 * @param details model details
	 */
	public async deployLocalModel(filePath: string, details: RegisteredModelDetails | undefined, table: DatabaseTable) {
		let connection = await this.getCurrentConnection();
		if (connection && table.databaseName) {

			await this.configureImport(connection, table);

			let currentModels = await this.getDeployedModels(table);
			const content = await utils.readFileInHex(filePath);
			const fileName = details?.fileName || utils.getFileName(filePath);
			let modelToAdd: RegisteredModel = {
				id: 0,
				artifactName: fileName,
				content: content,
				title: details?.title || fileName,
				description: details?.description,
				version: details?.version,
				table: table
			};
			await this._queryRunner.runWithDatabaseChange(connection, this.getInsertModelQuery(modelToAdd, table), table.databaseName);

			let updatedModels = await this.getDeployedModels(table);
			if (updatedModels.length < currentModels.length + 1) {
				throw Error(constants.importModelFailedError(details?.title, filePath));
			}

		} else {
			throw new Error(constants.noConnectionError);
		}
	}

	public async configureImport(connection: azdata.connection.ConnectionProfile, table: DatabaseTable) {
		if (connection && table.databaseName) {
			let query = this.getDatabaseConfigureQuery(table);
			await this._queryRunner.safeRunQuery(connection, query);

			query = this.getConfigureTableQuery(table);
			await this._queryRunner.runWithDatabaseChange(connection, query, table.databaseName);
		}
	}

	/**
	 * Verifies if the given table name is valid to be used as import table. If table doesn't exist returns true to create new table
	 * Otherwise verifies the schema and returns true if the schema is supported
	 * @param connection database connection
	 * @param table config table name
	 */
	public async verifyConfigTable(table: DatabaseTable): Promise<boolean> {
		let connection = await this.getCurrentConnection();
		if (connection && table.databaseName) {
			let databases = await this._apiWrapper.listDatabases(connection.connectionId);

			// If database exist verify the table schema
			//
			if ((await databases).find(x => x === table.databaseName)) {
				const query = this.getConfigTableVerificationQuery(table);
				const result = await this._queryRunner.runWithDatabaseChange(connection, query, table.databaseName);
				return result !== undefined && result.rows.length > 0 && result.rows[0][0].displayValue === '1';
			} else {
				return true;
			}
		} else {
			throw new Error(constants.noConnectionError);
		}
	}

	public async getRecentImportTable(): Promise<DatabaseTable> {
		let connection = await this.getCurrentConnection();
		let table: DatabaseTable | undefined;
		if (connection) {
			table = this._recentModelService.getModelTable(connection);
			if (!table) {
				table = {
					databaseName: connection.databaseName ?? 'master',
					tableName: this._config.registeredModelTableName,
					schema: this._config.registeredModelTableSchemaName
				};
			}
		} else {
			throw new Error(constants.noConnectionError);
		}
		return table;
	}

	public async storeRecentImportTable(importTable: DatabaseTable): Promise<void> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			this._recentModelService.storeModelTable(connection, importTable);
		} else {
			throw new Error(constants.noConnectionError);
		}
	}

	private loadModelData(row: azdata.DbCellValue[], table: DatabaseTable): RegisteredModel {
		return {
			id: +row[0].displayValue,
			artifactName: row[1].displayValue,
			title: row[2].displayValue,
			description: row[3].displayValue,
			version: row[4].displayValue,
			created: row[5].displayValue,
			table: table
		};
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	public getDatabaseConfigureQuery(configTable: DatabaseTable): string {
		return `
		IF NOT EXISTS (
			SELECT name
				FROM sys.databases
				WHERE name = N'${utils.doubleEscapeSingleQuotes(configTable.databaseName)}'
		)
			CREATE DATABASE [${utils.doubleEscapeSingleBrackets(configTable.databaseName)}]
			`;
	}

	public getDeployedModelsQuery(table: DatabaseTable): string {
		return `
		SELECT artifact_id, artifact_name, name, description, version, created
		FROM ${utils.getRegisteredModelsThreePartsName(table.databaseName || '', table.tableName || '', table.schema || '')}
		WHERE artifact_name not like 'MLmodel' and artifact_name not like 'conda.yaml'
		Order by artifact_id
		`;
	}

	/**
	 * Verifies config table has the expected schema
	 * @param databaseName
	 * @param tableName
	 */
	public getConfigTableVerificationQuery(table: DatabaseTable): string {
		let tableName = table.tableName;
		let schemaName = table.schema;
		const twoPartTableName = utils.getRegisteredModelsTwoPartsName(table.tableName || '', table.schema || '');

		return `
		IF NOT EXISTS (
			SELECT name
				FROM sys.databases
				WHERE name = N'${utils.doubleEscapeSingleQuotes(table.databaseName)}'
		)
		BEGIN
			Select 1
		END
		ELSE
		BEGIN
			USE [${utils.doubleEscapeSingleBrackets(table.databaseName)}]
			IF EXISTS
				(  SELECT t.name, s.name
					FROM sys.tables t join sys.schemas s on t.schema_id=t.schema_id
					WHERE t.name = '${utils.doubleEscapeSingleQuotes(tableName)}'
					AND s.name = '${utils.doubleEscapeSingleQuotes(schemaName)}'
				)
			BEGIN
				IF EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='artifact_name')
					AND EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='artifact_content')
					AND EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='name')
					AND EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='version')
					AND EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='created')
				BEGIN
					Select 1
				END
				ELSE
				BEGIN
					Select 0
				END
			END
			ELSE
				select 1
		END
		`;
	}

	/**
	 * Update the table and adds extra columns (name, description, version) if doesn't already exist.
	 * Note: this code is temporary and will be removed weh the table supports the required schema
	 * @param databaseName
	 * @param tableName
	 */
	public getConfigureTableQuery(table: DatabaseTable): string {
		let tableName = table.tableName;
		let schemaName = table.schema;
		const twoPartTableName = utils.getRegisteredModelsTwoPartsName(table.tableName || '', table.schema || '');

		return `
		IF EXISTS
			(  SELECT t.name, s.name
				FROM sys.tables t join sys.schemas s on t.schema_id=t.schema_id
				WHERE t.name = '${utils.doubleEscapeSingleQuotes(tableName)}'
				AND s.name = '${utils.doubleEscapeSingleQuotes(schemaName)}'
			)
		BEGIN
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='artifact_name')
				ALTER TABLE ${twoPartTableName} ADD [artifact_name] [varchar](256) NOT NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='artifact_content')
				ALTER TABLE ${twoPartTableName} ADD [artifact_content] [varbinary](max) NOT NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='name')
				ALTER TABLE ${twoPartTableName} ADD [name] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='version')
				ALTER TABLE ${twoPartTableName} ADD [version] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='created')
			BEGIN
				ALTER TABLE ${twoPartTableName} ADD [created] [datetime] NULL
				ALTER TABLE ${twoPartTableName} ADD CONSTRAINT CONSTRAINT_NAME DEFAULT GETDATE() FOR created
			END
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${twoPartTableName}') AND NAME='description')
				ALTER TABLE ${twoPartTableName} ADD [description] [varchar](256) NULL
		END
		Else
		BEGIN
		CREATE TABLE ${twoPartTableName}(
			[artifact_id] [int] IDENTITY(1,1) NOT NULL,
			[artifact_name] [varchar](256) NOT NULL,
			[artifact_content] [varbinary](max) NOT NULL,
			[artifact_initial_size] [bigint] NULL,
			[name] [varchar](256) NULL,
			[version] [varchar](256) NULL,
			[created] [datetime] NULL,
			[description] [varchar](256) NULL,
		CONSTRAINT [${utils.doubleEscapeSingleBrackets(tableName)}_artifact_pk] PRIMARY KEY CLUSTERED
		(
			[artifact_id] ASC
		)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON) ON [PRIMARY]
		) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]
		ALTER TABLE [dbo].[${utils.doubleEscapeSingleBrackets(tableName)}] ADD  CONSTRAINT [CONSTRAINT_NAME]  DEFAULT (getdate()) FOR [created]
		END
		`;
	}

	public getInsertModelQuery(model: RegisteredModel, table: DatabaseTable): string {
		const twoPartTableName = utils.getRegisteredModelsTwoPartsName(table.tableName || '', table.schema || '');
		const threePartTableName = utils.getRegisteredModelsThreePartsName(table.databaseName || '', table.tableName || '', table.schema || '');
		let updateScript = `
		Insert into ${twoPartTableName}
		(artifact_name, artifact_content, name, version, description)
		values (
			'${utils.doubleEscapeSingleQuotes(model.artifactName || '')}',
			${utils.doubleEscapeSingleQuotes(model.content || '')},
			'${utils.doubleEscapeSingleQuotes(model.title || '')}',
			'${utils.doubleEscapeSingleQuotes(model.version || '')}',
			'${utils.doubleEscapeSingleQuotes(model.description || '')}')
		`;

		return `
		${updateScript}

		SELECT artifact_id, artifact_name, name, description, version, created
		FROM ${threePartTableName}
		WHERE artifact_id = SCOPE_IDENTITY();
		`;
	}

	public getModelContentQuery(model: RegisteredModel): string {
		const threePartTableName = utils.getRegisteredModelsThreePartsName(model.table.databaseName || '', model.table.tableName || '', model.table.schema || '');
		return `
		SELECT artifact_content
		FROM ${threePartTableName}
		WHERE artifact_id = ${model.id};
		`;
	}
}
