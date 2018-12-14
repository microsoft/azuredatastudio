/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IMainContext } from 'vs/workbench/api/node/extHost.protocol';
import { Event, Emitter } from 'vs/base/common/event';
import { deepClone } from 'vs/base/common/objects';
import * as nls from 'vs/nls';
import { generateUuid } from 'vs/base/common/uuid';
import URI from 'vs/base/common/uri';

import * as vscode from 'vscode';
import * as sqlops from 'sqlops';

import { SqlMainContext, ExtHostModelViewDialogShape, MainThreadModelViewDialogShape, ExtHostModelViewShape, ExtHostBackgroundTaskManagementShape } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { IItemConfig, ModelComponentTypes, IComponentShape } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { Inject } from '@angular/core';

const DONE_LABEL = nls.localize('dialogDoneLabel', 'Done');
const CANCEL_LABEL = nls.localize('dialogCancelLabel', 'Cancel');
const GENERATE_SCRIPT_LABEL = nls.localize('generateScriptLabel', 'Generate script');
const NEXT_LABEL = nls.localize('dialogNextLabel', 'Next');
const PREVIOUS_LABEL = nls.localize('dialogPreviousLabel', 'Previous');

class ModelViewPanelImpl implements sqlops.window.modelviewdialog.ModelViewPanel {
	private _modelView: sqlops.ModelView;
	private _handle: number;
	protected _modelViewId: string;
	protected _valid: boolean = true;
	protected _onValidityChanged: vscode.Event<boolean>;

	constructor(private _viewType: string,
		protected _extHostModelViewDialog: ExtHostModelViewDialog,
		protected _extHostModelView: ExtHostModelViewShape,
		protected _extensionLocation: URI) {
		this._onValidityChanged = this._extHostModelViewDialog.getValidityChangedEvent(this);
		this._onValidityChanged(valid => this._valid = valid);
	}

	public registerContent(handler: (view: sqlops.ModelView) => Thenable<void>): void {
		if (!this._modelViewId) {
			let viewId = this._viewType + this._handle;
			this.setModelViewId(viewId);
			this._extHostModelView.$registerProvider(viewId, modelView => {
				this._modelView = modelView;
				handler(modelView);
			}, this._extensionLocation);
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

class ModelViewEditorImpl extends ModelViewPanelImpl implements sqlops.workspace.ModelViewEditor {
	private _isDirty: boolean;
	private _saveHandler: () => Thenable<boolean>;

	constructor(
		extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape,
		extensionLocation: URI,
		private _proxy: MainThreadModelViewDialogShape,
		private _title: string,
		private _options: sqlops.ModelViewEditorOptions
	) {
		super('modelViewEditor', extHostModelViewDialog, extHostModelView, extensionLocation);
		this._isDirty = false;
	}

	public openEditor(position?: vscode.ViewColumn): Thenable<void> {
		return this._proxy.$openEditor(this.handle, this._modelViewId, this._title, this._options, position);
	}

	public get isDirty(): boolean {
		return this._isDirty;
	}

	public set isDirty(value: boolean) {
		this._isDirty = value;
		this._proxy.$setDirty(this.handle, value);
	}

	registerSaveHandler(handler: () => Thenable<boolean>): void {
		this._saveHandler = handler;
	}

	public handleSave(): Thenable<boolean> {
		if (this._saveHandler) {
			return Promise.resolve(this._saveHandler());
		} else {
			return Promise.resolve(true);
		}
	}
}

class DialogImpl extends ModelViewPanelImpl implements sqlops.window.modelviewdialog.Dialog {
	public title: string;
	public content: string | sqlops.window.modelviewdialog.DialogTab[];
	public okButton: sqlops.window.modelviewdialog.Button;
	public cancelButton: sqlops.window.modelviewdialog.Button;
	public customButtons: sqlops.window.modelviewdialog.Button[];
	private _message: sqlops.window.modelviewdialog.DialogMessage;
	private _closeValidator: () => boolean | Thenable<boolean>;
	private _operationHandler: BackgroundOperationHandler;
	private _dialogName: string;

	constructor(extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape,
		extHostTaskManagement: ExtHostBackgroundTaskManagementShape,
		extensionLocation: URI) {
		super('modelViewDialog', extHostModelViewDialog, extHostModelView, extensionLocation);
		this.okButton = this._extHostModelViewDialog.createButton(DONE_LABEL);
		this.cancelButton = this._extHostModelViewDialog.createButton(CANCEL_LABEL);
		this._operationHandler = new BackgroundOperationHandler('dialog', extHostTaskManagement);
		this.okButton.onClick(() => {
			this._operationHandler.createOperation();
		});
	}

	public registerOperation(operationInfo: sqlops.BackgroundOperationInfo): void {
		this._operationHandler.registerOperation(operationInfo);
	}

	public setModelViewId(value: string) {
		super.setModelViewId(value);
		this.content = value;
	}

	public get message(): sqlops.window.modelviewdialog.DialogMessage {
		return this._message;
	}

	public set message(value: sqlops.window.modelviewdialog.DialogMessage) {
		this._message = value;
		this._extHostModelViewDialog.updateDialogContent(this);
	}

	public get dialogName(): string {
		return this._dialogName;
	}

	public set dialogName(value: string) {
		this._dialogName = value;
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

class TabImpl extends ModelViewPanelImpl implements sqlops.window.modelviewdialog.DialogTab {
	constructor(
		extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape,
		extensionLocation: URI) {
		super('modelViewDialogTab', extHostModelViewDialog, extHostModelView, extensionLocation);
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

class BackgroundOperationHandler {

	private _operationInfo: sqlops.BackgroundOperationInfo;

	constructor(
		private _name: string,
		private _extHostTaskManagement: ExtHostBackgroundTaskManagementShape) {
	}

	public createOperation(): void {
		if (!this._operationInfo) {
			return;
		}

		if (!this._operationInfo.operationId) {
			let uniqueId = generateUuid();
			this._operationInfo.operationId = 'OperationId' + uniqueId + this._name;
		}

		if (this._operationInfo.operation) {
			this._extHostTaskManagement.$registerTask(this._operationInfo);
		}
	}

	public registerOperation(operationInfo: sqlops.BackgroundOperationInfo): void {
		this._operationInfo = operationInfo;
	}
}

class WizardPageImpl extends ModelViewPanelImpl implements sqlops.window.modelviewdialog.WizardPage {
	public customButtons: sqlops.window.modelviewdialog.Button[];
	private _enabled: boolean = true;
	private _description: string;

	constructor(public title: string,
		extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape,
		extensionLocation: URI) {
		super('modelViewWizardPage', extHostModelViewDialog, extHostModelView, extensionLocation);
	}

	public get enabled(): boolean {
		return this._enabled;
	}

	public set enabled(enabled: boolean) {
		this._enabled = enabled;
		this._extHostModelViewDialog.updateWizardPage(this);
	}

	public get content(): string {
		return this._modelViewId;
	}

	public set content(content: string) {
		this._modelViewId = content;
	}

	public get description(): string {
		return this._description;
	}

	public set description(description: string) {
		this._description = description;
		this._extHostModelViewDialog.updateWizardPage(this);
	}
}

export enum WizardPageInfoEventType {
	PageChanged,
	PageAddedOrRemoved
}

export interface WizardPageEventInfo {
	eventType: WizardPageInfoEventType;
	pageChangeInfo: sqlops.window.modelviewdialog.WizardPageChangeInfo;
	pages?: sqlops.window.modelviewdialog.WizardPage[];
}

class WizardImpl implements sqlops.window.modelviewdialog.Wizard {
	private _currentPage: number = undefined;
	public pages: sqlops.window.modelviewdialog.WizardPage[] = [];
	public doneButton: sqlops.window.modelviewdialog.Button;
	public cancelButton: sqlops.window.modelviewdialog.Button;
	public generateScriptButton: sqlops.window.modelviewdialog.Button;
	public nextButton: sqlops.window.modelviewdialog.Button;
	public backButton: sqlops.window.modelviewdialog.Button;
	public customButtons: sqlops.window.modelviewdialog.Button[];
	private _pageChangedEmitter = new Emitter<sqlops.window.modelviewdialog.WizardPageChangeInfo>();
	public readonly onPageChanged = this._pageChangedEmitter.event;
	private _navigationValidator: (info: sqlops.window.modelviewdialog.WizardPageChangeInfo) => boolean | Thenable<boolean>;
	private _message: sqlops.window.modelviewdialog.DialogMessage;
	private _displayPageTitles: boolean = true;
	private _operationHandler: BackgroundOperationHandler;

	constructor(public title: string, private _extHostModelViewDialog: ExtHostModelViewDialog, extHostTaskManagement: ExtHostBackgroundTaskManagementShape) {
		this.doneButton = this._extHostModelViewDialog.createButton(DONE_LABEL);
		this.cancelButton = this._extHostModelViewDialog.createButton(CANCEL_LABEL);
		this.generateScriptButton = this._extHostModelViewDialog.createButton(GENERATE_SCRIPT_LABEL);
		this.nextButton = this._extHostModelViewDialog.createButton(NEXT_LABEL);
		this.backButton = this._extHostModelViewDialog.createButton(PREVIOUS_LABEL);
		this._extHostModelViewDialog.registerWizardPageInfoChangedCallback(this, info => this.handlePageInfoChanged(info));
		this._currentPage = 0;
		this.onPageChanged(info => this._currentPage = info.newPage);
		this._operationHandler = new BackgroundOperationHandler('wizard' + this.title, extHostTaskManagement);
		this.doneButton.onClick(() => {
			this._operationHandler.createOperation();
		});
	}

	public registerOperation(operationInfo: sqlops.BackgroundOperationInfo): void {
		this._operationHandler.registerOperation(operationInfo);
	}

	public get currentPage(): number {
		return this._currentPage;
	}

	public get message(): sqlops.window.modelviewdialog.DialogMessage {
		return this._message;
	}

	public set message(value: sqlops.window.modelviewdialog.DialogMessage) {
		this._message = value;
		this._extHostModelViewDialog.updateWizard(this);
	}

	public get displayPageTitles(): boolean {
		return this._displayPageTitles;
	}

	public set displayPageTitles(value: boolean) {
		this._displayPageTitles = value;
		this._extHostModelViewDialog.updateWizard(this);
	}

	public addPage(page: sqlops.window.modelviewdialog.WizardPage, index?: number): Thenable<void> {
		return this._extHostModelViewDialog.updateWizardPage(page).then(() => {
			this._extHostModelViewDialog.addPage(this, page, index);
		});
	}

	public removePage(index: number): Thenable<void> {
		return this._extHostModelViewDialog.removePage(this, index);
	}

	public setCurrentPage(index: number): Thenable<void> {
		return this._extHostModelViewDialog.setWizardPage(this, index);
	}

	public open(): Thenable<void> {
		return this._extHostModelViewDialog.openWizard(this);
	}

	public close(): Thenable<void> {
		return this._extHostModelViewDialog.closeWizard(this);
	}

	public registerNavigationValidator(validator: (pageChangeInfo: sqlops.window.modelviewdialog.WizardPageChangeInfo) => boolean | Thenable<boolean>): void {
		this._navigationValidator = validator;
	}

	public validateNavigation(info: sqlops.window.modelviewdialog.WizardPageChangeInfo): Thenable<boolean> {
		if (this._navigationValidator) {
			return Promise.resolve(this._navigationValidator(info));
		} else {
			return Promise.resolve(true);
		}
	}

	private handlePageInfoChanged(info: WizardPageEventInfo): void {
		this._currentPage = info.pageChangeInfo.newPage;
		if (info.eventType === WizardPageInfoEventType.PageAddedOrRemoved) {
			this.pages = info.pages;
		} else if (info.eventType === WizardPageInfoEventType.PageChanged) {
			this._pageChangedEmitter.fire(info.pageChangeInfo);
		}
	}
}

export class ExtHostModelViewDialog implements ExtHostModelViewDialogShape {
	private static _currentHandle = 0;

	private readonly _proxy: MainThreadModelViewDialogShape;

	private readonly _objectHandles = new Map<object, number>();
	private readonly _objectsByHandle = new Map<number, object>();
	private readonly _validityEmitters = new Map<number, Emitter<boolean>>();
	private readonly _pageInfoChangedCallbacks = new Map<number, (info: WizardPageEventInfo) => void>();
	private readonly _onClickCallbacks = new Map<number, () => void>();

	constructor(
		mainContext: IMainContext,
		private _extHostModelView: ExtHostModelViewShape,
		private _extHostTaskManagement: ExtHostBackgroundTaskManagementShape
	) {
		this._proxy = mainContext.getProxy(SqlMainContext.MainThreadModelViewDialog);
	}

	private static getNewHandle() {
		let handle = ExtHostModelViewDialog._currentHandle;
		ExtHostModelViewDialog._currentHandle += 1;
		return handle;
	}

	private getHandle(item: sqlops.window.modelviewdialog.Button | sqlops.window.modelviewdialog.Dialog | sqlops.window.modelviewdialog.DialogTab
		| sqlops.window.modelviewdialog.ModelViewPanel | sqlops.window.modelviewdialog.Wizard | sqlops.window.modelviewdialog.WizardPage | sqlops.workspace.ModelViewEditor) {
		let handle = this._objectHandles.get(item);
		if (handle === undefined) {
			handle = ExtHostModelViewDialog.getNewHandle();
			this._objectHandles.set(item, handle);
			this._objectsByHandle.set(handle, item);
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
		let callback = this._pageInfoChangedCallbacks.get(handle);
		if (callback) {
			callback({
				eventType: WizardPageInfoEventType.PageChanged,
				pageChangeInfo: info
			});
		}
	}

	public $updateWizardPageInfo(handle: number, pageHandles: number[], currentPageIndex: number): void {
		let callback = this._pageInfoChangedCallbacks.get(handle);
		if (callback) {
			let pages = pageHandles.map(pageHandle => this._objectsByHandle.get(handle) as sqlops.window.modelviewdialog.WizardPage);
			callback({
				eventType: WizardPageInfoEventType.PageAddedOrRemoved,
				pageChangeInfo: {
					lastPage: undefined,
					newPage: currentPageIndex
				},
				pages: pages
			});
		}
	}

	public $validateNavigation(handle: number, info: sqlops.window.modelviewdialog.WizardPageChangeInfo): Thenable<boolean> {
		let wizard = this._objectsByHandle.get(handle) as WizardImpl;
		return wizard.validateNavigation(info);
	}

	public $validateDialogClose(handle: number): Thenable<boolean> {
		let dialog = this._objectsByHandle.get(handle) as DialogImpl;
		return dialog.validateClose();
	}

	public $handleSave(handle: number): Thenable<boolean> {
		let editor = this._objectsByHandle.get(handle) as ModelViewEditorImpl;
		return editor.handleSave();
	}

	public openDialog(dialog: sqlops.window.modelviewdialog.Dialog): void {
		let handle = this.getHandle(dialog);
		this.updateDialogContent(dialog);
		dialog.dialogName ? this._proxy.$openDialog(handle, dialog.dialogName) :
			this._proxy.$openDialog(handle);
	}

	public closeDialog(dialog: sqlops.window.modelviewdialog.Dialog): void {
		let handle = this.getHandle(dialog);
		this._proxy.$closeDialog(handle);
	}

	public createModelViewEditor(title: string, extensionLocation: URI, options?: sqlops.ModelViewEditorOptions): sqlops.workspace.ModelViewEditor {
		let editor = new ModelViewEditorImpl(this, this._extHostModelView, extensionLocation, this._proxy, title, options);
		editor.handle = this.getHandle(editor);
		return editor;
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
			customButtons: dialog.customButtons ? dialog.customButtons.map(button => this.getHandle(button)) : undefined,
			message: dialog.message
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

	public createDialog(title: string, dialogName?: string, extensionLocation?: URI): sqlops.window.modelviewdialog.Dialog {
		let dialog = new DialogImpl(this, this._extHostModelView, this._extHostTaskManagement, extensionLocation);
		if (dialogName) {
			dialog.dialogName = dialogName;
		}
		dialog.title = title;
		dialog.handle = this.getHandle(dialog);
		return dialog;
	}

	public createTab(title: string, extensionLocation?: URI): sqlops.window.modelviewdialog.DialogTab {
		let tab = new TabImpl(this, this._extHostModelView, extensionLocation);
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

	public registerWizardPageInfoChangedCallback(wizard: sqlops.window.modelviewdialog.Wizard, callback: (info: WizardPageEventInfo) => void): void {
		let handle = this.getHandle(wizard);
		this._pageInfoChangedCallbacks.set(handle, callback);
	}

	public createWizardPage(title: string, extensionLocation?: URI): sqlops.window.modelviewdialog.WizardPage {
		let page = new WizardPageImpl(title, this, this._extHostModelView, extensionLocation);
		page.handle = this.getHandle(page);
		return page;
	}

	public createWizard(title: string): sqlops.window.modelviewdialog.Wizard {
		let wizard = new WizardImpl(title, this, this._extHostTaskManagement);
		this.getHandle(wizard);
		return wizard;
	}

	public updateWizardPage(page: sqlops.window.modelviewdialog.WizardPage): Thenable<void> {
		let handle = this.getHandle(page);
		if (page.customButtons) {
			page.customButtons.forEach(button => this.updateButton(button));
		}
		return this._proxy.$setWizardPageDetails(handle, {
			content: page.content,
			customButtons: page.customButtons ? page.customButtons.map(button => this.getHandle(button)) : undefined,
			enabled: page.enabled,
			title: page.title,
			description: page.description
		});
	}

	public updateWizard(wizard: sqlops.window.modelviewdialog.Wizard): Thenable<void> {
		let handle = this.getHandle(wizard);
		wizard.pages.forEach(page => this.updateWizardPage(page));
		this.updateButton(wizard.backButton);
		this.updateButton(wizard.cancelButton);
		this.updateButton(wizard.generateScriptButton);
		this.updateButton(wizard.doneButton);
		this.updateButton(wizard.nextButton);
		if (wizard.customButtons) {
			wizard.customButtons.forEach(button => this.updateButton(button));
		}
		return this._proxy.$setWizardDetails(handle, {
			title: wizard.title,
			pages: wizard.pages.map(page => this.getHandle(page)),
			currentPage: wizard.currentPage,
			backButton: this.getHandle(wizard.backButton),
			cancelButton: this.getHandle(wizard.cancelButton),
			generateScriptButton: this.getHandle(wizard.generateScriptButton),
			doneButton: this.getHandle(wizard.doneButton),
			nextButton: this.getHandle(wizard.nextButton),
			customButtons: wizard.customButtons ? wizard.customButtons.map(button => this.getHandle(button)) : undefined,
			message: wizard.message,
			displayPageTitles: wizard.displayPageTitles
		});
	}

	public addPage(wizard: sqlops.window.modelviewdialog.Wizard, page: sqlops.window.modelviewdialog.WizardPage, pageIndex?: number): Thenable<void> {
		return this._proxy.$addWizardPage(this.getHandle(wizard), this.getHandle(page), pageIndex);
	}

	public removePage(wizard: sqlops.window.modelviewdialog.Wizard, pageIndex: number): Thenable<void> {
		return this._proxy.$removeWizardPage(this.getHandle(wizard), pageIndex);
	}

	public setWizardPage(wizard: sqlops.window.modelviewdialog.Wizard, pageIndex: number): Thenable<void> {
		return this._proxy.$setWizardPage(this.getHandle(wizard), pageIndex);
	}

	public openWizard(wizard: sqlops.window.modelviewdialog.Wizard): Thenable<void> {
		let handle = this.getHandle(wizard);
		this.updateWizard(wizard);
		return this._proxy.$openWizard(handle);
	}

	public closeWizard(wizard: sqlops.window.modelviewdialog.Wizard): Thenable<void> {
		let handle = this.getHandle(wizard);
		return this._proxy.$closeWizard(handle);
	}
}