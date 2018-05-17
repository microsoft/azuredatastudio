/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import Event, { Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';
import * as nls from 'vs/nls';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

import { SqlMainContext, ExtHostModelViewDialogShape, MainThreadModelViewDialogShape, ExtHostModelViewShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IItemConfig, ModelComponentTypes, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';

const DONE_LABEL = nls.localize('dialogDoneLabel', 'Done');
const CANCEL_LABEL = nls.localize('dialogCancelLabel', 'Cancel');
const NEXT_LABEL = nls.localize('dialogNextLabel', 'Next');
const PREVIOUS_LABEL = nls.localize('dialogPreviousLabel', 'Previous');

class ModelViewPanelImpl implements sqlops.window.modelviewdialog.ModelViewPanel {
	private _modelView: sqlops.ModelView;
	private _handle: number;
	private _modelViewId: string;
	protected _valid: boolean = true;
	protected _onValidityChanged: vscode.Event<boolean>;

	constructor(private _viewType: string,
		protected _extHostModelViewDialog: ExtHostModelViewDialog,
		protected _extHostModelView: ExtHostModelViewShape) {
		this._onValidityChanged = this._extHostModelViewDialog.getValidityChangedEvent(this);
		this._onValidityChanged(valid => this._valid = valid);
	}

	public registerContent(handler: (view: sqlops.ModelView) => void): void {
		if (!this._modelViewId) {
			let viewId = this._viewType + this.handle;
			this.setModelViewId(viewId);
			this._extHostModelView.$registerProvider(viewId, modelView => {
				this._modelView = modelView;
				handler(modelView);
			});
		}
	}

	public set handle(value: number) {
		this._handle = value;
	}

	public setModelViewId(value: string) {
		this._modelViewId = value;
	}

	public get modelView(): sqlops.ModelView {
		return this._modelView;
	}

	public set modelView(value: sqlops.ModelView) {
		this._modelView = value;
	}

	public get valid(): boolean {
		return this._valid;
	}

	public get onValidityChanged(): Event<boolean> {
		return this._onValidityChanged;
	}
}

class DialogImpl extends ModelViewPanelImpl implements sqlops.window.modelviewdialog.Dialog {
	public title: string;
	public content: string | sqlops.window.modelviewdialog.DialogTab[];
	public okButton: sqlops.window.modelviewdialog.Button;
	public cancelButton: sqlops.window.modelviewdialog.Button;
	public customButtons: sqlops.window.modelviewdialog.Button[];

	constructor(extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape) {
		super('modelViewDialog', extHostModelViewDialog, extHostModelView);
		this.okButton = this._extHostModelViewDialog.createButton(DONE_LABEL);
		this.cancelButton = this._extHostModelViewDialog.createButton(CANCEL_LABEL);
	}

	public setModelViewId(value: string) {
		super.setModelViewId(value);
		this.content = value;
	}
}

class TabImpl extends ModelViewPanelImpl implements sqlops.window.modelviewdialog.DialogTab {
	constructor(
		extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape) {
		super('modelViewDialogTab', extHostModelViewDialog, extHostModelView);
	}

	public title: string;
	public content: string;
	public handle: number;

	public setModelViewId(value: string) {
		super.setModelViewId(value);
		this.content = value;
	}
}

class ButtonImpl implements sqlops.window.modelviewdialog.Button {
	private _label: string;
	private _enabled: boolean;
	private _hidden: boolean;

	private _onClick = new Emitter<void>();
	public onClick = this._onClick.event;

	constructor(private _extHostModelViewDialog: ExtHostModelViewDialog) {
		this._enabled = true;
		this._hidden = false;
	}

	public get label(): string {
		return this._label;
	}

	public set label(label: string) {
		this._label = label;
		this._extHostModelViewDialog.updateButton(this);
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(enabled: boolean) {
		this._enabled = enabled;
		this._extHostModelViewDialog.updateButton(this);
	}

	public get hidden(): boolean {
		return this._hidden;
	}

	public set hidden(hidden: boolean) {
		this._hidden = hidden;
		this._extHostModelViewDialog.updateButton(this);
	}

	public getOnClickCallback(): () => void {
		return () => this._onClick.fire();
	}
}

class WizardPageImpl extends ModelViewPanelImpl implements sqlops.window.modelviewdialog.WizardPage {
	public content: string;
	public customButtons: sqlops.window.modelviewdialog.Button[];
	private _enabled: boolean = true;

	constructor(public title: string, _extHostModelViewDialog: ExtHostModelViewDialog, _extHostModelView: ExtHostModelViewShape) {
		super('modelViewWizardPage', _extHostModelViewDialog, _extHostModelView);
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(enabled: boolean) {
		this._enabled = enabled;
		this._extHostModelViewDialog.updateWizardPage(this);
	}
}

class WizardImpl implements sqlops.window.modelviewdialog.Wizard {
	private _currentPage: number = undefined;
	private _pages: sqlops.window.modelviewdialog.WizardPage[];
	public doneButton: sqlops.window.modelviewdialog.Button;
	public cancelButton: sqlops.window.modelviewdialog.Button;
	public nextButton: sqlops.window.modelviewdialog.Button;
	public backButton: sqlops.window.modelviewdialog.Button;
	public customButtons: sqlops.window.modelviewdialog.Button[];
	public readonly onPageChanged: Event<sqlops.window.modelviewdialog.WizardPageChangeInfo>;

	constructor(public title: string, pages: sqlops.window.modelviewdialog.WizardPage[],
		private _extHostModelViewDialog: ExtHostModelViewDialog) {
		this._pages = pages;
		this.doneButton = this._extHostModelViewDialog.createButton(DONE_LABEL);
		this.cancelButton = this._extHostModelViewDialog.createButton(CANCEL_LABEL);
		this.nextButton = this._extHostModelViewDialog.createButton(NEXT_LABEL);
		this.backButton = this._extHostModelViewDialog.createButton(PREVIOUS_LABEL);
		this.onPageChanged = this._extHostModelViewDialog.getWizardPageChangedEvent(this);
		this.onPageChanged(info => this._currentPage = info.newPage);
	}

	public get currentPage(): number {
		return this._currentPage;
	}

	public get pages(): sqlops.window.modelviewdialog.WizardPage[] {
		return this._pages;
	}

	public addPage(page: sqlops.window.modelviewdialog.WizardPage, index?: number) {
		if (index !== undefined && (index < 0 || index > this._pages.length)) {
			throw new Error('Index is out of bounds');
		}
		if (index !== undefined && this.currentPage !== undefined && index <= this.currentPage) {
			this._currentPage += 1;
		}
		if (index === undefined) {
			this._pages.push(page);
		} else {
			this._pages = this._pages.slice(0, index).concat([page], this._pages.slice(index));
		}
		this._extHostModelViewDialog.updateWizard(this);
	}

	public removePage(index: number) {
		if (index === undefined || index < 0 || index >= this._pages.length) {
			throw new Error('Index is out of bounds');
		}
		if (this.currentPage !== undefined && index <= this.currentPage) {
			this._currentPage -= 1;
		}
		this._pages.splice(index, 1);
		this._extHostModelViewDialog.updateWizard(this);
	}

	public setCurrentPage(index: number) {
		if (index >= 0 && index < this.pages.length) {
			this._currentPage = index;
			this._extHostModelViewDialog.updateWizard(this);
		} else {
			throw new Error('Page does not exist');
		}
	}
}

export class ExtHostModelViewDialog implements ExtHostModelViewDialogShape {
	private static _currentHandle = 0;

	private readonly _proxy: MainThreadModelViewDialogShape;

	private readonly _objectHandles = new Map<object, number>();
	private readonly _validityEmitters = new Map<number, Emitter<boolean>>();
	private readonly _pageChangedEmitters = new Map<number, Emitter<sqlops.window.modelviewdialog.WizardPageChangeInfo>>();
	private readonly _onClickCallbacks = new Map<number, () => void>();

	constructor(
		mainContext: IMainContext,
		private _extHostModelView: ExtHostModelViewShape
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadModelViewDialog);
	}

	private static getNewHandle() {
		let handle = ExtHostModelViewDialog._currentHandle;
		ExtHostModelViewDialog._currentHandle += 1;
		return handle;
	}

	private getHandle(item: sqlops.window.modelviewdialog.Button | sqlops.window.modelviewdialog.Dialog | sqlops.window.modelviewdialog.DialogTab
		| sqlops.window.modelviewdialog.ModelViewPanel | sqlops.window.modelviewdialog.Wizard | sqlops.window.modelviewdialog.WizardPage) {
		let handle = this._objectHandles.get(item);
		if (handle === undefined) {
			handle = ExtHostModelViewDialog.getNewHandle();
			this._objectHandles.set(item, handle);
		}
		return handle;
	}

	public $onButtonClick(handle: number): void {
		this._onClickCallbacks.get(handle)();
	}

	public $onPanelValidityChanged(handle: number, valid: boolean): void {
		let emitter = this._validityEmitters.get(handle);
		if (emitter) {
			emitter.fire(valid);
		}
	}

	public $onWizardPageChanged(handle: number, info: sqlops.window.modelviewdialog.WizardPageChangeInfo): void {
		let emitter = this._pageChangedEmitters.get(handle);
		if (emitter) {
			emitter.fire(info);
		}
	}

	public openDialog(dialog: sqlops.window.modelviewdialog.Dialog): void {
		let handle = this.getHandle(dialog);
		this.updateDialogContent(dialog);
		this._proxy.$openDialog(handle);
	}

	public closeDialog(dialog: sqlops.window.modelviewdialog.Dialog): void {
		let handle = this.getHandle(dialog);
		this._proxy.$closeDialog(handle);
	}

	public updateDialogContent(dialog: sqlops.window.modelviewdialog.Dialog): void {
		let handle = this.getHandle(dialog);
		let tabs = dialog.content;
		if (tabs && typeof tabs !== 'string') {
			tabs.forEach(tab => this.updateTabContent(tab));
		}
		if (dialog.customButtons) {
			dialog.customButtons.forEach(button => this.updateButton(button));
		}
		this.updateButton(dialog.okButton);
		this.updateButton(dialog.cancelButton);
		this._proxy.$setDialogDetails(handle, {
			title: dialog.title,
			okButton: this.getHandle(dialog.okButton),
			cancelButton: this.getHandle(dialog.cancelButton),
			content: dialog.content && typeof dialog.content !== 'string' ? dialog.content.map(tab => this.getHandle(tab)) : dialog.content as string,
			customButtons: dialog.customButtons ? dialog.customButtons.map(button => this.getHandle(button)) : undefined
		});
	}

	public updateTabContent(tab: sqlops.window.modelviewdialog.DialogTab): void {
		let handle = this.getHandle(tab);
		this._proxy.$setTabDetails(handle, {
			title: tab.title,
			content: tab.content
		});
	}

	public updateButton(button: sqlops.window.modelviewdialog.Button): void {
		let handle = this.getHandle(button);
		this._proxy.$setButtonDetails(handle, {
			label: button.label,
			enabled: button.enabled,
			hidden: button.hidden
		});
	}

	public registerOnClickCallback(button: sqlops.window.modelviewdialog.Button, callback: () => void) {
		let handle = this.getHandle(button);
		this._onClickCallbacks.set(handle, callback);
	}

	public createDialog(title: string): sqlops.window.modelviewdialog.Dialog {
		let dialog = new DialogImpl(this, this._extHostModelView);
		dialog.title = title;
		dialog.handle = this.getHandle(dialog);
		return dialog;
	}

	public createTab(title: string): sqlops.window.modelviewdialog.DialogTab {
		let tab = new TabImpl(this, this._extHostModelView);
		tab.title = title;
		tab.handle = this.getHandle(tab);
		return tab;
	}

	public createButton(label: string): sqlops.window.modelviewdialog.Button {
		let button = new ButtonImpl(this);
		this.getHandle(button);
		this.registerOnClickCallback(button, button.getOnClickCallback());
		button.label = label;
		return button;
	}

	public getValidityChangedEvent(panel: sqlops.window.modelviewdialog.ModelViewPanel) {
		let handle = this.getHandle(panel);
		let emitter = this._validityEmitters.get(handle);
		if (!emitter) {
			emitter = new Emitter<boolean>();
			this._validityEmitters.set(handle, emitter);
		}
		return emitter.event;
	}

	public getWizardPageChangedEvent(wizard: sqlops.window.modelviewdialog.Wizard) {
		let handle = this.getHandle(wizard);
		let emitter = this._pageChangedEmitters.get(handle);
		if (!emitter) {
			emitter = new Emitter<sqlops.window.modelviewdialog.WizardPageChangeInfo>();
			this._pageChangedEmitters.set(handle, emitter);
		}
		return emitter.event;
	}

	public createWizardPage(title: string): sqlops.window.modelviewdialog.WizardPage {
		let page = new WizardPageImpl(title, this, this._extHostModelView);
		page.handle = this.getHandle(page);
		return page;
	}

	public createWizard(title: string, pages: sqlops.window.modelviewdialog.WizardPage[]): sqlops.window.modelviewdialog.Wizard {
		let wizard = new WizardImpl(title, pages, this);
		this.getHandle(wizard);
		return wizard;
	}

	public updateWizardPage(page: sqlops.window.modelviewdialog.WizardPage): void {
		let handle = this.getHandle(page);
		if (page.customButtons) {
			page.customButtons.forEach(button => this.updateButton(button));
		}
		this._proxy.$setWizardPageDetails(handle, {
			content: page.content,
			customButtons: page.customButtons ? page.customButtons.map(button => this.getHandle(button)) : undefined,
			enabled: page.enabled,
			title: page.title
		});
	}

	public updateWizard(wizard: sqlops.window.modelviewdialog.Wizard): void {
		let handle = this.getHandle(wizard);
		wizard.pages.forEach(page => this.updateWizardPage(page));
		this.updateButton(wizard.backButton);
		this.updateButton(wizard.cancelButton);
		this.updateButton(wizard.doneButton);
		this.updateButton(wizard.nextButton);
		if (wizard.customButtons) {
			wizard.customButtons.forEach(button => this.updateButton(button));
		}
		this._proxy.$setWizardDetails(handle, {
			title: wizard.title,
			pages: wizard.pages.map(page => this.getHandle(page)),
			currentPage: wizard.currentPage,
			backButton: this.getHandle(wizard.backButton),
			cancelButton: this.getHandle(wizard.cancelButton),
			doneButton: this.getHandle(wizard.doneButton),
			nextButton: this.getHandle(wizard.nextButton),
			customButtons: wizard.customButtons ? wizard.customButtons.map(button => this.getHandle(button)) : undefined
		});
	}

	public openWizard(wizard: sqlops.window.modelviewdialog.Wizard): void {
		let handle = this.getHandle(wizard);
		this.updateWizard(wizard);
		this._proxy.$openWizard(handle);
	}

	public closeWizard(wizard: sqlops.window.modelviewdialog.Wizard): void {
		let handle = this.getHandle(wizard);
		this._proxy.$closeWizard(handle);
	}
}