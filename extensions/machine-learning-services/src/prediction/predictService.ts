/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ApiWrapper } from '../common/apiWrapper';
import { QueryRunner } from '../common/queryRunner';
import * as utils from '../common/utils';
import { RegisteredModel } from '../modelManagement/interfaces';
import { PredictParameters, PredictColumn, DatabaseTable, TableColumn } from '../prediction/interfaces';
import { Config } from '../configurations/config';

/**
 * Service to make prediction
 */
export class PredictService {

	/**
	 * Creates new instance
	 */
	constructor(
		private _apiWrapper: ApiWrapper,
		private _queryRunner: QueryRunner,
		private _config: Config) {
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
	 * Generates prediction script given model info and predict parameters
	 * @param predictParams predict parameters
	 * @param registeredModel model parameters
	 */
	public async generatePredictScript(
		predictParams: PredictParameters,
		registeredModel: RegisteredModel | undefined,
		filePath: string | undefined
	): Promise<string> {
		let connection = await this.getCurrentConnection();
		let query = '';
		if (registeredModel && registeredModel.id) {
			query = this.getPredictScriptWithModelId(
				registeredModel.id,
				predictParams.inputColumns || [],
				predictParams.outputColumns || [],
				predictParams);
		} else if (filePath) {
			let modelBytes = await utils.readFileInHex(filePath || '');
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
			let query = utils.getScriptWithDBChange(connection.databaseName, databaseName, this.getTablesScript(databaseName));
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
			const query = utils.getScriptWithDBChange(connection.databaseName, databaseTable.databaseName, this.getTableColumnsScript(databaseTable));
			let result = await this._queryRunner.safeRunQuery(connection, query);
			if (result && result.rows && result.rows.length > 0) {
				result.rows.forEach(row => {
					list.push({
						columnName: row[0].displayValue,
						dataType: row[1].displayValue
					});
				});
			}
		}
		return list;
	}

	private async getCurrentConnection(): Promise<azdata.connection.ConnectionProfile> {
		return await this._apiWrapper.getCurrentConnection();
	}

	private getTableColumnsScript(databaseTable: DatabaseTable): string {
		return `
SELECT COLUMN_NAME,DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='${utils.doubleEscapeSingleQuotes(databaseTable.tableName)}'
AND TABLE_SCHEMA='${utils.doubleEscapeSingleQuotes(databaseTable.schema)}'
AND TABLE_CATALOG='${utils.doubleEscapeSingleQuotes(databaseTable.databaseName)}'
		`;
	}

	private getTablesScript(databaseName: string): string {
		return `
SELECT TABLE_NAME,TABLE_SCHEMA
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG='${utils.doubleEscapeSingleQuotes(databaseName)}'
		`;
	}

	private getPredictScriptWithModelId(
		modelId: number,
		columns: PredictColumn[],
		outputColumns: PredictColumn[],
		databaseNameTable: DatabaseTable): string {
		return `
DECLARE @model VARBINARY(max) = (
	SELECT artifact_content
	FROM ${utils.getRegisteredModelsThreePartsName(this._config)}
	WHERE artifact_id = ${modelId}
);
WITH predict_input
AS (
	SELECT TOP 1000
	${this.getInputColumnNames(columns, 'pi')}
	FROM [${utils.doubleEscapeSingleBrackets(databaseNameTable.databaseName)}].[${databaseNameTable.schema}].[${utils.doubleEscapeSingleBrackets(databaseNameTable.tableName)}] as pi
)
SELECT
${this.getPredictColumnNames(columns, 'predict_input')}, ${this.getInputColumnNames(outputColumns, 'p')}
FROM PREDICT(MODEL = @model, DATA = predict_input)
WITH (
	${this.getOutputParameters(outputColumns)}
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
	${this.getInputColumnNames(columns, 'pi')}
	FROM [${utils.doubleEscapeSingleBrackets(databaseNameTable.databaseName)}].[${databaseNameTable.schema}].[${utils.doubleEscapeSingleBrackets(databaseNameTable.tableName)}] as pi
)
SELECT
${this.getPredictColumnNames(columns, 'predict_input')}, ${this.getOutputColumnNames(outputColumns, 'p')}
FROM PREDICT(MODEL = ${modelBytes}, DATA = predict_input)
WITH (
	${this.getOutputParameters(outputColumns)}
) AS p
`;
	}

	private getInputColumnNames(columns: PredictColumn[], tableName: string) {
		return columns.map(c => {
			return this.getColumnName(tableName, c.paramName || '', c.columnName);
		}).join(',\n');
	}

	private getOutputColumnNames(columns: PredictColumn[], tableName: string) {
		return columns.map(c => {
			return this.getColumnName(tableName, c.columnName, c.paramName || '');
		}).join(',\n');
	}

	private getColumnName(tableName: string, columnName: string, displayName: string) {
		return columnName && columnName !== displayName ? `${tableName}.${columnName} AS ${displayName}` : `${tableName}.${columnName}`;
	}

	private getPredictColumnNames(columns: PredictColumn[], tableName: string) {
		return columns.map(c => {
			return c.paramName ? `${tableName}.${c.paramName}` : `${tableName}.${c.columnName}`;
		}).join(',\n');
	}

	private getOutputParameters(columns: PredictColumn[]) {
		return columns.map(c => {
			return `${c.paramName} ${c.dataType}`;
		}).join(',\n');
	}
}

