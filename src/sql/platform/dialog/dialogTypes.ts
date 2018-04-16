/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { Event } from 'vscode';
import { Emitter } from 'vs/base/common/event';

export class OptionsDialogButton {
	constructor(public label: string, public callback: () => void) { }
}

export class Wizard {
	public pages: DialogPage[];
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

export class DialogPage {
	public content: sqlops.ServiceOption[];

	constructor(public title: string) { }
}

export class Dialog {
	constructor(public title: string, public tabs: DialogPage[]) { }
}

export class DialogButton {
	public label: string;
	public enabled: boolean;
	public onClicked: Event<void>;
	private _onClicked: Emitter<void>;
	constructor(label: string, enabled: boolean) {
		this.label = label;
		this.enabled = enabled;
		this._onClicked = new Emitter<void>();
		this.onClicked = this._onClicked.event;
	}
	public toOptionsDialogButton(): OptionsDialogButton {
		return new OptionsDialogButton(this.label, () => this._onClicked.fire());
	}
}