/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { ApiWrapper } from '../common/apiWrapper';
import { QueryRunner } from '../common/queryRunner';
import * as utils from '../common/utils';
import { ImportedModel } from '../modelManagement/interfaces';
import { PredictParameters, PredictColumn, DatabaseTable, TableColumn } from '../prediction/interfaces';

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
			query = this.getPredictScriptWithModelId(
				registeredModel.id,
				predictParams.inputColumns || [],
				predictParams.outputColumns || [],
				predictParams,
				registeredModel.table);
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
		await this._apiWrapper.executeCommand('vscode.open', document.uri);
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
		sourceTable: DatabaseTable,
		importTable: DatabaseTable): string {
		const threePartTableName = utils.getRegisteredModelsThreePartsName(importTable.databaseName || '', importTable.tableName || '', importTable.schema || '');
		return `
DECLARE @model VARBINARY(max) = (
	SELECT model
	FROM ${threePartTableName}
	WHERE model_id = ${modelId}
);
WITH predict_input
AS (
	SELECT TOP 1000
	${this.getInputColumnNames(columns, 'pi')}
	FROM [${utils.doubleEscapeSingleBrackets(sourceTable.databaseName)}].[${sourceTable.schema}].[${utils.doubleEscapeSingleBrackets(sourceTable.tableName)}] as pi
)
SELECT
${this.getPredictColumnNames(columns, 'predict_input')},
${this.getPredictInputColumnNames(outputColumns, 'p')}
FROM PREDICT(MODEL = @model, DATA = predict_input, runtime=onnx)
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
${this.getPredictColumnNames(columns, 'predict_input')},
${this.getPredictInputColumnNames(outputColumns, 'p')}
FROM PREDICT(MODEL = ${modelBytes}, DATA = predict_input, runtime=onnx)
WITH (
	${this.getOutputParameters(outputColumns)}
) AS p
`;
	}

	private getEscapedColumnName(tableName: string, columnName: string): string {
		return `[${utils.doubleEscapeSingleBrackets(tableName)}].[${utils.doubleEscapeSingleBrackets(columnName)}]`;
	}
	private getInputColumnNames(columns: PredictColumn[], tableName: string) {

		return columns.map(c => {
			const column = this.getEscapedColumnName(tableName, c.columnName);
			let columnName = c.dataType !== c.paramType ? `cast(${column} as ${c.paramType})`
				: `${column}`;
			return `${columnName} AS ${c.paramName}`;
		}).join(',\n');
	}

	private getPredictInputColumnNames(columns: PredictColumn[], tableName: string) {
		return columns.map(c => {
			return this.getColumnName(tableName, c.paramName || '', c.columnName);
		}).join(',\n');
	}

	private getColumnName(tableName: string, columnName: string, displayName: string) {
		const column = this.getEscapedColumnName(tableName, columnName);
		return columnName && columnName !== displayName ?
			`${column} AS [${utils.doubleEscapeSingleBrackets(displayName)}]` : column;
	}

	private getPredictColumnNames(columns: PredictColumn[], tableName: string) {
		return columns.map(c => {
			return c.paramName ? `${this.getEscapedColumnName(tableName, c.paramName)}`
				: `${this.getEscapedColumnName(tableName, c.columnName)}`;
		}).join(',\n');
	}

	private getOutputParameters(columns: PredictColumn[]) {
		return columns.map(c => {
			return `${c.paramName} ${c.dataType}`;
		}).join(',\n');
	}
}

