/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';
import { create } from 'domain';

var fileDelimiter = ',';


export async function prosePreview(view: sqlops.ModelView) : Promise<void> {
	//from services sample placeholder code
	//let formWrapper = view.modelBuilder.loadingComponent().component();

	let table = await createTable(view);
	let formModel = view.modelBuilder.formContainer()
		.withFormItems(
			[
			{
				component : table,
				title : 'Preview'
			}
		]).component();
	let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
	formWrapper.loading = false;

	await view.initializeModel(formWrapper);
}

async function createTable(view: sqlops.ModelView) : Promise<sqlops.TableComponent> {
	let table = view.modelBuilder.table().withProperties({
			data: data.rows,
			columns: data.columns,
			height: 250,
			width: 750,
            selectedRows: [0]
        }).component();

	return Promise.resolve(table);
}

interface IDataObject {
	columns: string[];
	rows: string[][];
}

class DataObject implements IDataObject{
	columns: string[];
	rows: string[][];

	constructor(columns: string[], rows: string[][]){
		this.columns = columns;
		this.rows = rows;
	}
}

var data = new DataObject(
	['created_utc','score','domain','id','title'],
	[
		['1370264768.0','674','twitter.com','1fktz4'],
		['1370264798.0','675','twitter.com','2gatz4'],
		['1370264768.0','676','twitter.com','1fkrzf']
	]
);