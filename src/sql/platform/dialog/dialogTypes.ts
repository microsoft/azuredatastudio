/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import Event, { Emitter } from 'vs/base/common/event';

export class OptionsDialogButton {
	constructor(public label: string, public callback: () => void) { }
}

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

	constructor(public title: string) { }

	public updateContent(): void { }
}

export class Dialog implements sqlops.window.modelviewdialog.Dialog {
	public content: string | DialogTab[];
	public okTitle: string;
	public cancelTitle: string;
	public customButtons: DialogButton[];

	private _onOk: Emitter<void> = new Emitter<void>();
	public readonly onOk: Event<void> = this._onOk.event;
	private _onCancel: Emitter<void> = new Emitter<void>();
	public readonly onCancel: Event<void> = this._onCancel.event;

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
}