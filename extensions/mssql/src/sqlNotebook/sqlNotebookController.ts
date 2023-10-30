/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
	private readonly _cellUriScheme = 'vscode-notebook-cell';
	private readonly _connectionLabel = (serverName: string) => localize('notebookConnection', 'Connected to: {0}', serverName);
	private readonly _disconnectedLabel = localize('notebookDisconnected', 'Disconnected');

	private readonly _disposables = new Array<vscode.Disposable>();
	private readonly _controller: vscode.NotebookController;
	private readonly _connectionsMap = new Map<vscode.Uri, azdata.connection.Connection>();
	private readonly _executionOrderMap = new Map<vscode.Uri, number>();
	private readonly _queryProvider: azdata.QueryProvider;
	private readonly _connProvider: azdata.ConnectionProvider;
	private readonly _connectionLabelItem: vscode.StatusBarItem;

	private _queryCompleteHandler: QueryCompletionHandler | undefined;
	private _queryMessageHandler: QueryMessageHandler | undefined;
	private _activeCellUri: string;

	constructor() {
		this._controller = vscode.notebooks.createNotebookController('sql-controller-id', 'jupyter-notebook', 'SQL');

		this._controller.supportedLanguages = ['sql'];
		this._controller.supportsExecutionOrder = true;
		this._controller.executeHandler = this.execute.bind(this) as (cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController) => void | Thenable<void>;

		const sqlProvider = 'MSSQL';
		this._queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(sqlProvider, azdata.DataProviderType.QueryProvider);
		this._queryProvider.registerOnQueryComplete(result => this.handleQueryComplete(result));
		this._queryProvider.registerOnMessage(message => this.handleQueryMessage(message));

		this._connProvider = azdata.dataprotocol.getProvider<azdata.ConnectionProvider>(sqlProvider, azdata.DataProviderType.ConnectionProvider);

		const commandName = 'mssql.changeNotebookConnection';
		let changeConnectionCommand = vscode.commands.registerCommand(commandName, async () => await this.changeConnection());
		this._disposables.push(changeConnectionCommand);

		this._connectionLabelItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
		this._connectionLabelItem.text = this._disconnectedLabel;
		this._connectionLabelItem.tooltip = localize('changeNotebookConnection', 'Change SQL Notebook Connection');
		this._connectionLabelItem.command = commandName;
		this._disposables.push(this._connectionLabelItem);

		// Show connection status if there's a notebook already open when ADS starts
		if (vscode.window.activeTextEditor?.document.notebook) {
			this._connectionLabelItem.show();
		}

		let editorChangedEvent = vscode.window.onDidChangeActiveTextEditor(async editor => await this.handleActiveEditorChanged(editor));
		this._disposables.push(editorChangedEvent);

		let docClosedEvent = vscode.workspace.onDidCloseTextDocument(document => this.handleDocumentClosed(document));
		this._disposables.push(docClosedEvent);
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

	private async handleActiveEditorChanged(editor: vscode.TextEditor | undefined): Promise<void> {
		let notebook = editor?.document.notebook;
		if (!notebook) {
			// Hide status bar item if the current editor isn't a notebook
			this._connectionLabelItem.hide();
		} else {
			let connection = this._connectionsMap.get(notebook.uri);
			if (connection) {
				this._connectionLabelItem.text = this._connectionLabel(connection.options['server']);

				// If this editor is for a cell, then update the connection for it
				this.updateCellConnection(notebook.uri, connection);
			} else {
				this._connectionLabelItem.text = this._disconnectedLabel;
			}
			this._connectionLabelItem.show();
		}
	}

	public getConnectionProfile(connection: azdata.connection.Connection): azdata.IConnectionProfile {
		let connectionProfile: azdata.IConnectionProfile = {
			connectionName: connection.options.connectionName as string,
			serverName: connection.options.server as string,
			databaseName: connection.options.database as string,
			userName: connection.options.user as string,
			password: connection.options.password as string,
			authenticationType: connection.options.authenticationType as string,
			savePassword: connection.options.savePassword as boolean,
			groupFullName: undefined,
			groupId: undefined,
			providerName: connection.providerName,
			saveProfile: false,
			id: connection.connectionId,
			options: connection.options
		};
		return connectionProfile;
	}

	private handleDocumentClosed(editor: vscode.TextDocument): void {
		// Have to check isClosed here since this event is also emitted on doc language changes
		if (editor.notebook && editor.isClosed) {
			// Remove the connection & execution associations if the doc is closed, but don't close the connection since it might be re-used elsewhere
			this._connectionsMap.delete(editor.notebook.uri);
			this._executionOrderMap.delete(editor.notebook.uri);
		}
	}

	private updateCellConnection(notebookUri: vscode.Uri, connection: azdata.connection.Connection): void {
		let docUri = vscode.window.activeTextEditor?.document.uri;
		if (docUri && docUri.scheme === this._cellUriScheme && docUri.path === notebookUri.path) {
			if (this._activeCellUri) {
				this._connProvider.disconnect(this._activeCellUri).then(() => undefined, error => console.log(error));
			}
			this._activeCellUri = docUri.toString();
			// Delay connecting in case user is clicking between cells a lot
			setTimeout(() => {
				if (this._activeCellUri === docUri!.toString()) {
					let profile = this.getConnectionProfile(connection);
					this._connProvider.connect(docUri!.toString(), profile).then(
						connected => {
							if (!connected) {
								console.log(`Failed to update cell connection for cell: ${docUri!.toString()}`);
							}
						},
						error => {
							console.log(error);
						});
				}
			}, 200);
		}
	}

	private async changeConnection(notebook?: vscode.NotebookDocument): Promise<azdata.connection.Connection | undefined> {
		let connection: azdata.connection.Connection | undefined;
		let notebookUri = notebook?.uri ?? vscode.window.activeTextEditor?.document.notebook?.uri;
		if (notebookUri) {
			connection = await azdata.connection.openConnectionDialog(['MSSQL']);
			if (connection) {
				this._connectionsMap.set(notebookUri, connection);
				this._connectionLabelItem.text = this._connectionLabel(connection.options['server']);

				// Connect current notebook cell, if there is one
				this.updateCellConnection(notebookUri, connection);
			} else {
				this._connectionLabelItem.text = this._disconnectedLabel;
			}
			this._connectionLabelItem.show();
		}
		return connection;
	}

	private async execute(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController): Promise<void> {
		if (this._queryCompleteHandler) {
			throw new Error(localize('queryInProgressError', 'Another query is currently in progress. Please wait for that query to complete before running these cells.'));
		}

		let connection = this._connectionsMap.get(notebook.uri);
		if (!connection) {
			connection = await this.changeConnection(notebook);
		}

		let executionOrder = this._executionOrderMap.get(notebook.uri) ?? 0;
		for (let cell of cells) {
			await this.doExecution(cell, connection, ++executionOrder);
		}
		this._executionOrderMap.set(notebook.uri, executionOrder);
	}

	private async doExecution(cell: vscode.NotebookCell, connection: azdata.connection.Connection | undefined, executionOrder: number): Promise<void> {
		const execution = this._controller.createNotebookCellExecution(cell);
		execution.executionOrder = executionOrder;
		execution.start(Date.now());
		await execution.clearOutput();
		if (!connection) {
			await execution.appendOutput([
				new vscode.NotebookCellOutput([
					vscode.NotebookCellOutputItem.text(localize('noConnectionError', 'No connection provided.'))
				])
			]);
			execution.end(false, Date.now());
			return;
		}

		let cancelHandler: vscode.Disposable | undefined;
		try {
			const ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
			await this._queryProvider.runQueryString(ownerUri, cell.document.getText());
			cancelHandler = execution.token.onCancellationRequested(async () => await this._queryProvider.cancelQuery(ownerUri));

			let queryComplete = new Promise<void>(resolve => {
				let queryCompleteHandler = async (batchSummaries: azdata.BatchSummary[]) => {
					let tableHtmlEntries: string[] = [];
					for (let batchSummary of batchSummaries) {
						if (execution.token.isCancellationRequested) {
							break;
						}

						for (let resultSummary of batchSummary.resultSetSummaries || []) {
							if (execution.token.isCancellationRequested) {
								break;
							}

							if (resultSummary.rowCount > 0) {
								// Add column headers
								let tableHtml =
									`<style>
										.output_container .sqlNotebookResults td, .output_container .sqlNotebookResults th {
											text-align: left;
										}
									</style>
									<table class="sqlNotebookResults"><thead><tr>`;
								for (let column of resultSummary.columnInfo) {
									tableHtml += `<th>${htmlEscape(column.columnName)}</th>`;
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
										tableHtml += `<td>${htmlEscape(cell.displayValue)}</td>`;
									}
									tableHtml += '</tr>';
								}
								tableHtml += '</tbody></table>';
								tableHtmlEntries.push(tableHtml);
							}
						}
					}

					if (execution.token.isCancellationRequested) {
						await execution.appendOutput([
							new vscode.NotebookCellOutput([
								vscode.NotebookCellOutputItem.text(localize('cellExecutionCancelled', 'Cell execution cancelled.'))
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
			cancelHandler?.dispose();
			this._queryCompleteHandler = undefined;
			this._queryMessageHandler = undefined;
		}
	}

	dispose() {
		this._disposables.forEach(d => d.dispose());
	}
}

function htmlEscape(html: string): string {
	return html.replace(/[<|>|&|"]/g, function (match) {
		switch (match) {
			case '<': return '&lt;';
			case '>': return '&gt;';
			case '&': return '&amp;';
			case '"': return '&quot;';
			case '\'': return '&#39';
			default: return match;
		}
	});
}
