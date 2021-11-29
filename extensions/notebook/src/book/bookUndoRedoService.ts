/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JupyterBookSection } from '../contracts/content';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import { BookModel } from './bookModel';
import * as vscode from 'vscode';
import * as loc from '../common/localizedConstants';

export interface undoRedoToc {
	undo: JupyterBookSection[],
	redo: JupyterBookSection[]
}

export interface IBookUndoRedoElement {
	sourceBook: BookModel,
	targetBook?: BookModel,
	tocFiles: Map<string, undoRedoToc>,
	files: Map<string, string>
}

export class BookUndoRedoService {
	private _undoBookChange: IBookUndoRedoElement[] = [];
	private _redoBookChange: IBookUndoRedoElement[] = [];
	private _undoMaxSize = 10;

	constructor() {
	}

	public popUndo(): IBookUndoRedoElement | undefined {
		if (this._undoBookChange.length > 0) {
			const change = this._undoBookChange.pop();
			this._redoBookChange.push(change);
			return change;
		}
		return undefined;
	}

	public popRedo(): IBookUndoRedoElement | undefined {
		if (this._redoBookChange.length > 0) {
			const change = this._redoBookChange.pop();
			this._undoBookChange.push(change);
			return change;
		}
		return undefined;
	}

	public addToUndoStack(change: IBookUndoRedoElement): void {
		if (this._undoBookChange.length < this._undoMaxSize) {
			this._undoBookChange.push(change);
			this._redoBookChange = [];
		}
	}

	public async undo(): Promise<void> {
		const bookChange = this.popUndo();
		let files = bookChange.files;
		let tocFiles = bookChange.tocFiles;

		// restore toc files
		for (const [tocPath, contents] of tocFiles.entries()) {
			await this.applyTocChanges(tocPath, contents.undo, bookChange);
		}
		// return files to previous file path
		for (const [src, dest] of files.entries()) {
			await fs.move(dest, src);
		}
	}

	public async redo(): Promise<void> {
		const bookChange = this.popRedo();
		let files = bookChange.files;
		let tocFiles = bookChange.tocFiles;

		// restore toc files
		for (const [tocPath, contents] of tocFiles.entries()) {
			await this.applyTocChanges(tocPath, contents.redo, bookChange);
		}
		// return files to previous file path
		for (const [src, dest] of files.entries()) {
			await fs.move(src, dest);
		}
	}

	public async applyTocChanges(tocPath: string, toc: JupyterBookSection[], change: IBookUndoRedoElement) {
		try {
			change.sourceBook?.unwatchTOC();
			change.targetBook?.unwatchTOC();
			await fs.writeFile(tocPath, yaml.safeDump(toc, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
			await change.sourceBook?.reinitializeContents();
			await change.targetBook?.reinitializeContents();
		}
		catch (e) {
			void vscode.window.showErrorMessage(loc.undoRedoError(e instanceof Error ? e.message : e));
		}
	}
}
