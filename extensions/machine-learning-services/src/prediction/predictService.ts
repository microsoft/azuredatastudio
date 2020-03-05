/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ApiWrapper } from '../common/apiWrapper';
import { QueryRunner } from '../common/queryRunner';
import * as utils from '../common/utils';
import { RegisteredModel, PredictParameters, PredictColumn, DatabaseTable } from '../modelManagement/interfaces';
import { Config } from '../configurations/config';
//import * as constants from '../common/constants';

/**
 * Service to registered models
 */
export class PredictService {

	/**
	 *
	 */
	constructor(
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
		private _config: Config) {
	}

	public async getDatabaseList(): Promise<string[]> {
		let connection = await this.getCurrentConnection();
		if (connection) {
			return await this._apiWrapper.listDatabases(connection.connectionId);
		}
		return [];
	}

	public async generatePredictScript(
		predictParams: PredictParameters,
		registeredMode: RegisteredModel
	): Promise<string> {
		let connection = await this.getCurrentConnection();
		let query = '';
		if (registeredMode.id) {
			query = this.getPredictScriptWithModelId(
				registeredMode.id || 0,
				predictParams.inputColumns || [],
				predictParams.outputColumns || [],
				predictParams.databaseName || '',
				predictParams.tableName || '');
		} else {
			let modelBytes = await utils.readFileInHex(registeredMode.filePath || '');
			query = this.getPredictScriptWithModelBytes(modelBytes, predictParams.inputColumns || [],
				predictParams.outputColumns || [],
				predictParams);
		}
		let document = await this._apiWrapper.openTextDocument({
			language: 'sql',
			content: query
		});
		await this._apiWrapper.showTextDocument(document.uri);
		await this._apiWrapper.connect(document.uri.toString(), connection.connectionId);
		this._apiWrapper.runQuery(document.uri.toString());

		return query;
	}

	public async getTableList(databaseName: string): Promise<DatabaseTable[]> {
		let connection = await this.getCurrentConnection();
		let list: DatabaseTable[] = [];
		if (connection) {
			let query = this.withDbChange(connection.databaseName, databaseName, this.getTablesScript(databaseName));
			let result = await this.safeRunQuery(connection, query);
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

	public async getTableColumnsList(databaseTable: DatabaseTable): Promise<string[]> {
		let connection = await this.getCurrentConnection();
		let list: string[] = [];
		if (connection && databaseTable.databaseName) {
			const query = this.withDbChange(connection.databaseName, databaseTable.databaseName, this.getTableColumnsScript(databaseTable));
			let result = await this.safeRunQuery(connection, query);
			if (result && result.rows && result.rows.length > 0) {
				result.rows.forEach(row => {
					list.push(row[0].displayValue);
				});
			}
		}
		return list;
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	private withDbChange(currentDb: string, databaseName: string, script: string): string {
		if (!currentDb) {
			currentDb = 'master';
		}
		let escapedDbName = utils.doubleEscapeSingleBrackets(databaseName);
		let escapedCurrentDbName = utils.doubleEscapeSingleBrackets(currentDb);
		return `
		USE [${escapedDbName}]
		${script}
		USE [${escapedCurrentDbName}]
		`;
	}

	private async safeRunQuery(connection: azdata.connection.ConnectionProfile, query: string): Promise<azdata.SimpleExecuteResult | undefined> {
		try {
			return await this._queryRunner.runQuery(connection, query);
		} catch {
			return undefined;
		}
	}

	private getTableColumnsScript(databaseTable: DatabaseTable): string {
		return `
		SELECT COLUMN_NAME,*
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='${databaseTable.tableName}' AND TABLE_SCHEMA='${databaseTable.schema}' AND TABLE_CATALOG='${databaseTable.databaseName}'
		`;
	}

	private getTablesScript(databaseName: string): string {
		return `
		SELECT TABLE_NAME,TABLE_SCHEMA
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG='${databaseName}'
		`;
	}

	private getPredictScriptWithModelId(
		modelId: number,
		columns: PredictColumn[],
		outputColumns: PredictColumn[],
		databaseName: string,
		tableName: string): string {
		return `
DECLARE @model VARBINARY(max) = (
	SELECT artifact_content
	FROM [${this._config.registeredModelDatabaseName}].${this._config.registeredModelTableSchemaName}.[${this._config.registeredModelTableName}]
	WHERE artifact_id = ${modelId}
);
WITH predict_input
AS (
	SELECT TOP 1000
	${this.getColumnNames(columns, 'pi')}
	FROM [${databaseName}].[dbo].[${tableName}] as pi
)
SELECT
${this.getInputColumnNames(columns, 'predict_input')}, ${this.getColumnNames(outputColumns, 'p')}
FROM PREDICT(MODEL = @model, DATA = predict_input)
WITH (
	${this.getColumnTypes(outputColumns)}
) AS p
`;
	}

	private getPredictScriptWithModelBytes(
		modelBytes: string,
		columns: PredictColumn[],
		outputColumns: PredictColumn[],
		databaseNameTable: DatabaseTable): string {
		return `
WITH predict_input
AS (
	SELECT TOP 1000
	${this.getColumnNames(columns, 'pi')}
	FROM [${databaseNameTable.databaseName}].[${databaseNameTable.schema}].[${databaseNameTable.tableName}] as pi
)
SELECT
${this.getInputColumnNames(columns, 'predict_input')}, ${this.getColumnNames(outputColumns, 'p')}
FROM PREDICT(MODEL = ${modelBytes}, DATA = predict_input)
WITH (
	${this.getColumnTypes(outputColumns)}
) AS p
`;
	}

	private getColumnNames(columns: PredictColumn[], tableName: string) {
		return columns.map(c => {
			return c.displayName ? `${tableName}.${c.name} AS ${c.displayName}` : `${tableName}.${c.name}`;
		}).join(',\n');
	}
	private getInputColumnNames(columns: PredictColumn[], tableName: string) {
		return columns.map(c => {
			return c.displayName ? `${tableName}.${c.displayName}` : `${tableName}.${c.name}`;
		}).join(',\n');
	}

	private getColumnTypes(columns: PredictColumn[]) {
		return columns.map(c => {
			return `${c.name} ${c.dataType}`;
		}).join(',\n');
	}
}

