/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { localize } from 'vs/nls';
import Event, { Emitter } from 'vs/base/common/event';

export class ModelViewPane {
	private _valid: boolean = true;
	private _validityChangedEmitter = new Emitter<boolean>();
	public readonly onValidityChanged = this._validityChangedEmitter.event;

	public get valid(): boolean {
		return this._valid;
	}

	public notifyValidityChanged(valid: boolean) {
		if (this._valid !== valid) {
			this._valid = valid;
			this._validityChangedEmitter.fire(this._valid);
		}
	}
}

export class DialogTab extends ModelViewPane {
	public content: string;

	constructor(public title: string, content?: string) {
		super();
		if (content) {
			this.content = content;
		}
	}
}

export class Dialog extends ModelViewPane {
	private static readonly DONE_BUTTON_LABEL = localize('dialogModalDoneButtonLabel', 'Done');
	private static readonly CANCEL_BUTTON_LABEL = localize('dialogModalCancelButtonLabel', 'Cancel');

	public content: string | DialogTab[];
	public okButton: DialogButton = new DialogButton(Dialog.DONE_BUTTON_LABEL, true);
	public cancelButton: DialogButton = new DialogButton(Dialog.CANCEL_BUTTON_LABEL, true);
	public customButtons: DialogButton[];

	constructor(public title: string, content?: string | DialogTab[]) {
		super();
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

export class WizardPage extends DialogTab {
	public customButtons: DialogButton[];
	private _enabled: boolean;
	private _onUpdate: Emitter<void> = new Emitter<void>();
	public readonly onUpdate: Event<void> = this._onUpdate.event;

	constructor(public title: string, content?: string) {
		super(title, content);
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(enabled: boolean) {
		this._enabled = enabled;
		this._onUpdate.fire();
	}
}

export class Wizard {
	public pages: WizardPage[];
	public nextButton: DialogButton;
	public backButton: DialogButton;
	public doneButton: DialogButton;
	public cancelButton: DialogButton;
	public customButtons: DialogButton[];
	private _currentPage: number;
	private _pageChangedEmitter = new Emitter<sqlops.window.modelviewdialog.WizardPageChangeInfo>();
	public readonly onPageChanged = this._pageChangedEmitter.event;
	private _pageAddedEmitter = new Emitter<WizardPage>();
	public readonly onPageAdded = this._pageAddedEmitter.event;
	private _pageRemovedEmitter = new Emitter<WizardPage>();
	public readonly onPageRemoved = this._pageRemovedEmitter.event;

	constructor(public title: string) { }

	public get currentPage(): number {
		return this._currentPage;
	}

	public setCurrentPage(index: number): void {
		if (index === undefined || index < 0 || index >= this.pages.length) {
			throw new Error('Index is out of bounds');
		}
		let lastPage = this._currentPage;
		this._currentPage = index;
		if (lastPage !== undefined && this._currentPage !== undefined && lastPage !== this._currentPage) {
			this._pageChangedEmitter.fire({
				lastPage: lastPage,
				newPage: this._currentPage
			});
		}
	}

	public addPage(page: WizardPage, index?: number): void {
		if (index !== undefined && (index < 0 || index > this.pages.length)) {
			throw new Error('Index is out of bounds');
		}
		if (index !== undefined && this.currentPage !== undefined && index <= this.currentPage) {
			this._currentPage += 1;
		}
		if (index === undefined) {
			this.pages.push(page);
		} else {
			this.pages = this.pages.slice(0, index).concat([page], this.pages.slice(index));
		}
		this._pageAddedEmitter.fire(page);
	}

	public removePage(index: number): void {
		if (index === undefined || index < 0 || index >= this.pages.length) {
			throw new Error('Index is out of bounds');
		}
		if (index === this.currentPage) {
			// Switch to the new page before deleting the current page
			let newPage = this._currentPage > 0 ? this._currentPage - 1 : this._currentPage + 1;
			this.setCurrentPage(newPage);
		}
		if (this.currentPage !== undefined && index < this.currentPage) {
			this._currentPage -= 1;
		}
		let removedPage = this.pages[index];
		this.pages.splice(index, 1);
		this._pageRemovedEmitter.fire(removedPage);
	}
}