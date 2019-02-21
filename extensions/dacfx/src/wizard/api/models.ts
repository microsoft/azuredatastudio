/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';

/**
 * Data model to communicate between DacFx pages
 */
export interface DacFxDataModel {
	server: sqlops.connection.Connection;
	database: string;
	serverName: string;
	serverId: string;
	filePath: string;
	version: string;
	upgradeExisting: boolean;
	scriptFilePath: string;
	generateScriptAndDeploy: boolean;
}
