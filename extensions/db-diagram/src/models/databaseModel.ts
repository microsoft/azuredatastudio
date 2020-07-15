/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import IDatabaseModel from './IDatabaseModel';
import ITableModel from './ITableModel';

export default class DatabaseModel implements IDatabaseModel {

	name: string;
	summary: string;
	tables: ITableModel[];


	//constructor
	constructor(name: string, summary: string, tables: ITableModel[]) {
		this.name = name;
		this.summary = summary;
		this.tables = tables;
	}

	public getName(): string {
		return this.name;
	}

	public getSummary(): string {
		return this.summary;
	}

	public getTables(): ITableModel[] {
		return this.tables;
	}

}
