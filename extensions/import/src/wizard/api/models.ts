/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';

/**
 * The main data model that communicates between the pages.
 */
export interface ImportDataModel {
	ownerUri: string;
	proseColumns: ColumnMetadata[];
	proseDataPreview: string[][];
	server: sqlops.connection.Connection;
	serverId: string;
	database: string;
	table: string;
	schema: string;
	filePath: string;
	fileType: string;
}

/**
 * Metadata of a column
 */
export interface ColumnMetadata {
	columnName: string;
	dataType: string;
	primaryKey: boolean;
	nullable: boolean;
}

/**
 * Data model to communicate between DacFx pages
 */
export interface DacFxDataModel {
	serverConnection: sqlops.connection.Connection;
	serverName: string;
	serverId: string;
	databaseName: string;
	filePath: string;
}