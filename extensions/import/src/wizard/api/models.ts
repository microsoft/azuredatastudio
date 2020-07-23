/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

/**
 * The main data model that communicates between the pages.
 */
export interface ImportDataModel {
	server: azdata.connection.Connection;
	serverId: string;
	ownerUri: string;
	proseColumns: ColumnMetadata[];
	proseDataPreview: string[][];
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

export type ColumnMetadataArray = (string | number | boolean)[];
