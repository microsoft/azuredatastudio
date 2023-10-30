/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

/**
 * Data model to communicate between DacFx pages
 */
export interface DacFxDataModel {
	server: azdata.connection.ConnectionProfile;
	database: string;
	serverName: string;
	serverId: string;
	filePath: string;
	version: string;
	upgradeExisting: boolean;
	potentialDataLoss?: boolean;
}
