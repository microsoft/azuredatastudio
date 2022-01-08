/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';
import type * as azdata from 'azdata';

export class VSCodeNotebookEditor implements vscode.NotebookEditor {
	constructor(editor: azdata.nb.NotebookEditor) {
	}

	public get document(): vscode.NotebookDocument {
		return undefined;
	}

	public get selections(): vscode.NotebookRange[] {
		return undefined;
	}

	public get visibleRanges(): vscode.NotebookRange[] {
		return undefined;
	}

	public get viewColumn(): vscode.ViewColumn | undefined {
		return undefined;
	}

	public revealRange(range: vscode.NotebookRange, revealType?: vscode.NotebookEditorRevealType): void {
		throw new Error('Method not implemented.');
	}

	public edit(callback: (editBuilder: vscode.NotebookEditorEdit) => void): Thenable<boolean> {
		throw new Error('Method not implemented.');
	}

	public setDecorations(decorationType: vscode.NotebookEditorDecorationType, range: vscode.NotebookRange): void {
		throw new Error('Method not implemented.');
	}
}
