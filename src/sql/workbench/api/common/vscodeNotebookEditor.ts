/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';
import { VSCodeNotebookDocument } from 'sql/workbench/api/common/vscodeNotebookDocument';

export class VSCodeNotebookEditor implements vscode.NotebookEditor {
	private readonly _document: vscode.NotebookDocument;

	constructor(editor: azdata.nb.NotebookEditor) {
		this._document = new VSCodeNotebookDocument(editor.document);
	}

	public get document(): vscode.NotebookDocument {
		return this._document;
	}

	public get selections(): vscode.NotebookRange[] {
		return [];
	}

	public get visibleRanges(): vscode.NotebookRange[] {
		return [];
	}

	public get viewColumn(): vscode.ViewColumn | undefined {
		return undefined;
	}

	public revealRange(range: vscode.NotebookRange, revealType?: vscode.NotebookEditorRevealType): void {
		return; // No-op
	}

	public edit(callback: (editBuilder: vscode.NotebookEditorEdit) => void): Thenable<boolean> {
		return Promise.resolve(false);
	}

	public setDecorations(decorationType: vscode.NotebookEditorDecorationType, range: vscode.NotebookRange): void {
		return; // No-op
	}
}
