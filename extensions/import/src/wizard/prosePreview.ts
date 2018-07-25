/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';
import { create } from 'domain';
//import { FlatFileProvider } from '../../out/services/contracts';
import { ImportDataModel } from './dataModel';

var fileDelimiter = ',';

export async function prosePreview(view: sqlops.ModelView, model: ImportDataModel) : Promise<void> {
	//from services sample placeholder code
	//let formWrapper = view.modelBuilder.loadingComponent().component();
	let table = await createTable(view, model.proseDataPreview);
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

async function createTable(view: sqlops.ModelView, tableData: string[][]) : Promise<sqlops.TableComponent> {
	let columns = tableData[0];
	let rows;
	let rowsLength = tableData.length;

	if(rowsLength > 50){
		rows = tableData.slice(1,50);
	}
	else{
		rows = tableData.slice(1, rowsLength);
	}

	let table = view.modelBuilder.table().withProperties({
			data: rows,
			columns: columns,
			height: 700,
			width: 700,
        }).component();

	return Promise.resolve(table);
}



var data =
	[
		['created_utc','score','domain','id'],
		['1370264768.0','674','twitter.com','1fktz4'],
		['1370264798.0','675','twitter.com','2gatz4'],
		['1370264768.0','676','twitter.com','1fkrzf']
	];

