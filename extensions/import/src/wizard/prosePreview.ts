/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';
import { create } from 'domain';
import { FlatFileProvider } from '../../out/services/contracts';

var fileDelimiter = ',';

export async function prosePreview(view: sqlops.ModelView, provider : FlatFileProvider) : Promise<void> {
	//from services sample placeholder code
	//let formWrapper = view.modelBuilder.loadingComponent().component();
	let data;
	provider.sendDataPreviewRequest({ filePath: 'Hello World' }).then(response => {
		data = new DataObject(response.dataPreview[0], response.dataPreview.slice(1,response.dataPreview.length));
		//vscode.window.showInformationMessage('Response: ' + response.dataPreview);
	});
	let table = await createTable(view, data);
	let formModel = view.modelBuilder.formContainer()
		.withFormItems(
			[
			{
				component : table,
				title : 'This operation analyzed the input file structure to generate the preview below for up to the first 50 rows'
			}
		]
	).component();
	let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
	formWrapper.loading = false;
	await view.initializeModel(formWrapper);
}

async function createTable(view: sqlops.ModelView, tableData: IDataObject) : Promise<sqlops.TableComponent> {
	let columns = tableData.columns;
	let rows;
	let rowsLength = tableData.rows.length;

	if(rowsLength > 100){
		rows = tableData.rows.slice(0,100);
	}
	else{
		rows = tableData.rows;
	}

	let table = view.modelBuilder.table().withProperties({
			data: rows,
			columns: columns,
			height: 700,
			width: 700,
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

/*var data = new DataObject(
	['created_utc','score','domain','id'],
	[
		['1370264768.0','674','twitter.com','1fktz4'],
		['1370264798.0','675','twitter.com','2gatz4'],
		['1370264768.0','676','twitter.com','1fkrzf']
	]
);*/