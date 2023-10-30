/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as mssql from 'mssql';
import * as vscodeMssql from 'vscode-mssql';

type ExtractTarget = mssql.ExtractTarget | vscodeMssql.ExtractTarget;

/**
 * Data model to communicate for Import API
 */
export interface ImportDataModel {
	connectionUri: string;
	database: string;
	projName: string;
	filePath: string;
	version: string;
	extractTarget: ExtractTarget;
	sdkStyle: boolean;
	includePermissions?: boolean;
}
