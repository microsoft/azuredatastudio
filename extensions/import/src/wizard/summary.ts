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

export async function summary(view: sqlops.ModelView, model: ImportDataModel, importDataStatusPromise: ImportDataStatusPromise) : Promise<void> {
	let table = view.modelBuilder.table()
		.withProperties({
			data: [['Database name', ''],
			['Table schema', ''],
			['File to be imported', '']],
			columns: ['Object type', 'Name'],
			width: 400,
			height: 150
		})
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
	await view.initializeModel(formModel.component());
}
