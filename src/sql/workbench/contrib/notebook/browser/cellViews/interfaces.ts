/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { OnDestroy, ElementRef } from '@angular/core';
import * as Mark from 'mark.js';

import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { ICellEditorProvider, INotebookService, NotebookRange } from 'sql/workbench/services/notebook/browser/notebookService';
import { MarkdownRenderOptions } from 'vs/base/browser/markdownRenderer';
import { IMarkdownString } from 'vs/base/common/htmlContent';
import { BaseTextEditor } from 'vs/workbench/browser/parts/editor/textEditor';
import { nb } from 'azdata';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { NotebookInput } from 'sql/workbench/contrib/notebook/browser/models/notebookInput';
import { ICodeEditorViewState } from 'vs/editor/common/editorCommon';

export const findHighlightClass = 'rangeHighlight';
export const findRangeSpecificClass = 'rangeSpecificHighlight';
export abstract class CellView extends AngularDisposable implements OnDestroy, ICellEditorProvider {

	protected isFindActive: boolean = false;
	protected highlightRange: NotebookRange;
	protected output: ElementRef;
	protected notebookService: INotebookService;
	protected _model: NotebookModel;
	isCellOutput: boolean = false;
	protected searchTerm: string;

	constructor() {
		super();
	}

	public abstract layout(): void;

	public getEditor(): BaseTextEditor<ICodeEditorViewState> | undefined {
		return undefined;
	}

	public hasEditor(): boolean {
		return false;
	}

	public abstract cellGuid(): string;

	public deltaDecorations(newDecorationsRange: NotebookRange | NotebookRange[], oldDecorationsRange: NotebookRange | NotebookRange[]): void {
		if (newDecorationsRange) {
			this.isFindActive = true;
			if (Array.isArray(newDecorationsRange)) {
				this.highlightAllMatches();
			} else {
				this.highlightRange = newDecorationsRange;
				this.addDecoration(newDecorationsRange);
			}
		}
		if (oldDecorationsRange) {
			if (Array.isArray(oldDecorationsRange)) {
				this.removeDecoration();
				this.isFindActive = false;
			} else {
				this.highlightRange = oldDecorationsRange === this.highlightRange ? undefined : this.highlightRange;
				this.removeDecoration(oldDecorationsRange);
			}
		}
	}

	protected addDecoration(range?: NotebookRange): void {
		range = range ?? this.highlightRange;
		if (this.output && this.output.nativeElement) {
			this.highlightAllMatches();
			if (range) {
				let elements = this.getHtmlElements();
				if (elements?.length >= range.startLineNumber) {
					let elementContainingText = elements[range.startLineNumber - 1];
					let markCurrent = new Mark(elementContainingText); // to highlight the current item of them all.

					markCurrent.markRanges([{
						start: range.startColumn - 1, //subtracting 1 since markdown html is 0 indexed.
						length: range.endColumn - range.startColumn
					}], {
						className: findRangeSpecificClass,
						each: function (node, range) {
							// node is the marked DOM element
							node.scrollIntoView({ behavior: 'smooth', block: 'center' });
						}
					});
				}
			}
		}
	}

	protected highlightAllMatches(): void {
		if (this.output && this.output.nativeElement) {
			let markAllOccurances = new Mark(this.output.nativeElement); // to highlight all occurances in the element.
			let editor = this.notebookService.findNotebookEditor(this._model.notebookUri);
			if (editor) {
				let findModel = (editor.notebookParams.input as NotebookInput).notebookFindModel;
				if (findModel?.findMatches?.length > 0) {
					let searchString = findModel.findExpression;
					markAllOccurances.mark(searchString, {
						className: findHighlightClass
					});
				}
			}
		}
	}

	protected removeDecoration(range?: NotebookRange): void {
		if (this.output && this.output.nativeElement) {
			if (range) {
				let elements = this.getHtmlElements();
				let elementContainingText = elements[range.startLineNumber - 1];
				let markCurrent = new Mark(elementContainingText);
				markCurrent.unmark({ acrossElements: true, className: findRangeSpecificClass });
			} else {
				let markAllOccurances = new Mark(this.output.nativeElement);
				markAllOccurances.unmark({ acrossElements: true, className: findHighlightClass });
				markAllOccurances.unmark({ acrossElements: true, className: findRangeSpecificClass });
				this.highlightRange = undefined;
			}
		}
	}


	protected getHtmlElements(): any[] {
		let hostElem = this.output?.nativeElement;
		let children = [];
		if (hostElem) {
			for (let element of hostElem.children) {
				if (element.nodeName.toLowerCase() === 'table') {
					// add table header and table rows.
					if (element.children.length > 0) {
						children.push(element.children[0]);
						if (element.children.length > 1) {
							for (let trow of element.children[1].children) {
								children.push(trow);
							}
						}
					}
				} else if (element.children.length > 1) {
					children = children.concat(this.getChildren(element));
				} else {
					children.push(element);
				}
			}
		}
		return children;
	}


	protected getChildren(parent: any): any[] {
		let children: any = [];
		if (parent.children.length > 1 && parent.nodeName.toLowerCase() !== 'li' && parent.nodeName.toLowerCase() !== 'p') {
			for (let child of parent.children) {
				children = children.concat(this.getChildren(child));
			}
		} else {
			return [parent];
		}
		return children;
	}

}

export interface IMarkdownStringWithCellAttachments extends IMarkdownString {
	readonly cellAttachments?: nb.ICellAttachments
}

export interface MarkdownRenderOptionsWithCellAttachments extends MarkdownRenderOptions {
	readonly cellAttachments?: nb.ICellAttachments
}
