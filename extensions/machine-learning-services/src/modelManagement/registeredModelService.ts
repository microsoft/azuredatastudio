/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ApiWrapper } from '../common/apiWrapper';
import * as utils from '../common/utils';
import { Config } from '../configurations/config';
import { QueryRunner } from '../common/queryRunner';
import { RegisteredModel } from './interfaces';
import { ModelImporter } from './modelImporter';
import * as constants from '../common/constants';

/**
 * Service to registered models
 */
export class RegisteredModelService {

	/**
	 *
	 */
	constructor(
		private _apiWrapper: ApiWrapper,
		private _config: Config,
		private _queryRunner: QueryRunner,
		private _modelImporter: ModelImporter) {
	}

	public async getRegisteredModels(): Promise<RegisteredModel[]> {
		let connection = await this.getCurrentConnection();
		let list: RegisteredModel[] = [];
		if (connection) {
			let result = await this.runRegisteredModelsListQuery(connection);
			if (result && result.rows && result.rows.length > 0) {
				result.rows.forEach(row => {
					list.push(this.loadModelData(row));
				});
			}
		}
		return list;
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

	public async updateModel(model: RegisteredModel): Promise<RegisteredModel | undefined> {
		let connection = await this.getCurrentConnection();
		let updatedModel: RegisteredModel | undefined = undefined;
		if (connection) {
			let result = await this.runUpdateModelQuery(connection, model);
			if (result && result.rows && result.rows.length > 0) {
				const row = result.rows[0];
				updatedModel = this.loadModelData(row);
			}
		}
		return updatedModel;
	}

	public async registerLocalModel(filePath: string, details: RegisteredModel | undefined) {
		let connection = await this.getCurrentConnection();
		if (connection) {
			let currentModels = await this.getRegisteredModels();
			await this._modelImporter.registerModel(connection, filePath);
			let updatedModels = await this.getRegisteredModels();
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

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	private async runRegisteredModelsListQuery(connection: azdata.connection.ConnectionProfile): Promise<azdata.SimpleExecuteResult | undefined> {
		try {
			return await this._queryRunner.runQuery(connection, this.registeredModelsQuery(connection.databaseName, this._config.registeredModelDatabaseName, this._config.registeredModelTableName));
		} catch {
			return undefined;
		}
	}

	private async runUpdateModelQuery(connection: azdata.connection.ConnectionProfile, model: RegisteredModel): Promise<azdata.SimpleExecuteResult | undefined> {
		try {
			return await this._queryRunner.runQuery(connection, this.getUpdateModelScript(connection.databaseName, this._config.registeredModelDatabaseName, this._config.registeredModelTableName, model));
		} catch {
			return undefined;
		}
	}

	private registeredModelsQuery(currentDatabaseName: string, databaseName: string, tableName: string): string {
		if (!currentDatabaseName) {
			currentDatabaseName = 'master';
		}
		let escapedTableName = utils.doubleEscapeSingleBrackets(tableName);
		let escapedDbName = utils.doubleEscapeSingleBrackets(databaseName);
		let escapedCurrentDbName = utils.doubleEscapeSingleBrackets(currentDatabaseName);

		return `
		${this.configureTable(databaseName, tableName)}
		USE [${escapedCurrentDbName}]
		SELECT artifact_id, artifact_name, name, description, version, created
		FROM [${escapedDbName}].dbo.[${escapedTableName}]
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
	private configureTable(databaseName: string, tableName: string): string {
		let escapedTableName = utils.doubleEscapeSingleBrackets(tableName);
		let escapedDbName = utils.doubleEscapeSingleBrackets(databaseName);

		return `
		USE [${escapedDbName}]
		IF EXISTS
			(  SELECT [name]
				FROM sys.tables
				WHERE [name] = '${utils.doubleEscapeSingleQuotes(tableName)}'
			)
		BEGIN
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('${escapedTableName}') AND NAME='name')
				ALTER TABLE [dbo].[${escapedTableName}] ADD [name] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[${escapedTableName}]') AND NAME='version')
				ALTER TABLE [dbo].[${escapedTableName}] ADD [version] [varchar](256) NULL
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[${escapedTableName}]') AND NAME='created')
			BEGIN
				ALTER TABLE [dbo].[${escapedTableName}] ADD [created] [datetime] NULL
				ALTER TABLE [dbo].[${escapedTableName}] ADD CONSTRAINT CONSTRAINT_NAME DEFAULT GETDATE() FOR created
			END
			IF NOT EXISTS (SELECT * FROM syscolumns WHERE ID=OBJECT_ID('[dbo].[${escapedTableName}]') AND NAME='description')
				ALTER TABLE [dbo].[${escapedTableName}] ADD [description] [varchar](256) NULL
		END
		`;
	}

	private getUpdateModelScript(currentDatabaseName: string, databaseName: string, tableName: string, model: RegisteredModel): string {

		if (!currentDatabaseName) {
			currentDatabaseName = 'master';
		}
		let escapedTableName = utils.doubleEscapeSingleBrackets(tableName);
		let escapedDbName = utils.doubleEscapeSingleBrackets(databaseName);
		let escapedCurrentDbName = utils.doubleEscapeSingleBrackets(currentDatabaseName);
		return `
		USE [${escapedDbName}]
		UPDATE ${escapedTableName}
			SET
			name = '${utils.doubleEscapeSingleQuotes(model.title || '')}',
			version = '${utils.doubleEscapeSingleQuotes(model.version || '')}',
			description = '${utils.doubleEscapeSingleQuotes(model.description || '')}'
			WHERE artifact_id = ${model.id};

		USE [${escapedCurrentDbName}]
		SELECT artifact_id, artifact_name, name, description, version, created from ${escapedDbName}.dbo.[${escapedTableName}]
		WHERE artifact_id = ${model.id};
		`;
	}
}
