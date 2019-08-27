/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import * as dom from 'vs/base/browser/dom';
import { Action } from 'vs/base/common/actions';
import { Disposable } from 'vs/base/common/lifecycle';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import * as editorBrowser from 'vs/editor/browser/editorBrowser';
import { Range } from 'vs/editor/common/core/range';
import { CodeEditorWidget } from 'vs/editor/browser/widget/codeEditorWidget';

export interface IDiffLinesChange {
	readonly originalStartLineNumber: number;
	readonly originalEndLineNumber: number;
	readonly modifiedStartLineNumber: number;
	readonly modifiedEndLineNumber: number;
	readonly originalContent: string[];
}

export class InlineDiffMargin extends Disposable {
	private readonly _diffActions: HTMLElement;

	private _visibility: boolean = false;

	get visibility(): boolean {
		return this._visibility;
	}

	set visibility(_visibility: boolean) {
		if (this._visibility !== _visibility) {
			this._visibility = _visibility;

			if (_visibility) {
				this._diffActions.style.visibility = 'visible';
			} else {
				this._diffActions.style.visibility = 'hidden';
			}
		}
	}

	constructor(
		private _viewZoneId: string,
		private _marginDomNode: HTMLElement,
		public editor: CodeEditorWidget,
		public diff: IDiffLinesChange,
		private _contextMenuService: IContextMenuService,
		private _clipboardService: IClipboardService
	) {
		super();

		// make sure the diff margin shows above overlay.
		this._marginDomNode.style.zIndex = '10';

		this._diffActions = document.createElement('div');
		this._diffActions.className = 'lightbulb-glyph';
		this._diffActions.style.position = 'absolute';
		const lineHeight = editor.getConfiguration().lineHeight;
		const lineFeed = editor.getModel()!.getEOL();
		this._diffActions.style.right = '0px';
		this._diffActions.style.visibility = 'hidden';
		this._diffActions.style.height = `${lineHeight}px`;
		this._diffActions.style.lineHeight = `${lineHeight}px`;
		this._marginDomNode.appendChild(this._diffActions);

		const actions = [
			new Action(
				'diff.clipboard.copyDeletedContent',
				nls.localize('diff.clipboard.copyDeletedContent.label', "Copy deleted lines content to clipboard"),
				undefined,
				true,
				async () => {
					await this._clipboardService.writeText(diff.originalContent.join(lineFeed) + lineFeed);
				}
			)
		];

		let currentLineNumberOffset = 0;

		let copyLineAction: Action | undefined = undefined;

		if (diff.originalEndLineNumber > diff.modifiedStartLineNumber) {
			copyLineAction = new Action(
				'diff.clipboard.copyDeletedLineContent',
				nls.localize('diff.clipboard.copyDeletedLineContent.label', "Copy deleted line {0} content to clipboard", diff.originalStartLineNumber),
				undefined,
				true,
				async () => {
					await this._clipboardService.writeText(diff.originalContent[currentLineNumberOffset]);
				}
			);

			actions.push(copyLineAction);
		}

		const readOnly = editor.getConfiguration().readOnly;
		if (!readOnly) {
			actions.push(new Action('diff.inline.revertChange', nls.localize('diff.inline.revertChange.label', "Revert this change"), undefined, true, async () => {
				if (diff.modifiedEndLineNumber === 0) {
					// deletion only
					const column = editor.getModel()!.getLineMaxColumn(diff.modifiedStartLineNumber);
					editor.executeEdits('diffEditor', [
						{
							range: new Range(diff.modifiedStartLineNumber, column, diff.modifiedStartLineNumber, column),
							text: lineFeed + diff.originalContent.join(lineFeed)
						}
					]);
				} else {
					const column = editor.getModel()!.getLineMaxColumn(diff.modifiedEndLineNumber);
					editor.executeEdits('diffEditor', [
						{
							range: new Range(diff.modifiedStartLineNumber, 1, diff.modifiedEndLineNumber, column),
							text: diff.originalContent.join(lineFeed)
						}
					]);
				}

			}));
		}

		this._register(dom.addStandardDisposableListener(this._diffActions, 'mousedown', e => {
			const { top, height } = dom.getDomNodePagePosition(this._diffActions);
			let pad = Math.floor(lineHeight / 3) + lineHeight;
			this._contextMenuService.showContextMenu({
				getAnchor: () => {
					return {
						x: e.posx,
						y: top + height + pad
					};
				},
				getActions: () => {
					if (copyLineAction) {
						copyLineAction.label = nls.localize('diff.clipboard.copyDeletedLineContent.label', "Copy deleted line {0} content to clipboard", diff.originalStartLineNumber + currentLineNumberOffset);
					}
					return actions;
				},
				autoSelectFirstItem: true
			});
		}));

		this._register(editor.onMouseMove((e: editorBrowser.IEditorMouseEvent) => {
			if (e.target.type === editorBrowser.MouseTargetType.CONTENT_VIEW_ZONE || e.target.type === editorBrowser.MouseTargetType.GUTTER_VIEW_ZONE) {
				const viewZoneId = e.target.detail.viewZoneId;

				if (viewZoneId === this._viewZoneId) {
					this.visibility = true;
					currentLineNumberOffset = this._updateLightBulbPosition(this._marginDomNode, e.event.browserEvent.y, lineHeight);
				} else {
					this.visibility = false;
				}
			} else {
				this.visibility = false;
			}
		}));
	}

	private _updateLightBulbPosition(marginDomNode: HTMLElement, y: number, lineHeight: number): number {
		const { top } = dom.getDomNodePagePosition(marginDomNode);
		const offset = y - top;
		const lineNumberOffset = Math.floor(offset / lineHeight);
		const newTop = lineNumberOffset * lineHeight;
		this._diffActions.style.top = `${newTop}px`;
		return lineNumberOffset;
	}
}
