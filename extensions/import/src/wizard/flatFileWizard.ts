/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as vscode from 'vscode';
import * as path from 'path';
import * as sqlops from 'sqlops';
import { fileConfig } from './fileConfig';
import { prosePreview } from './prosePreview';
import { modifyColumns } from './modifyColumns';
import { summary } from './summary';
import { FlatFileProvider } from '../services/contracts';

export function flatFileWizard(provider: FlatFileProvider) {
	let wizard = sqlops.window.modelviewdialog.createWizard('Flat file import wizard');
		let page1 = sqlops.window.modelviewdialog.createWizardPage('New Table Details');
		let page2 = sqlops.window.modelviewdialog.createWizardPage('Preview Data');
		let page3 = sqlops.window.modelviewdialog.createWizardPage('Modify Columns');
		let page4 = sqlops.window.modelviewdialog.createWizardPage('Summary');
		page1.registerContent(async (view) => {
			await fileConfig(view);
		});
		page2.registerContent(async (view) => {
			await prosePreview(view);
		});
		page3.registerContent(async (view) => {
			await modifyColumns(view);
		});
		let importAnotherFileButton = sqlops.window.modelviewdialog.createButton('Import another file');
		importAnotherFileButton.onClick(() => wizard.setCurrentPage(0));
		page4.customButtons = [importAnotherFileButton];
		page4.registerContent(async (view) => {
			await summary(view, importInfo);
		});

		wizard.onPageChanged(e => {
			if (e.lastPage === 2 && e.newPage === 3) {
				importInfo.set('importResult', importData());
			}
		});

		wizard.registerOperation({
			displayName: 'test task',
			description: 'task description',
			connection: null,
			isCancelable: true,
			operation: (op) => {
			op.updateStatus(sqlops.TaskStatus.InProgress);
			op.updateStatus(sqlops.TaskStatus.InProgress, 'Task is running');
			setTimeout(() => {
				op.updateStatus(sqlops.TaskStatus.Succeeded);
			}, 5000);
		}});

		//not needed for this wizard
		wizard.generateScriptButton.hidden = true;

		wizard.pages = [page1, page2, page3, page4];
		wizard.open();
}

async function importData() : Promise<boolean> {
	return new Promise<boolean>(resolve =>
		setTimeout(() => {
			console.log('hi');
			resolve(true);
		},
		2000));
}

//pageonecontent()
