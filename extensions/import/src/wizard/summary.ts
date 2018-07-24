/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';

export async function summary(view: sqlops.ModelView) : Promise<void> {

	let table = view.modelBuilder.table()
		.withProperties({
			data: [['Database name', 'test'],
				['Table schema','dbo'],
				['File to be imported', 'test file']],
			columns: ['Object type', 'Name'],
			height: 250,
			width: 500
		})
		.component();

	let statusText = view.modelBuilder.text()
		.withProperties({
			value: '✔ Awesome! You have successfully inserted the data into a table.'
		})
		.component();

	let formModel = view.modelBuilder.formContainer()
		.withFormItems(
			[
				{
					component: table,
					title: 'Import information'
				},
				{
					component: statusText,
					title: 'Status'
				}
			]
		).component();
	let formWrapper = view.modelBuilder.loadingComponent().withItem(formModel).component();
	formWrapper.loading = false;
	await view.initializeModel(formWrapper);
}