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
import { FlatFileProvider, InsertDataResponse, PROSEDiscoveryResponse } from '../services/contracts';
import {ImportDataModel} from './dataModel';

export async function flatFileWizard(provider: FlatFileProvider) {
  	let model = <ImportDataModel>{};
	let importDataStatusPromise = deferredPromise<InsertDataResponse>();
	let previewReadyPromise = deferredPromise<PROSEDiscoveryResponse>();
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
			await prosePreview(view, model, previewReadyPromise);
		});
		page3.registerContent(async (view) => {
			await modifyColumns(view, model, previewReadyPromise);
		});
		page4.registerContent(async (view) => {
			await summary(view,model, wizard, importDataStatusPromise);
		});


	let importAnotherFileButton = sqlops.window.modelviewdialog.createButton('Import new file');
	importAnotherFileButton.onClick(() => {
		//TODO replace this with proper cleanup for all the pages
		wizard.close();
		flatFileWizard(provider);
	});
	importAnotherFileButton.hidden = true;
	wizard.customButtons = [importAnotherFileButton];

	wizard.onPageChanged(async e => {
		if(e.lastPage === 0 && e.newPage === 1) {
			provider.sendPROSEDiscoveryRequest({
				filePath: model.filePath,
				tableName: model.table,
				schemaName: model.schema
			}).then((result)=>{
				console.log("Recieved PROSE results");
				model.proseDataPreview = result.dataPreview;
				model.proseColumns = [];
				result.columnInfo.forEach((column) => {
					let columnData = {
						columnName: column.name,
						dataType: column.sqlType,
						primaryKey: false,
						nullable: column.isNullable
					};
					model.proseColumns.push(columnData);
				});
				previewReadyPromise.resolve(result as any);
			});
		} else if(e.lastPage === 2 && e.newPage === 3) {
			let changeColumnResults = [];
			model.proseColumns.forEach((val, i, arr) => {
				let columnChangeParams = {
					index: i,
					newName: val.columnName,
					newDataType: val.dataType,
					newNullable: val.nullable,
					newInPrimaryKey: val.primaryKey
				};
				changeColumnResults.push(provider.sendChangeColumnSettingsRequest(columnChangeParams));
			});
			let connectionString: string;
			let options = model.server.options;
			if (options.authenticationType === 'Integrated') {
				connectionString = `Data Source=${options.server + (options.port ? `,${options.port}` : '')};Initial Catalog=${model.database};Integrated Security=True`;
			} else {
				let credentials = await sqlops.connection.getCredentials(model.server.connectionId);
				connectionString = `Data Source=${options.server + (options.port ? `,${options.port}` : '')};Initial Catalog=${model.database};Integrated Security=False;User Id=${options.user};Password=${credentials.password}`;
			}
			console.log('Using connection string ' + connectionString);
			provider.sendInsertDataRequest({
			connectionString: connectionString,
			//TODO check what SSMS uses as batch size
			batchSize: 500
        }).then((response) => {
        	importAnotherFileButton.hidden = false;
        	importDataStatusPromise.resolve(response);
			});
		}

		if (e.lastPage === 3 && e.newPage !== 3) {
			importAnotherFileButton.hidden = true;
		}

		let oldLabel: string;
		if (e.newPage === 2) {
			oldLabel = wizard.nextButton.label;
			wizard.nextButton.label = 'Import data';
		} else if (oldLabel) {
			wizard.nextButton.label = oldLabel;
		}
	});

	// wizard.registerOperation({
	// 	displayName: 'test task',
	// 	description: 'task description',
	// 	connection: null,
	// 	isCancelable: true,
	// 	operation: (op) => {
	// 		op.updateStatus(sqlops.TaskStatus.InProgress);
	// 		op.updateStatus(sqlops.TaskStatus.InProgress, 'Task is running');
	// 		setTimeout(() => {
	// 			op.updateStatus(sqlops.TaskStatus.Succeeded);
	// 		}, 5000);
	// 	}
	// });

	//not needed for this wizard
	wizard.generateScriptButton.hidden = true;

	wizard.pages = [page1, page2, page3, page4];
	wizard.open();
}

//TODO put in a different file with other interfaces
export interface DeferredPromise<T> {
	promise: Promise<T>;
	resolve: (value: T | PromiseLike<T>) => void;
	reject: (reason?: any) => void;
}

function deferredPromise<T>(): DeferredPromise<T> {
	let outResolve, outReject;
	return {
		promise: new Promise<T>((resolve, reject) => {
			outResolve = resolve;
			outReject = reject;
		}),
		resolve: outResolve,
		reject: outReject
	};
}
