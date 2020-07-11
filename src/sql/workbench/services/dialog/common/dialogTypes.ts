/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { localize } from 'vs/nls';
import { Event, Emitter } from 'vs/base/common/event';
import { DialogMessage, DialogWidth } from 'sql/workbench/api/common/sqlExtHostTypes';

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
	private static readonly DONE_BUTTON_LABEL = localize('dialogModalDoneButtonLabel', "Done");
	private static readonly CANCEL_BUTTON_LABEL = localize('dialogModalCancelButtonLabel', "Cancel");

	public content: string | DialogTab[];
	public width: DialogWidth;
	public okButton: DialogButton = new DialogButton(Dialog.DONE_BUTTON_LABEL, true);
	public cancelButton: DialogButton = new DialogButton(Dialog.CANCEL_BUTTON_LABEL, true);
	public customButtons: DialogButton[];
	private _onMessageChange = new Emitter<DialogMessage>();
	public readonly onMessageChange = this._onMessageChange.event;
	private _message: DialogMessage;
	private _closeValidator: () => boolean | Thenable<boolean>;

	constructor(public title: string, content?: string | DialogTab[]) {
		super();
		if (content) {
			this.content = content;
		}
	}

	public get message(): DialogMessage {
		return this._message;
	}

	public set message(value: DialogMessage) {
		this._message = value;
		this._onMessageChange.fire(this._message);
	}

	public registerCloseValidator(validator: () => boolean | Thenable<boolean>): void {
		this._closeValidator = validator;
	}

	public validateClose(): Thenable<boolean> {
		if (this._closeValidator) {
			return Promise.resolve(this._closeValidator());
		} else {
			return Promise.resolve(true);
		}
	}
}

export class DialogButton implements azdata.window.Button {
	private _label: string;
	private _enabled: boolean;
	private _hidden: boolean;
	private _focused: boolean;
	private _position?: azdata.window.DialogButtonPosition;
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

	public get focused(): boolean {
		return this._focused;
	}

	public set focused(focused: boolean) {
		this._focused = focused;
		this._onUpdate.fire();
	}

	public get position(): azdata.window.DialogButtonPosition | undefined {
		return this._position;
	}

	public set position(value: azdata.window.DialogButtonPosition | undefined) {
		this._position = value;
		this._onUpdate.fire();
	}

	/**
	 * Register an event that notifies the button that it has been clicked
	 */
	public registerClickEvent(clickEvent: Event<any>): void {
		clickEvent(() => this._onClick.fire());
	}
}

export class WizardPage extends DialogTab {
	public customButtons: DialogButton[];
	private _enabled: boolean;
	private _description: string;
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

	public get description(): string {
		return this._description;
	}

	public set description(description: string) {
		this._description = description;
		this._onUpdate.fire();
	}
}

export class Wizard {
	public pages: WizardPage[];
	public nextButton: DialogButton;
	public backButton: DialogButton;
	public generateScriptButton: DialogButton;
	public doneButton: DialogButton;
	public cancelButton: DialogButton;
	public customButtons: DialogButton[];
	private _currentPage: number;
	private _pageChangedEmitter = new Emitter<azdata.window.WizardPageChangeInfo>();
	public readonly onPageChanged = this._pageChangedEmitter.event;
	private _pageAddedEmitter = new Emitter<WizardPage>();
	public readonly onPageAdded = this._pageAddedEmitter.event;
	private _pageRemovedEmitter = new Emitter<WizardPage>();
	public readonly onPageRemoved = this._pageRemovedEmitter.event;
	private _navigationValidator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean | Thenable<boolean>;
	private _onMessageChange = new Emitter<DialogMessage>();
	public readonly onMessageChange = this._onMessageChange.event;
	private _message: DialogMessage;
	public displayPageTitles: boolean;
	public width: DialogWidth;

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
			++this._currentPage;
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
			--this._currentPage;
		}
		let removedPage = this.pages[index];
		this.pages.splice(index, 1);
		this._pageRemovedEmitter.fire(removedPage);
	}

	public registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean | Thenable<boolean>): void {
		this._navigationValidator = validator;
	}

	public validateNavigation(newPage: number): Thenable<boolean> {
		if (this._navigationValidator) {
			return Promise.resolve(this._navigationValidator({
				lastPage: this._currentPage,
				newPage: newPage
			}));
		} else {
			return Promise.resolve(true);
		}
	}

	public get message(): DialogMessage {
		return this._message;
	}

	public set message(value: DialogMessage) {
		this._message = value;
		this._onMessageChange.fire(this._message);
	}
}
