/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { localize } from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';

export class Wizard {
	public pages: DialogTab[];
	public nextButton: DialogButton;
	public backButton: DialogButton;
	public customButtons: DialogButton[];

	public onCompleted: Event<{ [name: string]: string }[]>;
	private _onCompleted: Emitter<{ [name: string]: string }[]>;

	constructor(public title: string) {
		this._onCompleted = new Emitter();
		this.onCompleted = this._onCompleted.event;
	}

	public complete(values: { [name: string]: string }[]): void {
		this._onCompleted.fire(values);
	}
}

export class DialogTab implements sqlops.window.modelviewdialog.DialogTab {
	public content: string;

	constructor(public title: string, content?: string) {
		if (content) {
			this.content = content;
		}
	}

	public updateContent(): void { }
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

	public open(): void { }
	public close(): void { }
	public updateContent(): void { }
}

export class DialogButton implements sqlops.window.modelviewdialog.Button {
	public label: string;
	public enabled: boolean;
	private _onClick: Emitter<void> = new Emitter<void>();
	public readonly onClick: Event<void> = this._onClick.event;

	constructor(label: string, enabled: boolean) {
		this.label = label;
		this.enabled = enabled;
	}

	/**
	 * Register an event that notifies the button that it has been clicked
	 */
	public registerClickEvent(clickEvent: Event<void>): void {
		clickEvent(() => this._onClick.fire());
	}
}