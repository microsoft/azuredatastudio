/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./markdownToolbar';
import { Component, Input } from '@angular/core';
import { localize } from 'vs/nls';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { ICellEditorProvider } from 'sql/workbench/services/notebook/browser/notebookService';
import { QueryTextEditor } from 'sql/workbench/browser/modelComponents/queryTextEditor';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';
import { TextModel } from 'vs/editor/common/model/textModel';
import { IRange } from 'vs/editor/common/core/range';

const ButtonBold = localize('buttonBold', "Bold");
const ButtonItalic = localize('buttonItalic', "Italic");
const ButtonCode = localize('buttonCode', "Code");
//const ButtonHighlight = localize('buttonHighlight', "Highlight");
const ButtonLink = localize('buttonLink', "Link");
const ButtonList = localize('buttonList', "List");
const ButtonOrderedList = localize('buttonOrderedList', "Ordered list");
const ButtonImage = localize('buttonImage', "Image");
const ButtonPreview = localize('buttonPreview', "Markdown preview toggle - off");

@Component({
	selector: 'markdown-toolbar-component',
	template: `
		<ul class="markdown-toolbar">
			<li><a class="markdown-toolbar-bold" role="button" href="#" (click)="changeSelection(0)"><span class="offscreen">${ButtonBold}</span></a></li>
			<li><a class="markdown-toolbar-italic" role="button" href="#" (click)="changeSelection(1)"><span class="offscreen">${ButtonItalic}</span></a></li>
			<li><a class="markdown-toolbar-code" role="button" href="#" (click)="changeSelection(2)"><span class="offscreen">${ButtonCode}</span></a></li>
			<li><a class="markdown-toolbar-link" role="button" href="#"><span class="offscreen">${ButtonLink}</span></a></li>
			<li><a class="markdown-toolbar-list" role="button" href="#"><span class="offscreen">${ButtonList}</span></a></li>
			<li><a class="markdown-toolbar-ordered-list" role="button" href="#"><span class="offscreen">${ButtonOrderedList}</span></a></li>
			<li><a class="markdown-toolbar-image" role="button" href="#"><span class="offscreen">${ButtonImage}</span></a></li>
			<li><a (click)="toggleSplitView()" class="markdown-toolbar-preview-toggle-off" role="button" href="#"><span class="offscreen">${ButtonPreview}</span></a></li>
		</ul>
	`
})
export class MarkdownToolbar {
	public get cellModel(): ICellModel {
		return this._cellModel;
	}

	@Input() public set cellModel(value: ICellModel) {
		this._cellModel = value;
	}

	@Input() public set editors(value: ICellEditorProvider[]) {
		this._editors = value;
	}

	private _cellModel: ICellModel;
	private _editors: ICellEditorProvider[];


	ngInit() {
	}

	public changeSelection(type: MarkdownButtonType): void {
		let ed = this._editors.filter(e => e.cellGuid() === this._cellModel.cellGuid)[0];
		let editor = <QueryTextEditor>ed.getEditor();
		let editorControl = <CodeEditorWidget>editor.getControl();
		let editorModel = <TextModel>editorControl.getModel();
		let selection = editorControl.getSelections();
		let startRange: IRange = {
			startColumn: selection[0].startColumn,
			endColumn: selection[0].startColumn,
			startLineNumber: selection[0].startLineNumber,
			endLineNumber: selection[0].startLineNumber
		};

		let beginInsertedCode = this.getBeginningTextToInsertFromButtonType(type);
		let endInsertedCode = this.getEndingTextToInsertFromButtonType(type);
		if (beginInsertedCode) {
			// If end is on same line as beginning, need to add offset for number of characters inserted
			let offset = selection[0].startLineNumber === selection[0].endLineNumber ? beginInsertedCode.length : 0;
			let endRange: IRange = {
				startColumn: selection[0].endColumn + offset,
				endColumn: selection[0].endColumn + offset,
				startLineNumber: selection[0].endLineNumber,
				endLineNumber: selection[0].endLineNumber
			};
			editorModel.pushEditOperations(selection, [{ range: startRange, text: beginInsertedCode }, { range: endRange, text: endInsertedCode }], null);
		} else {
			// eslint-disable-next-line no-throw-literal
			throw 'Invalid button type';
		}
	}

	private getBeginningTextToInsertFromButtonType(type: MarkdownButtonType): string {
		switch (type) {
			case MarkdownButtonType.BOLD:
				return '**';
			case MarkdownButtonType.ITALIC:
				return '_';
			case MarkdownButtonType.CODE:
				return '```\n';
			default:
				return '';
		}
	}

	private getEndingTextToInsertFromButtonType(type: MarkdownButtonType): string {
		switch (type) {
			case MarkdownButtonType.BOLD:
				return '**';
			case MarkdownButtonType.ITALIC:
				return '_';
			case MarkdownButtonType.CODE:
				return '\n```';
			default:
				return '';
		}
	}
}

export enum MarkdownButtonType {
	BOLD = 0,
	ITALIC = 1,
	CODE = 2
}
