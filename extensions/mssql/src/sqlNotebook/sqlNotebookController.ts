/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

interface QueryCompletionHandler {
	ownerUri: string;
	handler: (results: azdata.BatchSummary[]) => void
}

interface QueryMessageHandler {
	ownerUri: string;
	handler: (results: azdata.QueryExecuteMessageParams) => void
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
	private _queryMessageHandler: QueryMessageHandler;
	private _queryProvider: azdata.QueryProvider;
	private _connectionLabelItem: vscode.StatusBarItem;

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
		this._queryProvider.registerOnQueryComplete(result => this.handleQueryComplete(result));
		this._queryProvider.registerOnMessage(message => this.handleQueryMessage(message));

		const commandName = 'mssql.changeNotebookConnection';
		let changeConnectionCommand = vscode.commands.registerCommand(commandName, () => this.handleChangeConnection());
		this._disposables.push(changeConnectionCommand);

		this._connectionLabelItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
		this._connectionLabelItem.tooltip = localize('changeNotebookConnection', 'Change SQL Notebook Connection');
		this._connectionLabelItem.command = commandName;
		this._disposables.push(this._connectionLabelItem);

		let editorChangedEvent = vscode.window.onDidChangeActiveTextEditor((editor) => this.handleActiveEditorChanged(editor));
		this._disposables.push(editorChangedEvent);
	}

	private handleQueryComplete(result: azdata.QueryExecuteCompleteNotificationResult): void {
		if (this._queryCompleteHandler && this._queryCompleteHandler.ownerUri === result.ownerUri) { // Check if handler is undefined separately in case the result URI is also undefined
			this._queryCompleteHandler.handler(result.batchSummaries);
		}
	}

	private handleQueryMessage(message: azdata.QueryExecuteMessageParams): void {
		if (this._queryMessageHandler && this._queryMessageHandler.ownerUri === message.ownerUri) { // Check if handler is undefined separately in case the result URI is also undefined
			this._queryMessageHandler.handler(message);
		}
	}

	private handleActiveEditorChanged(editor: vscode.TextEditor): void {
		let connection = this._connectionsMap.get(editor?.document.notebook?.uri);
		if (connection) {
			this._connectionLabelItem.text = 'Connected to: ' + connection.options['server'];
			this._connectionLabelItem.show();
		} else {
			this._connectionLabelItem.hide();
		}
	}

	private handleChangeConnection(): void {

	}

	private async execute(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController): Promise<void> {
		if (this._queryCompleteHandler) {
			throw new Error(localize('queryInProgressError', 'Another query is currently in progress. Please wait for that query to complete before running these cells.'));
		}

		let connection = this._connectionsMap.get(notebook.uri);
		if (!connection) {
			connection = await azdata.connection.openConnectionDialog(['MSSQL']);
			this._connectionsMap.set(notebook.uri, connection);
		}
		this._connectionLabelItem.text = 'Connected to: ' + connection.options['server'];
		this._connectionLabelItem.show();

		for (let cell of cells) {
			await this.doExecution(cell, connection);
		}
	}

	private async doExecution(cell: vscode.NotebookCell, connectionProfile: azdata.connection.Connection): Promise<void> {
		const execution = this._controller.createNotebookCellExecution(cell);
		execution.executionOrder = ++this._executionOrder;
		execution.start(Date.now());
		await execution.clearOutput();

		let cancelHandler: vscode.Disposable;
		try {
			const ownerUri = await azdata.connection.getUriForConnection(connectionProfile.connectionId);
			await this._queryProvider.runQueryString(ownerUri, cell.document.getText());
			cancelHandler = execution.token.onCancellationRequested(async () => await this._queryProvider.cancelQuery(ownerUri));

			let queryComplete = new Promise<void>(resolve => {
				let queryCompleteHandler = async (batchSummaries: azdata.BatchSummary[]) => {
					let tableHtmlEntries: string[] = [];
					for (let batchSummary of batchSummaries) {
						if (execution.token.isCancellationRequested) {
							break;
						}

						for (let resultSummary of batchSummary.resultSetSummaries) {
							if (execution.token.isCancellationRequested) {
								break;
							}

							let tableHtml = '';
							if (resultSummary.rowCount === 0) {
								tableHtml += `<span>Info: No rows were returned for query ${resultSummary.id} in batch ${batchSummary.id}.</span>`
							} else {
								// Add column headers
								tableHtml += '<table class="sqlNotebookResults"><thead><tr>';
								for (let column of resultSummary.columnInfo) {
									tableHtml += `<th style="text-align: left;">${column.columnName}</th>`;
								}
								tableHtml += '</tr></thead>';

								// Add rows and cells
								let subsetResult = await this._queryProvider.getQueryRows({
									ownerUri: ownerUri,
									batchIndex: batchSummary.id,
									resultSetIndex: resultSummary.id,
									rowsStartIndex: 0,
									rowsCount: resultSummary.rowCount
								});
								tableHtml += '<tbody>';
								for (let row of subsetResult.resultSubset.rows) {
									tableHtml += '<tr>';
									for (let cell of row) {
										tableHtml += `<td style="text-align: left;">${cell.displayValue}</td>`;
									}
									tableHtml += '</tr>';
								}
							}
							tableHtml += '</tbody></table>';
							tableHtmlEntries.push(tableHtml);
						}
					}

					if (execution.token.isCancellationRequested) {
						await execution.appendOutput([
							new vscode.NotebookCellOutput([
								vscode.NotebookCellOutputItem.text('Cell execution cancelled.')
							])
						]);
						execution.end(false, Date.now());
					} else {
						await execution.appendOutput([
							new vscode.NotebookCellOutput([
								vscode.NotebookCellOutputItem.text(tableHtmlEntries.join('<br><br>'), 'text/html')
							])
						]);
						execution.end(true, Date.now());
					}
					resolve();
				};
				this._queryCompleteHandler = { ownerUri: ownerUri, handler: queryCompleteHandler };
			});

			this._queryMessageHandler = {
				ownerUri: ownerUri,
				handler: async message => {
					await execution.appendOutput([
						new vscode.NotebookCellOutput([
							vscode.NotebookCellOutputItem.text(message.message.message)
						])
					]);
				}
			};

			await queryComplete;
		} catch (error) {
			await execution.appendOutput([
				new vscode.NotebookCellOutput([
					vscode.NotebookCellOutputItem.error(error)
				])
			]);
			execution.end(false, Date.now());
		} finally {
			if (cancelHandler) {
				cancelHandler.dispose();
			}
			this._queryCompleteHandler = undefined;
			this._queryMessageHandler = undefined;
		}
	}

	dispose() {
		this._disposables.forEach(d => d.dispose());
	}
}
