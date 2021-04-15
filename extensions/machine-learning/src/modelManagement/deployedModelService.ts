/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ApiWrapper } from '../common/apiWrapper';
import { Config } from '../configurations/config';
import { ImportedModel, ImportedModelDetails, ModelParameters } from './interfaces';
import { ModelPythonClient } from './modelPythonClient';
import * as constants from '../common/constants';
import { DatabaseTable } from '../prediction/interfaces';
import { ModelConfigRecent } from './modelConfigRecent';
import * as mssql from '../../../mssql';

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
		private _modelClient: ModelPythonClient,
		private _recentModelService: ModelConfigRecent,
		private _modelManagementService: mssql.IModelManagementService) {
	}

	/**
	 * Returns deployed models
	 */
	public async getDeployedModels(table: DatabaseTable): Promise<ImportedModel[]> {
		let connection = await this.getCurrentConnection();
		let list: ImportedModel[] = [];
		if (!table.databaseName || !table.tableName || !table.schemaName) {
			return [];
		}
		if (connection) {
			let connectionUri = await this._apiWrapper.getUriForConnection(connection.connectionId);
			let models = await this._modelManagementService.getModels(connectionUri, table);
			list = (await models).map(x => Object.assign({}, x, { table: table }));
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

			let connectionUri = await this._apiWrapper.getUriForConnection(connection.connectionId);
			fileContent = await this._modelManagementService.downloadModel(connectionUri, model.table, model.id);
			return fileContent;
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
			let modelToAdd: mssql.ModelMetadata = Object.assign({}, details, {
				id: 0,
				filePath: filePath,
				table: table
			});
			let connectionUri = await this._apiWrapper.getUriForConnection(connection.connectionId);
			await this._modelManagementService.configureModelTable(connectionUri, table);
			await this._modelManagementService.importModel(connectionUri, table, modelToAdd);

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
			let connectionUri = await this._apiWrapper.getUriForConnection(connection.connectionId);
			await this._modelManagementService.updateModel(connectionUri, model.table, model);
			//await this._queryRunner.runWithDatabaseChange(connection, queries.getUpdateModelQuery(model), model.table.databaseName);
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
			let connectionUri = await this._apiWrapper.getUriForConnection(connection.connectionId);
			await this._modelManagementService.deleteModel(connectionUri, model.table, model.id);
		} else {
			throw new Error(constants.noConnectionError);
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

				let connectionUri = await this._apiWrapper.getUriForConnection(connection.connectionId);
				return await this._modelManagementService.verifyModelTable(connectionUri, table);
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
					schemaName: this._config.registeredModelTableSchemaName
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

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}
}
