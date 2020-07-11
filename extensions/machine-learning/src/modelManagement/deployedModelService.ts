/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ApiWrapper } from '../common/apiWrapper';
import * as utils from '../common/utils';
import { Config } from '../configurations/config';
import { QueryRunner } from '../common/queryRunner';
import { ImportedModel, ImportedModelDetails, ModelParameters } from './interfaces';
import { ModelPythonClient } from './modelPythonClient';
import * as constants from '../common/constants';
import * as queries from './queries';
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
	public async getDeployedModels(table: DatabaseTable): Promise<ImportedModel[]> {
		let connection = await this.getCurrentConnection();
		let list: ImportedModel[] = [];
		if (!table.databaseName || !table.tableName || !table.schema) {
			return [];
		}
		if (connection) {
			const query = queries.getDeployedModelsQuery(table);
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
	public async downloadModel(model: ImportedModel): Promise<string> {
		let connection = await this.getCurrentConnection();
		let fileContent: string = '';
		if (connection) {
			const query = queries.getModelContentQuery(model);
			let result = await this._queryRunner.safeRunQuery(connection, query);
			if (result && result.rows && result.rows.length > 0) {
				for (let index = 0; index < result.rows[0].length; index++) {
					const column = result.rows[0][index];
					let content = column.displayValue;
					content = content.startsWith('0x') || content.startsWith('0X') ? content.substr(2) : content;
					fileContent = fileContent + content;
				}

				return await utils.writeFileFromHex(fileContent);
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
	public async deployLocalModel(filePath: string, details: ImportedModelDetails | undefined, table: DatabaseTable) {
		let connection = await this.getCurrentConnection();
		if (connection && table.databaseName) {

			await this.configureImport(connection, table);
			let currentModels = await this.getDeployedModels(table);
			const content = await utils.readFileInHex(filePath);
			let modelToAdd: ImportedModel = Object.assign({}, {
				id: 0,
				content: content,
				table: table
			}, details);
			await this._queryRunner.runWithDatabaseChange(connection, queries.getInsertModelQuery(modelToAdd, table), table.databaseName);

			let updatedModels = await this.getDeployedModels(table);
			if (updatedModels.length < currentModels.length + 1) {
				throw Error(constants.importModelFailedError(details?.modelName, filePath));
			}

		} else {
			throw new Error(constants.noConnectionError);
		}
	}

	/**
	 * Updates a model
	 */
	public async updateModel(model: ImportedModel) {
		let connection = await this.getCurrentConnection();
		if (connection && model && model.table && model.table.databaseName) {
			await this._queryRunner.runWithDatabaseChange(connection, queries.getUpdateModelQuery(model), model.table.databaseName);
		} else {
			throw new Error(constants.noConnectionError);
		}
	}

	/**
	 * Updates a model
	 */
	public async deleteModel(model: ImportedModel) {
		let connection = await this.getCurrentConnection();
		if (connection && model && model.table && model.table.databaseName) {
			await this._queryRunner.runWithDatabaseChange(connection, queries.getDeleteModelQuery(model), model.table.databaseName);
		} else {
			throw new Error(constants.noConnectionError);
		}
	}

	public async configureImport(connection: azdata.connection.ConnectionProfile, table: DatabaseTable) {
		if (connection && table.databaseName) {
			let query = queries.getDatabaseConfigureQuery(table);
			await this._queryRunner.safeRunQuery(connection, query);

			query = queries.getConfigureTableQuery(table);
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
				const query = queries.getConfigTableVerificationQuery(table);
				const result = await this._queryRunner.runWithDatabaseChange(connection, query, table.databaseName);
				return result !== undefined && result.rows.length > 0 && result.rows[0][0].displayValue === '1';
			} else {
				return true;
			}
		} else {
			throw new Error(constants.noConnectionError);
		}
	}

	/**
	 * Installs the dependencies required for model management
	 */
	public async installDependencies(): Promise<void> {
		await this._modelClient.installDependencies();
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

	private loadModelData(row: azdata.DbCellValue[], table: DatabaseTable): ImportedModel {
		return {
			id: +row[0].displayValue,
			modelName: row[1].displayValue,
			description: row[2].displayValue,
			version: row[3].displayValue,
			created: row[4].displayValue,
			framework: row[5].displayValue,
			frameworkVersion: row[6].displayValue,
			deploymentTime: row[7].displayValue,
			deployedBy: row[8].displayValue,
			runId: row[9].displayValue,
			contentLength: +row[10].displayValue,
			table: table
		};
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}
}
