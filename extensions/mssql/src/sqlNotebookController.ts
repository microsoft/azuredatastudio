/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

interface QueryCompletionHandler {
	ownerUri: string;
	handler: (results: azdata.BatchSummary[]) => void
}

export class SqlNotebookController implements vscode.Disposable {
	private readonly _controllerId = 'sql-controller-id';
	private readonly _notebookType = 'jupyter-notebook';
	private readonly _label = 'SQL';
	private readonly _supportedLanguages = ['sql'];
	private _disposables = new Array<vscode.Disposable>();

	private readonly _controller: vscode.NotebookController;
	private _executionOrder = 0;
	private _connectionsMap = new Map<vscode.Uri, azdata.connection.Connection>();
	private _queryCompleteHandler: QueryCompletionHandler;
	private _queryProvider: azdata.QueryProvider;

	constructor() {
		this._controller = vscode.notebooks.createNotebookController(
			this._controllerId,
			this._notebookType,
			this._label
		);

		this._controller.supportedLanguages = this._supportedLanguages;
		this._controller.supportsExecutionOrder = true;
		this._controller.executeHandler = this.execute.bind(this);

		this._queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>('MSSQL', azdata.DataProviderType.QueryProvider);
		this._queryProvider.registerOnQueryComplete(result => {
			if (this._queryCompleteHandler && this._queryCompleteHandler.ownerUri === result.ownerUri) { // Check if handler is undefined separately in case the result URI is also undefined
				this._queryCompleteHandler.handler(result.batchSummaries);
			}
		});
	}

	private async execute(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController
	): Promise<void> {
		if (this._queryCompleteHandler) {
			throw new Error('Another query is currently in progress. Please wait for that query to complete before running these cells.');
		}

		let connection = this._connectionsMap.get(notebook.uri);
		if (!connection) {
			connection = await azdata.connection.openConnectionDialog(['MSSQL']);
			this._connectionsMap.set(notebook.uri, connection);
		}
		for (let cell of cells) {
			await this.doExecution(cell, connection);
		}
	}

	private async doExecution(cell: vscode.NotebookCell, connectionProfile: azdata.connection.Connection): Promise<void> {
		const execution = this._controller.createNotebookCellExecution(cell);
		execution.executionOrder = ++this._executionOrder;
		execution.start(Date.now());

		try {
			const ownerUri = await azdata.connection.getUriForConnection(connectionProfile.connectionId);
			await this._queryProvider.runQueryString(ownerUri, cell.document.getText());

			let queryComplete = new Promise<void>(resolve => {
				let queryCompleteHandler = async (batchSummaries: azdata.BatchSummary[]) => {
					let tableHtml = '';
					for (let batchSummary of batchSummaries) {
						if (batchSummary.hasError) {
							tableHtml += `<table><tr><td>Batch ${batchSummary.id} reported an error. See messages for details.</td></tr></table>`;
						} else {
							for (let resultSummary of batchSummary.resultSetSummaries) {
								tableHtml += '<table>';
								if (resultSummary.rowCount === 0) {
									tableHtml += `<tr><td>Info: No rows were returned for query ${resultSummary.id} in batch ${batchSummary.id}.</td></tr>`
								} else {
									// Add column headers
									tableHtml += '<tr>';
									for (let column of resultSummary.columnInfo) {
										tableHtml += `<th>${column.columnName}</th>`;
									}
									tableHtml += '</tr>';

									// Add rows and cells
									let subsetResult = await this._queryProvider.getQueryRows({
										ownerUri: ownerUri,
										batchIndex: batchSummary.id,
										resultSetIndex: resultSummary.id,
										rowsStartIndex: 0,
										rowsCount: resultSummary.rowCount
									});
									for (let row of subsetResult.resultSubset.rows) {
										tableHtml += '<tr>';
										for (let cell of row) {
											tableHtml += `<td>${cell.displayValue}</td>`;
										}
										tableHtml += '</tr>';
									}
								}
								tableHtml += '</table>';
							}
						}
					}

					await execution.replaceOutput([
						new vscode.NotebookCellOutput([
							vscode.NotebookCellOutputItem.text(tableHtml, 'text/html')
						])
					]);
					execution.end(true, Date.now());
					resolve();
				};
				this._queryCompleteHandler = { ownerUri: ownerUri, handler: queryCompleteHandler };
			});
			await queryComplete;
		} catch (error) {
			await execution.replaceOutput([
				new vscode.NotebookCellOutput([
					vscode.NotebookCellOutputItem.error(error)
				])
			]);
			execution.end(false, Date.now());
		} finally {
			this._queryCompleteHandler = undefined;
			// TODO: add message handler for errors
		}
	}

	dispose() {
		this._disposables.forEach(d => d.dispose());
	}
}
