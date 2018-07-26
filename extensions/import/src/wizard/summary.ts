/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';
import { ImportDataModel } from './api/dataModel';
import { DeferredPromise } from './flatFileWizard';
import { InsertDataResponse } from '../services/contracts';

let model : ImportDataModel;

export async function summary(view: sqlops.ModelView, m: ImportDataModel, wizard: sqlops.window.modelviewdialog.Wizard, importDataStatusPromise: DeferredPromise<InsertDataResponse>) : Promise<void> {
	model = m;

	let table = view.modelBuilder.table()
		.component();

	let statusText = view.modelBuilder.text()
		.component();

	let statusLoader = view.modelBuilder.loadingComponent().withItem(statusText).component();

	let importPromise = importDataStatusPromise.promise;
	if (importPromise) {
		importPromise.then(result => {
			let updateText: string;
			if (result.result.success) {
				let numRowsInserted = getCountRowsInserted();
				if (numRowsInserted > 0) {
					updateText = `✔ Awesome! You have successfully inserted ${numRowsInserted} rows.`;
				} else {
					updateText = '✔ Awesome! You have successfully inserted the data into a table.';
				}

			} else {
				updateText = '✗ ' + result.result.errorMessage;
			}

			statusText.updateProperties({
				value: updateText
			});
			statusLoader.loading = false;
		})
			.catch((error) => {
				statusText.updateProperties({
					value: '✗ Error'
				});
				statusLoader.loading = false;
			});
	}

	let formModel = view.modelBuilder.formContainer().withFormItems(
		[
			{
				component: table,
				title: 'Import information'
			},
			{
				component: statusLoader,
				title: 'Import Status'
			}
		]
	);

	wizard.onPageChanged(e => {
		if (e.lastPage === 2 && e.newPage === 3) {
			populateTable(table);
		}
	});

	await view.initializeModel(formModel.component());
}

function populateTable(tableComponent: sqlops.TableComponent) {
	tableComponent.updateProperties({
		data: [
			['Server name', model.server.providerName],
			['Database name', model.database],
			['Table name', model.table],
			['Table schema', model.schema],
			['File to be imported', model.filePath]],
		columns: ['Object type', 'Name'],
		width: 600,
		height: 200
	});
}

function getCountRowsInserted() : number {
	let queryProvider = sqlops.dataprotocol.getProvider<sqlops.QueryProvider>(model.server.providerName, sqlops.DataProviderType.QueryProvider);
	let results: sqlops.SimpleExecuteResult;

	try {

		let query = `USE ${model.database}; SELECT COUNT(*) FROM ${model.table}`;
		queryProvider.runQueryAndReturn(model.server.connectionId, query).then((r) => {
			results = r;
		});
		let cell =  results.rows[0][0];
		if (!cell || cell.isNull) {
			return -1;
		}
		let numericCell = Number(cell.displayValue);
		if (numericCell === NaN) {
			return -1;
		}
		return numericCell;
	} catch (e) {
		return -1;
	}
}
