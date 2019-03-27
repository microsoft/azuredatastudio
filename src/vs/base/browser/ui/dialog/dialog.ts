/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dialog';
import * as nls from 'vs/nls';
import { Disposable } from 'vs/base/common/lifecycle';
import { $, hide, show, EventHelper, clearNode, removeClasses, addClass, removeNode } from 'vs/base/browser/dom';
import { domEvent } from 'vs/base/browser/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { KeyCode } from 'vs/base/common/keyCodes';
import { Color } from 'vs/base/common/color';
import { ButtonGroup, IButtonStyles } from 'vs/base/browser/ui/button/button';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { Action } from 'vs/base/common/actions';
import { mnemonicButtonLabel } from 'vs/base/common/labels';

export interface IDialogOptions {
	cancelId?: number;
	detail?: string;
	type?: 'none' | 'info' | 'error' | 'question' | 'warning';
}

export interface IDialogStyles extends IButtonStyles {
	dialogForeground?: Color;
	dialogBackground?: Color;
	dialogShadow?: Color;
}

export class Dialog extends Disposable {
	private element: HTMLElement | undefined;
	private modal: HTMLElement | undefined;
	private buttonsContainer: HTMLElement | undefined;
	private iconElement: HTMLElement | undefined;
	private toolbarContainer: HTMLElement | undefined;
	private buttonGroup: ButtonGroup | undefined;
	private styles: IDialogStyles | undefined;

	constructor(private container: HTMLElement, private message: string, private buttons: string[], private options: IDialogOptions) {
		super();
		this.modal = this.container.appendChild($('.dialog-modal-block'));
		this.element = this.modal.appendChild($('.dialog-box'));
		hide(this.element);

		const buttonsRowElement = this.element.appendChild($('.dialog-buttons-row'));
		this.buttonsContainer = buttonsRowElement.appendChild($('.dialog-buttons'));

		const messageRowElement = this.element.appendChild($('.dialog-message-row'));
		this.iconElement = messageRowElement.appendChild($('.dialog-icon'));
		const messageContainer = messageRowElement.appendChild($('.dialog-message-container'));
		const messageElement = messageContainer.appendChild($('.dialog-message'));
		messageElement.innerText = this.message;
		if (this.options.detail) {
			const messageDetailElement = messageContainer.appendChild($('.dialog-message-detail'));
			messageDetailElement.innerText = this.options.detail;
		}

		const toolbarRowElement = this.element.appendChild($('.dialog-toolbar-row'));
		this.toolbarContainer = toolbarRowElement.appendChild($('.dialog-toolbar'));
	}

	async show(): Promise<number> {
		return new Promise<number>((resolve) => {
			if (!this.element || !this.buttonsContainer || !this.iconElement || !this.toolbarContainer) {
				resolve(0);
				return;
			}

			if (this.modal) {
				this._register(domEvent(this.modal, 'mousedown')(e => {
					// Used to stop focusing of modal with mouse
					EventHelper.stop(e, true);
				}));
			}

			clearNode(this.buttonsContainer);

			let focusedButton = 0;
			this.buttonGroup = new ButtonGroup(this.buttonsContainer, this.buttons.length, { title: true });
			this.buttonGroup.buttons.forEach((button, index) => {
				button.label = mnemonicButtonLabel(this.buttons[index], true);

				this._register(button.onDidClick(e => {
					EventHelper.stop(e);
					resolve(index);
				}));
			});

			this._register(domEvent(this.element, 'keydown', true)((e: KeyboardEvent) => {
				const evt = new StandardKeyboardEvent(e);
				if (evt.equals(KeyCode.Enter)) {
					return;
				}

				if (this.buttonGroup) {
					if ((evt.shiftKey && evt.equals(KeyCode.Tab)) || evt.equals(KeyCode.LeftArrow)) {
						focusedButton = focusedButton + this.buttonGroup.buttons.length - 1;
						focusedButton = focusedButton % this.buttonGroup.buttons.length;
						this.buttonGroup.buttons[focusedButton].focus();
					} else if (evt.equals(KeyCode.Tab) || evt.equals(KeyCode.RightArrow)) {
						focusedButton++;
						focusedButton = focusedButton % this.buttonGroup.buttons.length;
						this.buttonGroup.buttons[focusedButton].focus();
					}
				}

				EventHelper.stop(e, true);
			}));

			this._register(domEvent(this.element, 'keyup', true)((e: KeyboardEvent) => {
				EventHelper.stop(e, true);
				const evt = new StandardKeyboardEvent(e);

				if (evt.equals(KeyCode.Escape)) {
					resolve(this.options.cancelId || 0);
				}
			}));

			removeClasses(this.iconElement, 'icon-error', 'icon-warning', 'icon-info');

			switch (this.options.type) {
				case 'error':
					addClass(this.iconElement, 'icon-error');
					break;
				case 'warning':
					addClass(this.iconElement, 'icon-warning');
					break;
				case 'none':
				case 'info':
				case 'question':
				default:
					addClass(this.iconElement, 'icon-info');
					break;
			}

			const actionBar = new ActionBar(this.toolbarContainer, {});

			const action = new Action('dialog.close', nls.localize('dialogClose', "Close Dialog"), 'dialog-close-action', true, () => {
				resolve(this.options.cancelId || 0);
				return Promise.resolve();
			});

			actionBar.push(action, { icon: true, label: false, });

			this.applyStyles();

			show(this.element);

			// Focus first element
			this.buttonGroup.buttons[focusedButton].focus();
		});
	}

	private applyStyles() {
		if (this.styles) {
			const style = this.styles;

			const fgColor = style.dialogForeground ? `${style.dialogForeground}` : null;
			const bgColor = style.dialogBackground ? `${style.dialogBackground}` : null;
			const shadowColor = style.dialogShadow ? `0 0px 8px ${style.dialogShadow}` : null;

			if (this.element) {
				this.element.style.color = fgColor;
				this.element.style.backgroundColor = bgColor;
				this.element.style.boxShadow = shadowColor;

				if (this.buttonGroup) {
					this.buttonGroup.buttons.forEach(button => button.style(style));
				}
			}
		}
	}

	style(style: IDialogStyles): void {
		this.styles = style;
		this.applyStyles();
	}

	dispose(): void {
		super.dispose();
		if (this.modal) {
			removeNode(this.modal);
			this.modal = undefined;
		}
	}
}