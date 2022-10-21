/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { VSCodeNotebookDocument } from 'sql/workbench/api/common/notebooks/vscodeNotebookDocument';
import { functionalityNotSupportedError } from 'sql/base/common/locConstants';

export class VSCodeNotebookEditor implements vscode.NotebookEditor {
	private readonly _document: vscode.NotebookDocument;

	constructor(editor: azdata.nb.NotebookEditor) {
		if (editor) {
			this._document = new VSCodeNotebookDocument(editor.document);
		}
	}

	public get document(): vscode.NotebookDocument {
		return this._document;
	}

	public get selections(): vscode.NotebookRange[] {
		throw new Error(functionalityNotSupportedError);
	}

	public get visibleRanges(): vscode.NotebookRange[] {
		throw new Error(functionalityNotSupportedError);
	}

	public get viewColumn(): vscode.ViewColumn | undefined {
		throw new Error(functionalityNotSupportedError);
	}

	public revealRange(range: vscode.NotebookRange, revealType?: vscode.NotebookEditorRevealType): void {
		throw new Error(functionalityNotSupportedError);
	}

	public edit(callback: (editBuilder: vscode.NotebookEditorEdit) => void): Promise<boolean> {
		return Promise.reject(functionalityNotSupportedError);
	}

	public setDecorations(decorationType: vscode.NotebookEditorDecorationType, range: vscode.NotebookRange): void {
		// No-op
	}
}
