/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

import { FileNode } from '../../../hdfsProvider';
import { ColumnDefinition, DataSourceInstance } from '../../../services/contracts';

/**
 * The main data model that communicates between the pages.
 */
export interface ImportDataModel {
	proseColumns: ColumnDefinition[];
	proseDataPreview: string[][];
	serverConn: azdata.connection.ConnectionProfile;
	sessionId: string;
	allDatabases: string[];
	versionInfo: {
		serverMajorVersion: number;
		productLevel: string;
	};
	database: string;
	existingDataSource: string;
	newDataSource: DataSourceInstance;
	table: string;
	fileFormat: string;
	existingSchema: string;
	newSchema: string;
	parentFile: {
		isFolder: boolean;
		filePath: string;
	};
	proseParsingFile: FileNode;
	fileType: string;
	columnDelimiter: string;
	firstRow: number;
	quoteCharacter: string;
}
