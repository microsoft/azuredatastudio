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
