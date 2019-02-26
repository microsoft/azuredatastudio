/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { nb } from 'sqlops';

import * as vscode from 'vscode';
import { charCountToJsCountDiff, jsIndexToCharIndex } from './text';
import { JupyterNotebookProvider } from '../jupyter/jupyterNotebookProvider';
import { JupyterSessionManager } from '../jupyter/jupyterSessionManager';

const timeoutMilliseconds = 3000;

export class NotebookCompletionItemProvider implements vscode.CompletionItemProvider {

	constructor(private _notebookProvider: JupyterNotebookProvider) {
	}

	public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext)
		: vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
		let info = this.findMatchingCell(document, nb.notebookDocuments);
		if (!info || !this._notebookProvider) {
			// No matching document found
			return Promise.resolve([]);
		}
		return this.getCompletionItemsForNotebookCell(document, position, token, info);
	}

	private async getCompletionItemsForNotebookCell(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, info: INewIntellisenseInfo
	): Promise<vscode.CompletionItem[] | vscode.CompletionList> {
		info.kernel = await this.tryFindKernelForDocument(document, info);
		if (!info.kernel) {
			return [];
		}
		// Get completions, with cancellation on timeout or if cancel is requested.
		// Note that it's important we always return some value, or intellisense will never complete
		let promises = [this.requestCompletions(info, position, document), this.onCanceled(token), this.onTimeout(timeoutMilliseconds)];
		return Promise.race(promises);
	}

	public resolveCompletionItem(item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem> {
		return item;
	}

	private async tryFindKernelForDocument(document: vscode.TextDocument, info: INewIntellisenseInfo): Promise<nb.IKernel> {
		try {
			let notebookManager = await this._notebookProvider.getNotebookManager(document.uri);
			if (notebookManager) {
				let sessionManager: JupyterSessionManager = <JupyterSessionManager>(notebookManager.sessionManager);
				let sessions = sessionManager.listRunning();
				if (sessions && sessions.length > 0) {
					let session = sessions.find(session => session.path === info.notebook.uri.path);
					if (!session) {
						return;
					}
					return session.kernel;
				}
			}
		} catch {
			// If an exception occurs, swallow it currently
			return undefined;
		}
	}

	private findMatchingCell(document: vscode.TextDocument, allDocuments: nb.NotebookDocument[]): INewIntellisenseInfo {
		if (allDocuments && document) {
			for (let doc of allDocuments) {
				for (let cell of doc.cells) {
					if (cell && cell.uri && cell.uri.path === document.uri.path) {
						return {
							editorUri: cell.uri.path,
							cell: cell,
							notebook: doc
						};
					}
				}
			}
		}
		return undefined;
	}

	private async requestCompletions(info: INewIntellisenseInfo, position: vscode.Position, cellTextDocument: vscode.TextDocument): Promise<vscode.CompletionItem[]> {
		if (!info || !info.kernel || !info.kernel.supportsIntellisense || !info.kernel.isReady) {
			return [];
		}
		let source = cellTextDocument.getText();
		if (!source || source.length === 0) {
			return [];
		}
		let cursorPosition = this.toCursorPosition(position, source);
		let result = await info.kernel.requestComplete({
			code: source,
			cursor_pos: cursorPosition.adjustedPosition
		});
		if (!result || !result.content || result.content.status === 'error') {
			return [];
		}
		let content = result.content;
		// Get position relative to the current cursor.
		let range = this.getEditRange(content, cursorPosition, position, source);
		let items: vscode.CompletionItem[] = content.matches.map(m => {
			let item: vscode.CompletionItem = {
				label: m,
				insertText: m,
				kind: vscode.CompletionItemKind.Text,
				textEdit: {
					range: range,
					newText: m,
					newEol: undefined
				}
			};
			return item;
		});
		return items;
	}

	private getEditRange(content: nb.ICompletionContent, cursorPosition: IRelativePosition, position: vscode.Position, source: string): vscode.Range {
		let relativeStart = this.getRelativeStart(content, cursorPosition, source);
		// For now we're not adjusting relativeEnd. This may be a subtle issue here: if this ever actually goes past the end character then we should probably
		// account for the difference on the right-hand-side of the original text
		let relativeEnd = content.cursor_end - cursorPosition.adjustedPosition;
		let range = new vscode.Range(
			new vscode.Position(position.line, Math.max(relativeStart + position.character, 0)),
			new vscode.Position(position.line, Math.max(relativeEnd + position.character, 0)));
		return range;
	}

	private getRelativeStart(content: nb.ICompletionContent, cursorPosition: IRelativePosition, source: string): number {
		let relativeStart = 0;
		if (content.cursor_start !== cursorPosition.adjustedPosition) {
			// Account for possible surrogate characters inside the substring.
			// We need to examine the substring between (start, end) for surrogates and add 1 char for each of these.
			let diff = cursorPosition.adjustedPosition - content.cursor_start;
			let startIndex = cursorPosition.originalPosition - diff;
			let adjustedStart = content.cursor_start + charCountToJsCountDiff(source.slice(startIndex, cursorPosition.originalPosition));
			relativeStart = adjustedStart - cursorPosition.adjustedPosition;
		} else {
			// It didn't change so leave at 0
			relativeStart = 0;
		}
		return relativeStart;
	}

	private onCanceled(token: vscode.CancellationToken): Promise<vscode.CompletionItem[]> {
		return new Promise((resolve, reject) => {
			// On cancellation, quit
			token.onCancellationRequested(() => resolve([]));
		});
	}

	private onTimeout(timeout: number): Promise<vscode.CompletionItem[]> {
		return new Promise((resolve, reject) => {
			// After 4 seconds, quit
			setTimeout(() => resolve([]), timeout);
		});
	}

	/**
	 * Convert from a line+character position to a cursor position based on the whole string length
	 * Note: this is somewhat inefficient especially for large arrays. However we've done
	 * this for other intellisense libraries that are index based. The ideal would be to at
	 * least do caching of the contents in an efficient lookup structure so we don't have to recalculate
	 * and throw away each time.
	 */
	private toCursorPosition(position: vscode.Position, source: string): IRelativePosition {
		let lines = source.split('\n');
		let characterPosition = 0;
		let currentLine = 0;
		// Add up all lines up to the current one
		for (currentLine; currentLine < position.line; currentLine++) {
			// Add to the position, accounting for the \n at the end of the line
			characterPosition += lines[currentLine].length + 1;
		}
		// Then add up to the cursor position on that line
		characterPosition += position.character;
		// Return the sum
		return {
			originalPosition: characterPosition,
			adjustedPosition: jsIndexToCharIndex(characterPosition, source)
		};
	}
}

interface IRelativePosition {
	originalPosition: number;
	adjustedPosition: number;
}


export interface INewIntellisenseInfo {
	editorUri: string;
	cell: nb.NotebookCell;
	notebook: nb.NotebookDocument;
	kernel?: nb.IKernel;
}