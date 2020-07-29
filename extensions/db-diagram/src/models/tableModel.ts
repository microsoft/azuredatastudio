/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import ITableModel from './ITableModel';
import ISqlRelationship from './ISqlRelationship';
import ISqlColumn from './ISqlColumn';

export default class TableModel implements ITableModel {

	name: string;
	summary: string;
	relationships: ISqlRelationship[];
	columns: ISqlColumn[];
	primaryKey: ISqlColumn[];
	foreignKeys: ISqlColumn[][];

	//constructor
	constructor(name: string, summary: string, relationships: ISqlRelationship[],
		columns: ISqlColumn[], primaryKey: ISqlColumn[],
		foreignKeys: ISqlColumn[][],) {
		this.name = name;
		this.summary = summary;
		this.relationships = relationships;
		this.columns = columns;
		this.primaryKey = primaryKey;
		this.foreignKeys = foreignKeys;
	}

}
