/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
export interface SimpleExecuteParams {
	queryString: string;
	ownerUri: string;
}

/**
 * Simple Query Execute Result will return rowCount, columnInfo, and rows from STS request
 * rowCount is the number of rows returned with resultset
 * columnInfo is the details about the columns that are povided as solutions
 * rows is a 2D array of the cell values from the resultset
 */
export interface SimpleExecuteResult {
	rowCount: number;
	columnInfo: any;
	rows: any;
}

export namespace SimpleExecuteRequest {
	export const type = new RequestType<SimpleExecuteParams, SimpleExecuteResult, void, void>('query/simpleexecute');
}


