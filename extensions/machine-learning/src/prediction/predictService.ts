/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ApiWrapper } from '../common/apiWrapper';
import { QueryRunner } from '../common/queryRunner';
import * as utils from '../common/utils';
import { ImportedModel } from '../modelManagement/interfaces';
import { PredictParameters, DatabaseTable, TableColumn } from '../prediction/interfaces';
import * as queries from './queries';

/**
 * Service to make prediction
 */
export class PredictService {

	/**
	 * Creates new instance
	 */
	constructor(
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner) {
	}

	/**
	 * Returns the list of databases
	 */
	public async getDatabaseList(): Promise<string[]> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return await this._apiWrapper.listDatabases(connection.connectionId);
		}
		return [];
	}

	/**
	 * Returns true if server supports ONNX
	 */
	public async serverSupportOnnxModel(): Promise<boolean> {
		try {
			let connection = await this.getCurrentConnection();
			if (connection) {
				const serverInfo = await this._apiWrapper.getServerInfo(connection.connectionId);
				// Right now only Azure SQL Edge and MI support Onnx
				//
				return serverInfo && (serverInfo.engineEditionId === 9 || serverInfo.engineEditionId === 8);
			}
			return false;
		} catch (error) {
			console.log(error);
			return false;
		}
	}

	/**
	 * Generates prediction script given model info and predict parameters
	 * @param predictParams predict parameters
	 * @param registeredModel model parameters
	 */
	public async generatePredictScript(
		predictParams: PredictParameters,
		registeredModel: ImportedModel | undefined,
		filePath: string | undefined
	): Promise<string> {
		let connection = await this.getCurrentConnection();
		let query = '';
		if (registeredModel && registeredModel.id) {
			query = queries.getPredictScriptWithModelId(
				registeredModel.id,
				predictParams.inputColumns || [],
				predictParams.outputColumns || [],
				predictParams,
				registeredModel.table);
		} else if (filePath) {
			let modelBytes = await utils.readFileInHex(filePath || '');
			query = queries.getPredictScriptWithModelBytes(modelBytes, predictParams.inputColumns || [],
				predictParams.outputColumns || [],
				predictParams);
		}
		const document = await azdata.queryeditor.openQueryDocument({ content: query });
		await this._apiWrapper.connect(document.uri.toString(), connection.connectionId);
		this._apiWrapper.runQuery(document.uri.toString(), undefined, false);
		return query;
	}

	/**
	 * Returns list of tables given database name
	 * @param databaseName database name
	 */
	public async getTableList(databaseName: string): Promise<DatabaseTable[]> {
		let connection = await this.getCurrentConnection();
		let list: DatabaseTable[] = [];
		if (connection) {
			let query = utils.getScriptWithDBChange(connection.databaseName, databaseName, queries.getTablesScript(databaseName));
			let result = await this._queryRunner.safeRunQuery(connection, query);
			if (result && result.rows && result.rows.length > 0) {
				result.rows.forEach(row => {
					list.push({
						databaseName: databaseName,
						tableName: row[0].displayValue,
						schema: row[1].displayValue
					});
				});
			}
		}
		return list;
	}

	/**
	 *Returns list of column names of a database
	 * @param databaseTable table info
	 */
	public async getTableColumnsList(databaseTable: DatabaseTable): Promise<TableColumn[]> {
		let connection = await this.getCurrentConnection();
		let list: TableColumn[] = [];
		if (connection && databaseTable.databaseName) {
			const query = utils.getScriptWithDBChange(connection.databaseName, databaseTable.databaseName, queries.getTableColumnsScript(databaseTable));
			let result = await this._queryRunner.safeRunQuery(connection, query);
			if (result && result.rows && result.rows.length > 0) {
				result.rows.forEach(row => {
					list.push({
						columnName: row[0].displayValue,
						dataType: row[1].displayValue.toLocaleUpperCase(),
						maxLength: row[2].isNull ? undefined : +row[2].displayValue.toLocaleUpperCase()
					});
				});
			}
		}
		return list;
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}
}

