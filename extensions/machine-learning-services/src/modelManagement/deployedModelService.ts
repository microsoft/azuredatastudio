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
		private _modelClient: ModelPythonClient) {
	}

	/**
	 * Returns deployed models
	 */
	public async getDeployedModels(): Promise<RegisteredModel[]> {
		let connection = await this.getCurrentConnection();
		let list: RegisteredModel[] = [];
		if (connection) {
			let query = this.getConfigureQuery(connection.databaseName);
			await this._queryRunner.safeRunQuery(connection, query);
			query = this.getDeployedModelsQuery();
			let result = await this._queryRunner.safeRunQuery(connection, query);
			if (result && result.rows && result.rows.length > 0) {
				result.rows.forEach(row => {
					list.push(this.loadModelData(row));
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
	public async deployLocalModel(filePath: string, details: RegisteredModelDetails | undefined) {
		let connection = await this.getCurrentConnection();
		if (connection) {
			let currentModels = await this.getDeployedModels();
			await this._modelClient.deployModel(connection, filePath);
			let updatedModels = await this.getDeployedModels();
			if (details && updatedModels.length >= currentModels.length + 1) {
				updatedModels.sort((a, b) => a.id && b.id ? a.id - b.id : 0);
				const addedModel = updatedModels[updatedModels.length - 1];
				addedModel.title = details.title;
				addedModel.description = details.description;
				addedModel.version = details.version;
				const updatedModel = await this.updateModel(addedModel);
				if (!updatedModel) {
					throw Error(constants.updateModelFailedError);
				}

			} else {
				throw Error(constants.importModelFailedError);
			}
		}
	}
	private loadModelData(row: azdata.DbCellValue[]): RegisteredModel {
		return {
			id: +row[0].displayValue,
			artifactName: row[1].displayValue,
			title: row[2].displayValue,
			description: row[3].displayValue,
			version: row[4].displayValue,
			created: row[5].displayValue
		};
	}

	private async updateModel(model: RegisteredModel): Promise<RegisteredModel | undefined> {
		let connection = await this.getCurrentConnection();
		let updatedModel: RegisteredModel | undefined = undefined;
		if (connection) {
			const query = this.getUpdateModelQuery(connection.databaseName, model);
			let result = await this._queryRunner.safeRunQuery(connection, query);
			if (result?.rows && result.rows.length > 0) {
				const row = result.rows[0];
				updatedModel = this.loadModelData(row);
			}
		}
		return updatedModel;
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	public getConfigureQuery(currentDatabaseName: string): string {
		return utils.getScriptWithDBChange(currentDatabaseName, this._config.registeredModelDatabaseName, this.getConfigureTableQuery());
	}

	public getDeployedModelsQuery(): string {
		return `
		SELECT artifact_id, artifact_name, name, description, version, created
		FROM ${utils.getRegisteredModelsThreePartsName(this._config)}
		WHERE artifact_name not like 'MLmodel' and artifact_name not like 'conda.yaml'
		Order by artifact_id
		`;
	}

	/**
	 * Update the table and adds extra columns (name, description, version) if doesn't already exist.
	 * Note: this code is temporary and will be removed weh the table supports the required schema
	 * @param databaseName
	 * @param tableName
	 */
	public getConfigureTableQuery(): string {
		let databaseName = this._config.registeredModelDatabaseName;
		let tableName = this._config.registeredModelTableName;
		let schemaName = this._config.registeredModelTableSchemaName;

		return `
		IF NOT EXISTS (
			SELECT [name]
				FROM sys.databases
				WHERE [name] = N'${utils.doubleEscapeSingleQuotes(databaseName)}'
		)
		CREATE DATABASE [${utils.doubleEscapeSingleBrackets(databaseName)}]
		GO
		USE [${utils.doubleEscapeSingleBrackets(databaseName)}]
		IF EXISTS
			(  SELECT [t.name], [s.name]
				FROM sys.tables t join sys.schemas s on t.schema_id=t.schema_id
				WHERE [t.name] = '${utils.doubleEscapeSingleQuotes(tableName)}'
				AND [s.name] = '${utils.doubleEscapeSingleQuotes(schemaName)}'
			)
		BEGIN
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${utils.getRegisteredModelsTowPartsName(this._config)}') AND NAME='name')
				ALTER TABLE ${utils.getRegisteredModelsTowPartsName(this._config)} ADD [name] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${utils.getRegisteredModelsTowPartsName(this._config)}') AND NAME='version')
				ALTER TABLE ${utils.getRegisteredModelsTowPartsName(this._config)} ADD [version] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${utils.getRegisteredModelsTowPartsName(this._config)}') AND NAME='created')
			BEGIN
				ALTER TABLE ${utils.getRegisteredModelsTowPartsName(this._config)} ADD [created] [datetime] NULL
				ALTER TABLE ${utils.getRegisteredModelsTowPartsName(this._config)} ADD CONSTRAINT CONSTRAINT_NAME DEFAULT GETDATE() FOR created
			END
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${utils.getRegisteredModelsTowPartsName(this._config)}') AND NAME='description')
				ALTER TABLE ${utils.getRegisteredModelsTowPartsName(this._config)} ADD [description] [varchar](256) NULL
		END
		Else
		BEGIN
		CREATE TABLE ${utils.getRegisteredModelsTowPartsName(this._config)}(
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
	}

	public getUpdateModelQuery(currentDatabaseName: string, model: RegisteredModel): string {
		let updateScript = `
		UPDATE ${utils.getRegisteredModelsTowPartsName(this._config)}
		SET
		name = '${utils.doubleEscapeSingleQuotes(model.title || '')}',
		version = '${utils.doubleEscapeSingleQuotes(model.version || '')}',
		description = '${utils.doubleEscapeSingleQuotes(model.description || '')}'
		WHERE artifact_id = ${model.id}`;

		return `
		${utils.getScriptWithDBChange(currentDatabaseName, this._config.registeredModelDatabaseName, updateScript)}
		SELECT artifact_id, artifact_name, name, description, version, created
		FROM ${utils.getRegisteredModelsThreePartsName(this._config)}
		WHERE artifact_id = ${model.id};
		`;
	}

	public getModelContentQuery(model: RegisteredModel): string {
		return `
		SELECT artifact_content
		FROM ${utils.getRegisteredModelsThreePartsName(this._config)}
		WHERE artifact_id = ${model.id};
		`;
	}
}
