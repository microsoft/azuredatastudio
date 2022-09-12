/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Sample hardcoded contents for the Notebook.
 */
const presetNotebookData: vscode.NotebookData = {
	cells: [{
		kind: vscode.NotebookCellKind.Markup,
		value: 'Sample markup cell',
		languageId: 'Markup'
	}, {
		kind: vscode.NotebookCellKind.Code,
		value: '1+1',
		languageId: 'Python'
	}]
};

const presetNotebookBytes = new TextEncoder().encode(JSON.stringify(presetNotebookData));

/**
 * A sample Notebook serializer which handles serializing/deserializing the Notebook from/into a byte array for storage.
 */
export class SampleSerializer implements vscode.NotebookSerializer {
	deserializeNotebook(content: Uint8Array, token: vscode.CancellationToken): vscode.NotebookData | Thenable<vscode.NotebookData> {
		return presetNotebookData;
	}
	serializeNotebook(data: vscode.NotebookData, token: vscode.CancellationToken): Uint8Array | Thenable<Uint8Array> {
		return presetNotebookBytes;
	}
}
