/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AddSqlBindingParams, GetAzureFunctionsParams, GetAzureFunctionsResult, ResultStatus } from 'sql-bindings';
import { RequestType } from 'vscode-languageclient';

/**
 * Adds a SQL Binding to a specified Azure function in a file
 */
export namespace AddSqlBindingRequest {
	export const type = new RequestType<AddSqlBindingParams, ResultStatus, void, void>('azureFunctions/sqlBinding');
}

/**
 * Gets the names of the Azure functions in a file
 */
export namespace GetAzureFunctionsRequest {
	export const type = new RequestType<GetAzureFunctionsParams, GetAzureFunctionsResult, void, void>('azureFunctions/getAzureFunctions');
}

// ------------------------------- < Execute String > ------------------------------------

// source: https://github.com/microsoft/azuredatastudio/blob/main/src/sql/azdata.d.ts#L1021
export interface SimpleExecuteParams {
	queryString: string;
	ownerUri: string;
}

/**
 * Simple Query Execute Result will return rowCount, columnInfo, and rows from STS request
 * source: https://github.com/microsoft/azuredatastudio/blob/main/src/sql/azdata.d.ts#L1026
 * rowCount is the number of rows returned with resultset
 * columnInfo is the details about the columns that are povided as solutions
 * rows is a 2D array of the cell values from the resultset
 */
export interface SimpleExecuteResult {
	rowCount: number;
	columnInfo: IDbColumn[];
	rows: DbCellValue[][];
}

// source: https://github.com/microsoft/sqlops-dataprotocolclient/blob/main/src/protocol.ts#L437
export namespace SimpleExecuteRequest {
	export const type = new RequestType<SimpleExecuteParams, SimpleExecuteResult, void, void>('query/simpleexecute');
}

// source: https://github.com/microsoft/azuredatastudio/blob/main/src/sql/azdata.d.ts#L907
export interface IDbColumn {
	allowDBNull?: boolean | undefined;
	baseCatalogName: string;
	baseColumnName: string;
	baseSchemaName: string;
	baseServerName: string;
	baseTableName: string;
	columnName: string;
	columnOrdinal?: number | undefined;
	columnSize?: number | undefined;
	isAliased?: boolean | undefined;
	isAutoIncrement?: boolean | undefined;
	isExpression?: boolean | undefined;
	isHidden?: boolean | undefined;
	isIdentity?: boolean | undefined;
	isKey?: boolean | undefined;
	isBytes?: boolean | undefined;
	isChars?: boolean | undefined;
	isSqlVariant?: boolean | undefined;
	isUdt?: boolean | undefined;
	dataType: string;
	isXml?: boolean | undefined;
	isJson?: boolean | undefined;
	isLong?: boolean | undefined;
	isReadOnly?: boolean | undefined;
	isUnique?: boolean | undefined;
	numericPrecision?: number | undefined;
	numericScale?: number | undefined;
	udtAssemblyQualifiedName: string;
	dataTypeName: string;
}

// source: https://github.com/microsoft/azuredatastudio/blob/main/src/sql/azdata.d.ts#L1066
export interface DbCellValue {
	displayValue: string;
	isNull: boolean;
	invariantCultureDisplayValue: string;
}
