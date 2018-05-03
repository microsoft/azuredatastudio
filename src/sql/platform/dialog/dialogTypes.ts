/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { localize } from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';

export class DialogTab implements sqlops.window.modelviewdialog.DialogTab {
	public content: string;

	constructor(public title: string, content?: string) {
		if (content) {
			this.content = content;
		}
	}
}

export class Dialog implements sqlops.window.modelviewdialog.Dialog {
	private static readonly DONE_BUTTON_LABEL = localize('dialogModalDoneButtonLabel', 'Done');
	private static readonly CANCEL_BUTTON_LABEL = localize('dialogModalCancelButtonLabel', 'Cancel');

	public content: string | DialogTab[];
	public okButton: DialogButton = new DialogButton(Dialog.DONE_BUTTON_LABEL, true);
	public cancelButton: DialogButton = new DialogButton(Dialog.CANCEL_BUTTON_LABEL, true);
	public customButtons: DialogButton[];

	constructor(public title: string, content?: string | DialogTab[]) {
		if (content) {
			this.content = content;
		}
	}
}

export class DialogButton implements sqlops.window.modelviewdialog.Button {
	private _label: string;
	private _enabled: boolean;
	private _hidden: boolean;
	private _onClick: Emitter<void> = new Emitter<void>();
	public readonly onClick: Event<void> = this._onClick.event;
	private _onUpdate: Emitter<void> = new Emitter<void>();
	public readonly onUpdate: Event<void> = this._onUpdate.event;

	constructor(label: string, enabled: boolean) {
		this._label = label;
		this._enabled = enabled;
		this._hidden = false;
	}

	public get label(): string {
		return this._label;
	}

	public set label(label: string) {
		this._label = label;
		this._onUpdate.fire();
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(enabled: boolean) {
		this._enabled = enabled;
		this._onUpdate.fire();
	}

	public get hidden(): boolean {
		return this._hidden;
	}

	public set hidden(hidden: boolean) {
		this._hidden = hidden;
		this._onUpdate.fire();
	}

	/**
	 * Register an event that notifies the button that it has been clicked
	 */
	public registerClickEvent(clickEvent: Event<void>): void {
		clickEvent(() => this._onClick.fire());
	}
}