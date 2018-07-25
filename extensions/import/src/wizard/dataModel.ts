// this is a data model to store all the stuff we'll need for getting data back from prose and things like that

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { PROSEDiscoveryResponse, ColumnInfo } from '../services/contracts';

export interface ImportDataModel {
	ownerUri: string;
	fileConfigData: Map<string, string>;
	proseColumns: ColumnMetadata[];
	proseDataPreview: string[][];
	server: sqlops.connection.Connection;
	database: string;
	table: string;
	schema: string;
	filePath: string;
}
export interface ColumnMetadata {
	columnName: string;
	dataType: string;
	primaryKey: boolean;
	nullable: boolean;
}
