/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as utils from '../common/utils';
import { PredictColumn, DatabaseTable } from './interfaces';
import * as constants from '../common/constants';

export function getTableColumnsScript(databaseTable: DatabaseTable): string {
	return `
SELECT COLUMN_NAME,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME='${utils.doubleEscapeSingleQuotes(databaseTable.tableName)}'
AND TABLE_SCHEMA='${utils.doubleEscapeSingleQuotes(databaseTable.schema)}'
AND TABLE_CATALOG='${utils.doubleEscapeSingleQuotes(databaseTable.databaseName)}'
	`;
}

export function getTablesScript(databaseName: string): string {
	return `
SELECT TABLE_NAME,TABLE_SCHEMA
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_CATALOG='${utils.doubleEscapeSingleQuotes(databaseName)}'
	`;
}

export function getPredictScriptWithModelId(
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
	${getInputColumnNames(columns, 'pi')}
FROM [${utils.doubleEscapeSingleBrackets(sourceTable.databaseName)}].[${sourceTable.schema}].[${utils.doubleEscapeSingleBrackets(sourceTable.tableName)}] AS pi
)
SELECT
${getPredictColumnNames(columns, 'predict_input')},
${getPredictInputColumnNames(outputColumns, 'p')}
FROM PREDICT(MODEL = @model, DATA = predict_input, runtime=onnx)
WITH (
${getOutputParameters(outputColumns)}
) AS p
`;
}

export function getPredictScriptWithModelBytes(
	modelBytes: string,
	columns: PredictColumn[],
	outputColumns: PredictColumn[],
	sourceTable: DatabaseTable): string {
	return `
WITH predict_input
AS (
	SELECT TOP 1000
	${getInputColumnNames(columns, 'pi')}
FROM [${utils.doubleEscapeSingleBrackets(sourceTable.databaseName)}].[${sourceTable.schema}].[${utils.doubleEscapeSingleBrackets(sourceTable.tableName)}] AS pi
)
SELECT
${getPredictColumnNames(columns, 'predict_input')},
${getPredictInputColumnNames(outputColumns, 'p')}
FROM PREDICT(MODEL = ${modelBytes}, DATA = predict_input, runtime=onnx)
WITH (
${getOutputParameters(outputColumns)}
) AS p
`;
}

export function getEscapedColumnName(tableName: string, columnName: string): string {
	return `[${utils.doubleEscapeSingleBrackets(tableName)}].[${utils.doubleEscapeSingleBrackets(columnName)}]`;
}

export function getInputColumnNames(columns: PredictColumn[], tableName: string) {

	return columns.map(c => {
		const column = getEscapedColumnName(tableName, c.columnName);
		const maxLength = c.maxLength !== undefined ? c.maxLength : constants.varcharDefaultLength;
		let paramType = c.paramType === constants.varcharMax ? `VARCHAR(${maxLength})` : c.paramType;
		let columnName = c.dataType !== c.paramType ? `CAST(${column} AS ${paramType})`
			: `${column}`;
		return `${columnName} AS ${c.paramName}`;
	}).join(',\n	');
}

export function getPredictInputColumnNames(columns: PredictColumn[], tableName: string) {
	return columns.map(c => {
		return getColumnName(tableName, c.paramName || '', c.columnName);
	}).join(',\n	');
}

export function getColumnName(tableName: string, columnName: string, displayName: string) {
	const column = getEscapedColumnName(tableName, columnName);
	return columnName && columnName !== displayName ?
		`${column} AS [${utils.doubleEscapeSingleBrackets(displayName)}]` : column;
}

export function getPredictColumnNames(columns: PredictColumn[], tableName: string) {
	return columns.map(c => {
		return c.paramName ? `${getEscapedColumnName(tableName, c.paramName)}`
			: `${getEscapedColumnName(tableName, c.columnName)}`;
	}).join(',\n');
}

export function getOutputParameters(columns: PredictColumn[]) {
	return columns.map(c => {
		return `${c.paramName} ${c.dataType}`;
	}).join(',\n');
}
