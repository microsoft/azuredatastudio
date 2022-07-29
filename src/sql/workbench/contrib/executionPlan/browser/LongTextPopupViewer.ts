/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/LongTextPopupViewer';

import * as DOM from 'vs/base/browser/dom';
import { isString } from 'vs/base/common/types';
import { editorBackground, editorForeground, textBlockQuoteBorder } from 'vs/platform/theme/common/colorRegistry';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';

export class LongTextPopupViewer<T extends Slick.SlickData> {

	private _args: Slick.Editors.EditorOptions<T>;
	private _wrapper: HTMLElement;
	private _text: HTMLElement;

	public constructor(args: Slick.Editors.EditorOptions<T>) {
		this._args = args;
		this.init();
	}

	public init(): void {
		this._wrapper = DOM.$('.long-text-popup-viewer-wrapper');
		this._wrapper.style.width = this._args.column.width + 'px';
		this._text = DOM.$('span');
		this._wrapper.tabIndex = 0;
		this._wrapper.appendChild(this._text);
		document.body.appendChild(this._wrapper);
		this.position((<any>this._args).position);


		this._wrapper.addEventListener('keydown', (e: KeyboardEvent) => {
			let eventHandled = false;
			if (e.key === 'Enter' || e.key === 'Escape') {
				(<any>this._args).cancelChanges();
				this.destroy();
				eventHandled = true;
			} else if (e.key === 'Tab' && e.shiftKey) {
				this._args.grid.navigatePrev();
				eventHandled = true;
			} else if (e.key === 'Tab') {
				this._args.grid.navigateNext();
				eventHandled = true;
			} else if (e.key === 'ArrowLeft') {
				this._args.grid.navigateLeft();
				eventHandled = true;
			} else if (e.key === 'ArrowRight') {
				this._args.grid.navigateRight();
				eventHandled = true;
			} else if (e.key === 'ArrowUp') {
				this._args.grid.navigateUp();
				eventHandled = true;
			} else if (e.key === 'ArrowDown') {
				this._args.grid.navigateDown();
				eventHandled = true;
			} else if ((e.key === 'A' || e.key === 'a') && e.ctrlKey) {
				this.selectText();
				eventHandled = true;
			}

			if (eventHandled) {
				e.preventDefault();
				e.stopPropagation();
			}
		});


		this._wrapper.focus();
	}

	public selectText(): void {
		const range = document.createRange();
		range.selectNodeContents(this._text);
		const sel = window.getSelection();
		sel.removeAllRanges();
		sel.addRange(range);
	}

	public position(position: any): void {
		this._wrapper.style.top = position.top + 'px';
		this._wrapper.style.left = position.left + 'px';
	}

	public destroy(): void {
		this._wrapper.remove();
		this._args.grid.focus();
	}

	public focus(): void {
		this._text.focus();
	}

	public loadValue(item: any): void {
		const value = item[this._args.column.field];
		const displayValue = isString(value) ? value : value.displayText ?? value.text ?? value.title;
		this._text.innerText = displayValue;
		this._wrapper.ariaLabel = displayValue;
	}

	public serializeValue(): void {
	}

	public isValueChanged(): boolean {
		return false;
	}

}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const editorBackgroundColor = theme.getColor(editorBackground);
	if (editorBackground) {
		collector.addRule(`.long-text-popup-viewer-wrapper { background-color: ${editorBackgroundColor}; }`);
	}

	const editorTextColor = theme.getColor(editorForeground);
	if (editorTextColor) {
		collector.addRule(`.long-text-popup-viewer-wrapper { color: ${editorTextColor}; }`);
	}

	const editorBorderColor = theme.getColor(textBlockQuoteBorder);
	if (editorBorderColor) {
		collector.addRule(`.long-text-popup-viewer-wrapper { border: 3px solid ${editorBorderColor}; }`);
	}
});
