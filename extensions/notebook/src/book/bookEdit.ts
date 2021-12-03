/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { JupyterBookSection } from '../contracts/content';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as vscode from 'vscode';
import * as loc from '../common/localizedConstants';
import { BookTocManager } from './bookTocManager';
import { IBookUndoRedoElement } from './bookUndoRedoService';

export interface undoRedoToc {
	undo: JupyterBookSection[],
	redo: JupyterBookSection[]
}

export class MoveBookTreeItem implements IBookUndoRedoElement {
	label: string = loc.MoveBookTreeItem;

	constructor(private bookTocManager: BookTocManager, private movedFiles: Map<string, string>, private tocFiles: Map<string, undoRedoToc>) {
	}

	async undo(): Promise<void> {
		// restore toc files
		for (const [tocPath, contents] of this.tocFiles.entries()) {
			await this.applyTocChanges(tocPath, contents.undo);
		}
		// return files to previous file path
		for (const [src, dest] of this.movedFiles.entries()) {
			await fs.move(dest, src);
		}
	}

	async redo(): Promise<void> {
		// restore toc files
		for (const [tocPath, contents] of this.tocFiles.entries()) {
			await this.applyTocChanges(tocPath, contents.redo);
		}
		// return files to previous file path
		for (const [src, dest] of this.movedFiles.entries()) {
			await fs.move(src, dest);
		}
	}

	async applyTocChanges(tocPath: string, toc: JupyterBookSection[]) {
		try {
			this.bookTocManager.sourceBook?.unwatchTOC();
			this.bookTocManager.targetBook?.unwatchTOC();
			await fs.writeFile(tocPath, yaml.safeDump(toc, { lineWidth: Infinity, noRefs: true, skipInvalid: true }));
			await this.bookTocManager.sourceBook?.reinitializeContents();
			await this.bookTocManager.targetBook?.reinitializeContents();
		}
		catch (e) {
			void vscode.window.showErrorMessage(loc.undoRedoError(e instanceof Error ? e.message : e));
		}
	}
}
