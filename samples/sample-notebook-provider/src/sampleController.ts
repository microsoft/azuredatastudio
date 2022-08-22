/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * A sample Notebook controller which handles creating a new controller and registering it with Azure Data Studio
 */
export class SampleController {
	// The unique ID of the controller
	readonly controllerId = 'my-notebook-controller-id';
	// The type of the notebook, must be the same as defined in the package.json contribution
	readonly notebookType = 'my-notebook';
	// Label to display in the UI when choosing a Notebook provider
	readonly label = 'My Notebook';
	// The languages this Notebook supports for code cells
	readonly supportedLanguages = ['python'];

	private readonly _controller: vscode.NotebookController;
	private _executionOrder = 0;

	constructor(private context: vscode.ExtensionContext) {
		this._controller = vscode.notebooks.createNotebookController(
			this.controllerId,
			this.notebookType,
			this.label
		);

		this._controller.supportedLanguages = this.supportedLanguages;
		this._controller.supportsExecutionOrder = true;
		this._controller.executeHandler = this._execute.bind(this);
	}

	dispose() { }

	private async _execute(
		cells: vscode.NotebookCell[],
		_notebook: vscode.NotebookDocument,
		_controller: vscode.NotebookController
	): Promise<void> {
		for (let cell of cells) {
			await this._doExecution(cell);
		}
	}

	private async _doExecution(cell: vscode.NotebookCell): Promise<void> {
		// First we create an execution object for the cell and start it
		const execution = this._controller.createNotebookCellExecution(cell);
		execution.executionOrder = ++this._executionOrder;
		execution.start();

		// This logic can be whatever you want - typically you would use the contents of the cell and do something
		// with that (such as executing a query) but you can also run whatever code you want to and send outputs
		// to be displayed.
		const image = await fs.readFile(path.join(this.context.extensionPath, 'images', 'computer-cat.gif'));

		// Header output that includes the original text of the cell, formatted as markdown
		const outputHeader = new vscode.NotebookCellOutput([
			vscode.NotebookCellOutputItem.text(`**Running code: ${cell.document.getText()}**`, 'text/markdown'),
		]);
		// Simple text output
		const output = new vscode.NotebookCellOutput([
			vscode.NotebookCellOutputItem.text('Finding the cat'),
		]);
		// Initial set of messages
		await execution.replaceOutput([
			outputHeader,
			output
		]);

		// Show replacing the output items to incrementally update a specific output
		for (let i = 1; i < 8; i++) {
			await new Promise(resolve => setTimeout(resolve, 500));
			await execution.replaceOutputItems([
				vscode.NotebookCellOutputItem.text('Finding the cat' + '.'.repeat(i))
			], output);
		}
		// End by replacing the text with a gif
		await execution.replaceOutputItems([
			vscode.NotebookCellOutputItem.text(image.toString('base64'), 'image/gif')
		], output);

		// And finally append a new output to the existing ones
		await execution.appendOutput(new vscode.NotebookCellOutput([vscode.NotebookCellOutputItem.text('Cat found!')]), cell);

		// Signal execution end
		execution.end(true);
	}
}
