/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ApiWrapper } from '../common/apiWrapper';
import { Config } from '../configurations/config';
import { QueryRunner } from '../common/queryRunner';
import { RegisteredModel } from './interfaces';
import { ModelImporter } from './modelImporter';

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
					list.push({
						id: +row[0].displayValue,
						name: row[1].displayValue
					});
				});
			}
		}
		return list;
	}

	public async registerLocalModel(filePath: string) {
		let connection = await this.getCurrentConnection();
		if (connection) {
			await this._modelImporter.registerModel(connection, filePath);
		}
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	private async runRegisteredModelsListQuery(connection: azdata.connection.ConnectionProfile): Promise<azdata.SimpleExecuteResult | undefined> {
		try {
			return await this._queryRunner.runQuery(connection, this.registeredModelsQuery(this._config.registeredModelDatabaseName, this._config.registeredModelTableName));
		} catch {
			return undefined;
		}
	}

	private registeredModelsQuery(databaseName: string, tableName: string) {
		return `
		IF (EXISTS (SELECT name
			FROM master.dbo.sysdatabases
			WHERE ('[' + name + ']' = '${databaseName}'
			OR name = '${databaseName}')))
		BEGIN
			SELECT artifact_id, artifact_name, group_path, artifact_initial_size from ${databaseName}.${tableName}
			WHERE artifact_name like '%.onnx'
		END
		`;
	}
}
