/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';
import { ImportDataModel } from './dataModel';
import { ImportDataStatusPromise } from './flatFileWizard';

let model : ImportDataModel;

export async function summary(view: sqlops.ModelView, m: ImportDataModel, wizard: sqlops.window.modelviewdialog.Wizard, importDataStatusPromise: ImportDataStatusPromise) : Promise<void> {
	model = m;

	let table = view.modelBuilder.table()
		.component();

	let statusText = view.modelBuilder.text()
		.component();

	let statusLoader = view.modelBuilder.loadingComponent().withItem(statusText).component();

	let importPromise = importDataStatusPromise.promise;
	if (importPromise) {
		importPromise.then(result => {
			if (result.result.success) {
				statusText.updateProperties({
					value: '✔ Awesome! You have successfully inserted the data into a table.'
				});
			} else {
				statusText.updateProperties({
					value: '✗ ' + result.result.errorMessage
				});
			}


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
		width: 400,
		height: 150
	});
}
