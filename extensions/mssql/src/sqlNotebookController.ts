/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as azdata from 'azdata';

export class SqlNotebookController implements vscode.Disposable {
	private readonly _controllerId = 'sql-controller-id';
	private readonly _notebookType = 'jupyter-notebook';
	private readonly _label = 'SQL';
	private readonly _supportedLanguages = ['sql'];
	private _disposables = new Array<vscode.Disposable>();

	private readonly _controller: vscode.NotebookController;
	private _executionOrder = 0;
	private _connectionsMap = new Map<vscode.Uri, azdata.connection.Connection>();


	constructor() {
		this._controller = vscode.notebooks.createNotebookController(
			this._controllerId,
			this._notebookType,
			this._label
		);

		this._controller.supportedLanguages = this._supportedLanguages;
		this._controller.supportsExecutionOrder = true;
		this._controller.executeHandler = this.execute.bind(this);
	}

	private async execute(cells: vscode.NotebookCell[], notebook: vscode.NotebookDocument, controller: vscode.NotebookController
	): Promise<void> {
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
			const queryProvider = azdata.dataprotocol.getProvider<azdata.QueryProvider>(
				'MSSQL',
				azdata.DataProviderType.QueryProvider);

			const ownerUri = await azdata.connection.getUriForConnection(connectionProfile.connectionId);
			const results = await queryProvider.runQueryAndReturn(ownerUri, cell.document.getText());

			var columnRow = '<tr>' + results.columnInfo.map(column => `<th>${column.columnName}</th>`).join('') + '</tr>';
			var resultsRows = results.rows.map(row => '<tr>' + row.map(cell => `<td>${cell.displayValue}</td>`).join('') + '</tr>').join('');

			await execution.replaceOutput([
				new vscode.NotebookCellOutput([
					vscode.NotebookCellOutputItem.text('<table>' + columnRow + resultsRows + '</table>', 'text/html'),
					vscode.NotebookCellOutputItem.text(`${results.rowCount} rows returned`)
				])
			]);
			execution.end(true, Date.now());
		} catch (error) {
			await execution.replaceOutput([
				new vscode.NotebookCellOutput([
					vscode.NotebookCellOutputItem.error(error)
				])
			]);
			execution.end(false, Date.now());
		}
	}

	dispose() {
		this._disposables.forEach(d => d.dispose());
	}
}
