/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExtractTarget } from '../../../../mssql';

/**
 * Data model to communicate for Import API
 */
export interface ImportDataModel {
	serverId: string;
	database: string;
	projName: string;
	filePath: string;
	version: string;
	extractTarget: ExtractTarget;
}
