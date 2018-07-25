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
import { FlatFileProvider, InsertDataResponse } from '../services/contracts';
import {ImportDataModel} from './dataModel';

export async function flatFileWizard(provider: FlatFileProvider) {
  let model = <ImportDataModel>{};
	let importDataStatusPromise = importDataStatus();
	// TODO localize this
	let connections = await sqlops.connection.getActiveConnections();
	if (!connections || connections.length === 0) {
		vscode.window.showErrorMessage('Please connect to a server before using this wizard.');
		return;
	}

	let wizard = sqlops.window.modelviewdialog.createWizard('Flat file import wizard');
	let page1 = sqlops.window.modelviewdialog.createWizardPage('New Table Details');
	let page2 = sqlops.window.modelviewdialog.createWizardPage('Preview Data');
	let page3 = sqlops.window.modelviewdialog.createWizardPage('Modify Columns');
	let page4 = sqlops.window.modelviewdialog.createWizardPage('Summary');

		page1.registerContent(async (view) => {
			await fileConfig(view, model);
		});
		page2.registerContent(async (view) => {
			await prosePreview(view, model);
		});
		page3.registerContent(async (view) => {
			await modifyColumns(view, model);
		});
		page4.registerContent(async (view) => {
			await summary(view,model, importDataStatusPromise);
		});

	let importAnotherFileButton = sqlops.window.modelviewdialog.createButton('Import new file');
	importAnotherFileButton.onClick(() => {
		//TODO replace this with proper cleanup for all the pages
		wizard.close();
		flatFileWizard(provider);
	});
	importAnotherFileButton.hidden = true;
	wizard.customButtons = [importAnotherFileButton];

	wizard.onPageChanged(e => {
		if (e.lastPage === 2 && e.newPage === 3) {
			provider.sendInsertDataRequest({
				//TODO find a way to get the connection string
				connectionString: '',
				//TODO check what SSMS uses as batch size
				batchSize: 500
			}).then((response) => {
				importAnotherFileButton.hidden = false;
				setTimeout(() => importDataStatusPromise.resolve(response), 3000);
			});

		}

		if (e.lastPage === 3 && e.newPage !== 3) {
			importAnotherFileButton.hidden = true;
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
		}
	});

	//not needed for this wizard
	wizard.generateScriptButton.hidden = true;

	wizard.pages = [page1, page2, page3, page4];
	wizard.open();
}

//TODO put in a different file with other interfaces
export interface ImportDataStatusPromise {
	promise: Promise<InsertDataResponse>;
	resolve: (value: InsertDataResponse | PromiseLike<InsertDataResponse>) => void;
	reject: (reason?: any) => void;
}

function importDataStatus(): ImportDataStatusPromise {
	let outResolve, outReject;
	return {
		promise: new Promise<InsertDataResponse>((resolve, reject) => {
			outResolve = resolve;
			outReject = reject;
		}),
		resolve: outResolve,
		reject: outReject
	};
}
