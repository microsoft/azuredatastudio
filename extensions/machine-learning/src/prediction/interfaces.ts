/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface TableColumn {
	columnName: string;
	dataType?: string;
}

export interface PredictColumn extends TableColumn {
	paramName?: string;
	paramType?: string;
}

export interface DatabaseTable {
	databaseName: string | undefined;
	tableName: string | undefined;
	schema: string | undefined
}

export interface PredictInputParameters extends DatabaseTable {
	inputColumns: PredictColumn[] | undefined
}

export interface PredictParameters extends PredictInputParameters {
	outputColumns: PredictColumn[] | undefined
}
