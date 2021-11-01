/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMainContext } from 'vs/workbench/api/common/extHost.protocol';
import { Event, Emitter } from 'vs/base/common/event';
import * as nls from 'vs/nls';
import { generateUuid } from 'vs/base/common/uuid';

import * as vscode from 'vscode';
import * as azdata from 'azdata';

import { SqlMainContext, ExtHostModelViewDialogShape, MainThreadModelViewDialogShape, ExtHostModelViewShape, ExtHostBackgroundTaskManagementShape } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { TabOrientation, DialogWidth, DialogStyle, DialogPosition, IDialogProperties } from 'sql/workbench/api/common/sqlExtHostTypes';

const DONE_LABEL = nls.localize('dialogDoneLabel', "Done");
const CANCEL_LABEL = nls.localize('dialogCancelLabel', "Cancel");
const GENERATE_SCRIPT_LABEL = nls.localize('generateScriptLabel', "Generate script");
const NEXT_LABEL = nls.localize('dialogNextLabel', "Next");
const PREVIOUS_LABEL = nls.localize('dialogPreviousLabel', "Previous");

class ModelViewPanelImpl implements azdata.window.ModelViewPanel {
	private _modelView: azdata.ModelView;
	public handle: number;
	protected _modelViewId: string;
	protected _valid: boolean = true;
	protected _onValidityChanged: Event<boolean>;

	constructor(private _viewType: string,
		protected _extHostModelViewDialog: ExtHostModelViewDialog,
		protected _extHostModelView: ExtHostModelViewShape,
		protected _extension: IExtensionDescription) {
		this._onValidityChanged = this._extHostModelViewDialog.getValidityChangedEvent(this);
		this._onValidityChanged(valid => this._valid = valid);
	}

	public registerContent(handler: (view: azdata.ModelView) => Thenable<void>): void {
		if (!this._modelViewId) {
			let viewId = this._viewType + this.handle;
			this.setModelViewId(viewId);
			this._extHostModelView.$registerProvider(viewId, modelView => {
				this._modelView = modelView;
				handler(modelView);
			}, this._extension);
		}
	}

	public setModelViewId(value: string) {
		this._modelViewId = value;
	}

	public get modelView(): azdata.ModelView {
		return this._modelView;
	}

	public set modelView(value: azdata.ModelView) {
		this._modelView = value;
	}

	public get valid(): boolean {
		return this._valid;
	}

	public get onValidityChanged(): Event<boolean> {
		return this._onValidityChanged;
	}
}

class ModelViewEditorImpl extends ModelViewPanelImpl implements azdata.workspace.ModelViewEditor {
	private _isDirty: boolean;
	private _saveHandler: () => Thenable<boolean>;

	constructor(
		extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape,
		extension: IExtensionDescription,
		private _proxy: MainThreadModelViewDialogShape,
		private _title: string,
		private _name: string,
		private _options: azdata.ModelViewEditorOptions
	) {
		super('modelViewEditor', extHostModelViewDialog, extHostModelView, extension);
		this._isDirty = false;
	}

	public openEditor(position?: vscode.ViewColumn): Thenable<void> {
		return this._proxy.$openEditor(this.handle, this._modelViewId, this._title, this._name, this._options, position);
	}

	public closeEditor(): Thenable<void> {
		return this._proxy.$closeEditor(this.handle);
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

class DialogImpl extends ModelViewPanelImpl implements azdata.window.Dialog {
	public title: string;
	public content: string | azdata.window.DialogTab[];
	public okButton: azdata.window.Button;
	public cancelButton: azdata.window.Button;
	public customButtons: azdata.window.Button[];
	private _message: azdata.window.DialogMessage;
	private _closeValidator: () => boolean | Thenable<boolean>;
	private _operationHandler: BackgroundOperationHandler;
	private _dialogName: string;
	private _isWide: boolean;
	private _width: DialogWidth;
	private _dialogStyle: DialogStyle;
	private _dialogPosition: DialogPosition;
	private _renderHeader: boolean;
	private _renderFooter: boolean;
	private _dialogProperties: IDialogProperties;

	private _onClosed = new Emitter<azdata.window.CloseReason>();
	public onClosed = this._onClosed.event;

	constructor(extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape,
		extHostTaskManagement: ExtHostBackgroundTaskManagementShape,
		extension: IExtensionDescription) {
		super('modelViewDialog', extHostModelViewDialog, extHostModelView, extension);
		this.okButton = this._extHostModelViewDialog.createButton(DONE_LABEL);
		this.cancelButton = this._extHostModelViewDialog.createButton(CANCEL_LABEL, 'right', true);
		this._operationHandler = new BackgroundOperationHandler('dialog', extHostTaskManagement);
		this.okButton.onClick(() => {
			this._operationHandler.createOperation();
		});
	}

	public get dialogStyle(): azdata.window.DialogStyle {
		return this._dialogStyle;
	}

	public set dialogStyle(value: azdata.window.DialogStyle) {
		this._dialogStyle = value;
	}

	public get dialogPosition(): azdata.window.DialogPosition {
		return this._dialogPosition;
	}

	public set dialogPosition(value: azdata.window.DialogPosition) {
		this._dialogPosition = value;
	}

	public get renderHeader(): boolean {
		return this._renderHeader;
	}

	public set renderHeader(value: boolean) {
		this._renderHeader = value;
	}

	public get renderFooter(): boolean {
		return this._renderFooter;
	}

	public set renderFooter(value: boolean) {
		this._renderFooter = value;
	}

	public get dialogProperties(): IDialogProperties {
		return this._dialogProperties;
	}

	public set dialogProperties(value: IDialogProperties) {
		this._dialogProperties = value;
	}

	public get width(): azdata.window.DialogWidth {
		return this._width;
	}

	public set width(value: azdata.window.DialogWidth) {
		this._width = value;
	}

	public registerOperation(operationInfo: azdata.BackgroundOperationInfo): void {
		this._operationHandler.registerOperation(operationInfo);
	}

	public override setModelViewId(value: string) {
		super.setModelViewId(value);
		this.content = value;
	}

	public get message(): azdata.window.DialogMessage {
		return this._message;
	}

	public set message(value: azdata.window.DialogMessage) {
		this._message = value;
		this._extHostModelViewDialog.updateDialogContent(this);
	}

	public get dialogName(): string {
		return this._dialogName;
	}

	public set dialogName(value: string) {
		this._dialogName = value;
	}

	public get isWide(): boolean {
		return this._isWide;
	}

	public set isWide(value: boolean) {
		this._isWide = value;
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

	public handleOnClosed(reason: azdata.window.CloseReason): void {
		this._onClosed.fire(reason);
	}
}

class TabImpl extends ModelViewPanelImpl implements azdata.window.DialogTab {
	constructor(
		extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape,
		extension: IExtensionDescription) {
		super('modelViewDialogTab', extHostModelViewDialog, extHostModelView, extension);
	}

	public title: string;
	public content: string;

	public override setModelViewId(value: string) {
		super.setModelViewId(value);
		this.content = value;
	}
}

class ButtonImpl implements azdata.window.Button {
	private _label: string;
	private _enabled: boolean;
	private _hidden: boolean;
	private _focused: boolean;
	private _position: azdata.window.DialogButtonPosition;
	private _secondary: boolean;

	private _onClick = new Emitter<void>();
	public onClick = this._onClick.event;

	constructor(private _extHostModelViewDialog: ExtHostModelViewDialog) {
		this._enabled = true;
		this._hidden = false;
		this._position = 'right';
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

	public get position(): azdata.window.DialogButtonPosition {
		return this._position;
	}

	public set position(value: azdata.window.DialogButtonPosition) {
		this._position = value;
		this._extHostModelViewDialog.updateButton(this);
	}

	public get secondary(): boolean {
		return this._secondary;
	}

	public set secondary(value: boolean) {
		this._secondary = value;
		this._extHostModelViewDialog.updateButton(this);
	}

	public get focused(): boolean {
		return this._focused;
	}

	/**
	 * Focuses the button when set to "true", then the internal value is immediately reset to 'undefined'.
	 *
	 * @remarks
	 * Because communication between ADS and extensions is unidirectional, a focus change by the user is not
	 * communicated to the extension.  The internal value is reset to avoid inconsistent models of where focus is.
	 */
	public set focused(focused: boolean) {
		this._focused = focused;
		this._extHostModelViewDialog.updateButton(this);
		this._focused = undefined;
	}

	public getOnClickCallback(): () => void {
		return () => this._onClick.fire();
	}
}

class BackgroundOperationHandler {

	private _operationInfo: azdata.BackgroundOperationInfo;

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

	public registerOperation(operationInfo: azdata.BackgroundOperationInfo): void {
		this._operationInfo = operationInfo;
	}
}

class WizardPageImpl extends ModelViewPanelImpl implements azdata.window.WizardPage {
	public customButtons: azdata.window.Button[];
	private _enabled: boolean = true;
	private _description: string;

	constructor(public title: string,
		extHostModelViewDialog: ExtHostModelViewDialog,
		extHostModelView: ExtHostModelViewShape,
		extension: IExtensionDescription,
		public pageName?: string) {
		super('modelViewWizardPage', extHostModelViewDialog, extHostModelView, extension);
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
	pageChangeInfo: azdata.window.WizardPageChangeInfo;
	pages?: azdata.window.WizardPage[];
}

class WizardImpl implements azdata.window.Wizard {
	private _currentPage: number = undefined;
	public pages: azdata.window.WizardPage[] = [];
	public doneButton: azdata.window.Button;
	public cancelButton: azdata.window.Button;
	public generateScriptButton: azdata.window.Button;
	public nextButton: azdata.window.Button;
	public backButton: azdata.window.Button;
	public customButtons: azdata.window.Button[];
	private _pageChangedEmitter = new Emitter<azdata.window.WizardPageChangeInfo>();
	public readonly onPageChanged = this._pageChangedEmitter.event;
	private _navigationValidator: (info: azdata.window.WizardPageChangeInfo) => boolean | Thenable<boolean>;
	private _message: azdata.window.DialogMessage;
	private _displayPageTitles: boolean = true;
	private _operationHandler: BackgroundOperationHandler;
	private _width: DialogWidth;

	constructor(public title: string, public name: string, private _extHostModelViewDialog: ExtHostModelViewDialog, extHostTaskManagement: ExtHostBackgroundTaskManagementShape) {
		this.doneButton = this._extHostModelViewDialog.createButton(DONE_LABEL);
		this.cancelButton = this._extHostModelViewDialog.createButton(CANCEL_LABEL, 'right', true);
		this.generateScriptButton = this._extHostModelViewDialog.createButton(GENERATE_SCRIPT_LABEL, 'right', true);
		this.nextButton = this._extHostModelViewDialog.createButton(NEXT_LABEL);
		this.backButton = this._extHostModelViewDialog.createButton(PREVIOUS_LABEL, 'right', true);
		this._extHostModelViewDialog.registerWizardPageInfoChangedCallback(this, info => this.handlePageInfoChanged(info));
		this._currentPage = 0;
		this.onPageChanged(info => this._currentPage = info.newPage);
		this._operationHandler = new BackgroundOperationHandler('wizard' + this.title, extHostTaskManagement);
		this.doneButton.onClick(() => {
			this._operationHandler.createOperation();
		});
	}

	public registerOperation(operationInfo: azdata.BackgroundOperationInfo): void {
		this._operationHandler.registerOperation(operationInfo);
	}

	public get width(): azdata.window.DialogWidth {
		return this._width;
	}

	public set width(value: azdata.window.DialogWidth) {
		this._width = value;
	}

	public get currentPage(): number {
		return this._currentPage;
	}

	public get message(): azdata.window.DialogMessage {
		return this._message;
	}

	public set message(value: azdata.window.DialogMessage) {
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

	public addPage(page: azdata.window.WizardPage, index?: number): Thenable<void> {
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

	public open(source?: string): Thenable<void> {
		return this._extHostModelViewDialog.openWizard(this, source);
	}

	public close(): Thenable<void> {
		return this._extHostModelViewDialog.closeWizard(this);
	}

	public registerNavigationValidator(validator: (pageChangeInfo: azdata.window.WizardPageChangeInfo) => boolean | Thenable<boolean>): void {
		this._navigationValidator = validator;
	}

	public validateNavigation(info: azdata.window.WizardPageChangeInfo): Thenable<boolean> {
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

class ModelViewDashboardImpl implements azdata.window.ModelViewDashboard {
	private _tabbedPanel: azdata.TabbedPanelComponent;
	private _view: azdata.ModelView;

	constructor(
		private _editor: ModelViewEditorImpl,
		private _options?: azdata.ModelViewDashboardOptions
	) {
	}

	updateTabs(tabs: (azdata.DashboardTab | azdata.DashboardTabGroup)[]): void {
		if (this._tabbedPanel === undefined || this._view === undefined) {
			throw new Error(nls.localize('dashboardNotInitialized', "Tabs are not initialized"));
		}

		this._tabbedPanel.updateTabs(this.createTabs(tabs, this._view));
	}

	registerTabs(handler: (view: azdata.ModelView) => Thenable<(azdata.DashboardTab | azdata.DashboardTabGroup)[]>): void {
		this._editor.registerContent(async (view) => {
			this._view = view;
			const dashboardTabs = await handler(view);
			const tabs = this.createTabs(dashboardTabs, view);
			this._tabbedPanel = view.modelBuilder.tabbedPanel().withTabs(tabs).withLayout({
				orientation: TabOrientation.Vertical,
				showIcon: this._options?.showIcon ?? true,
				alwaysShowTabs: this._options?.alwaysShowTabs ?? false
			}).component();
			return view.initializeModel(this._tabbedPanel);
		});
	}

	open(): Thenable<void> {
		return this._editor.openEditor();
	}

	close(): Thenable<void> {
		return this._editor.closeEditor();
	}

	createTab(tab: azdata.DashboardTab, view: azdata.ModelView): azdata.Tab {
		if (tab.toolbar) {
			const flexContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();
			flexContainer.addItem(tab.toolbar, { flex: '0 0 auto' });
			flexContainer.addItem(tab.content, { flex: '1 1 auto' });
			return {
				title: tab.title,
				id: tab.id,
				content: flexContainer,
				icon: tab.icon
			};
		} else {
			return tab;
		}
	}

	createTabs(dashboardTabs: (azdata.DashboardTab | azdata.DashboardTabGroup)[], view: azdata.ModelView): (azdata.TabGroup | azdata.Tab)[] {
		const tabs: (azdata.TabGroup | azdata.Tab)[] = [];
		dashboardTabs.forEach((item: azdata.DashboardTab | azdata.DashboardTabGroup) => {
			if ('tabs' in item) {
				tabs.push(<azdata.TabGroup>{
					title: item.title,
					tabs: item.tabs.map(tab => {
						return this.createTab(tab, view);
					})
				});
			} else {
				tabs.push(this.createTab(item, view));
			}
		});
		return tabs;
	}

	selectTab(id: string): void {
		this._tabbedPanel.selectTab(id);
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

	public getHandle(item: azdata.window.Button | azdata.window.Dialog | azdata.window.DialogTab
		| azdata.window.ModelViewPanel | azdata.window.Wizard | azdata.window.WizardPage | azdata.workspace.ModelViewEditor, createIfNotFound: boolean = true) {
		let handle = this._objectHandles.get(item);
		if (createIfNotFound && handle === undefined) {
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

	public $onWizardPageChanged(handle: number, info: azdata.window.WizardPageChangeInfo): void {
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
			let pages = pageHandles.map(pageHandle => this._objectsByHandle.get(pageHandle) as azdata.window.WizardPage);
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

	public $validateNavigation(handle: number, info: azdata.window.WizardPageChangeInfo): Thenable<boolean> {
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

	public $onClosed(handle: number, reason: azdata.window.CloseReason): void {
		let dialog = this._objectsByHandle.get(handle) as DialogImpl;
		dialog.handleOnClosed(reason);
	}

	public openDialog(dialog: azdata.window.Dialog): void {
		let handle = this.getHandle(dialog);
		this.updateDialogContent(dialog);
		dialog.dialogName ? this._proxy.$openDialog(handle, dialog.dialogName) :
			this._proxy.$openDialog(handle);
	}

	public closeDialog(dialog: azdata.window.Dialog): void {
		let handle = this.getHandle(dialog);
		this._proxy.$closeDialog(handle);
	}

	public createModelViewEditor(title: string, extension: IExtensionDescription, name?: string, options?: azdata.ModelViewEditorOptions): azdata.workspace.ModelViewEditor {
		name = name ?? 'ModelViewEditor';
		let editor = new ModelViewEditorImpl(this, this._extHostModelView, extension, this._proxy, title, name, options);
		editor.handle = this.getHandle(editor);
		return editor;
	}

	public createModelViewDashboard(title: string, name: string | undefined, options: azdata.ModelViewDashboardOptions | undefined, extension: IExtensionDescription): azdata.window.ModelViewDashboard {
		name = name ?? 'ModelViewDashboard';
		const editor = this.createModelViewEditor(title, extension, name, { supportsSave: false }) as ModelViewEditorImpl;
		return new ModelViewDashboardImpl(editor, options);
	}

	public updateDialogContent(dialog: azdata.window.Dialog): void {
		let dialogWidth: DialogWidth = 'narrow';
		let dialogStyle: DialogStyle;
		let dialogPosition: DialogPosition;
		let renderHeader: boolean;
		let renderFooter: boolean;
		let dialogProperties: IDialogProperties;
		let handle = this.getHandle(dialog);
		let tabs = dialog.content;

		if (dialog.dialogStyle) {
			dialogStyle = dialog.dialogStyle;
		}
		if (dialog.dialogPosition) {
			dialogPosition = dialog.dialogPosition;
		}
		if (dialog.renderHeader) {
			renderHeader = dialog.renderHeader;
		}
		if (dialog.renderFooter) {
			renderFooter = dialog.renderFooter;
		}
		if (dialog.dialogProperties) {
			dialogProperties = dialog.dialogProperties;
		}
		if (tabs && typeof tabs !== 'string') {
			tabs.forEach(tab => this.updateTabContent(tab));
		}

		if (dialog.customButtons) {
			dialog.customButtons.forEach(button => {
				this.updateButton(button, true);
			});
		}

		/**
		 * Only peform actions on footer if it is shown.
		 */
		if (dialog.renderFooter !== false) {
			this.updateButton(dialog.okButton);
			this.updateButton(dialog.cancelButton);
		}

		if (dialog.isWide !== undefined) {
			dialogWidth = dialog.isWide ? 'wide' : 'narrow';
		} else if (dialog.width !== undefined) {
			dialogWidth = dialog.width;
		} else {
			dialogWidth = 'narrow';
		}
		this._proxy.$setDialogDetails(handle, {
			title: dialog.title,
			width: dialogWidth,
			dialogStyle: dialogStyle,
			dialogPosition: dialogPosition,
			renderHeader: renderHeader,
			renderFooter: renderFooter,
			dialogProperties: dialogProperties,
			okButton: this.getHandle(dialog.okButton),
			cancelButton: this.getHandle(dialog.cancelButton),
			content: dialog.content && typeof dialog.content !== 'string' ? dialog.content.map(tab => this.getHandle(tab)) : dialog.content as string,
			customButtons: dialog.customButtons ? dialog.customButtons.map(button => this.getHandle(button)) : undefined,
			message: dialog.message
		});
	}

	public updateTabContent(tab: azdata.window.DialogTab): void {
		let handle = this.getHandle(tab);
		this._proxy.$setTabDetails(handle, {
			title: tab.title,
			content: tab.content
		});
	}

	public updateButton(button: azdata.window.Button, isCustomButton: boolean = false): void {
		// Custom buttons are always secondary buttons.
		if (isCustomButton) {
			button.secondary = true;
		}
		let handle = this.getHandle(button);
		this._proxy.$setButtonDetails(handle, {
			label: button.label,
			enabled: button.enabled,
			hidden: button.hidden,
			focused: button.focused,
			position: button.position,
			secondary: button.secondary
		});
	}

	public registerOnClickCallback(button: azdata.window.Button, callback: () => void) {
		let handle = this.getHandle(button);
		this._onClickCallbacks.set(handle, callback);
	}

	public createDialog(title: string, dialogName?: string, extension?: IExtensionDescription, width?: DialogWidth, dialogStyle?: DialogStyle, dialogPosition?: DialogPosition, renderHeader?: boolean, renderFooter?: boolean, dialogProperties?: IDialogProperties): azdata.window.Dialog {

		let dialog = new DialogImpl(this, this._extHostModelView, this._extHostTaskManagement, extension);

		if (dialogName) {
			dialog.dialogName = dialogName;
		}
		if (dialogStyle) {
			dialog.dialogStyle = dialogStyle;
		}
		if (dialogPosition) {
			dialog.dialogPosition = dialogPosition;
		}
		if (dialogProperties) {
			dialog.dialogProperties = dialogProperties;
		}
		dialog.renderHeader = renderHeader;
		dialog.renderFooter = renderFooter;
		if (title) {
			dialog.title = title;
		}
		dialog.width = width ?? 'narrow';
		dialog.handle = this.getHandle(dialog);
		return dialog;
	}

	public createTab(title: string, extension?: IExtensionDescription): azdata.window.DialogTab {
		let tab = new TabImpl(this, this._extHostModelView, extension);
		tab.title = title;
		tab.handle = this.getHandle(tab);
		return tab;
	}

	public createButton(label: string, position: azdata.window.DialogButtonPosition = 'right', secondary: boolean = false): azdata.window.Button {
		let button = new ButtonImpl(this);
		this.getHandle(button);
		this.registerOnClickCallback(button, button.getOnClickCallback());
		button.label = label;
		button.position = position;
		button.secondary = secondary;
		return button;
	}

	public getValidityChangedEvent(panel: azdata.window.ModelViewPanel) {
		let handle = this.getHandle(panel);
		let emitter = this._validityEmitters.get(handle);
		if (!emitter) {
			emitter = new Emitter<boolean>();
			this._validityEmitters.set(handle, emitter);
		}
		return emitter.event;
	}

	public registerWizardPageInfoChangedCallback(wizard: azdata.window.Wizard, callback: (info: WizardPageEventInfo) => void): void {
		let handle = this.getHandle(wizard);
		this._pageInfoChangedCallbacks.set(handle, callback);
	}

	public createWizardPage(title: string, extension?: IExtensionDescription, pageName?: string): azdata.window.WizardPage {
		let page = new WizardPageImpl(title, this, this._extHostModelView, extension, pageName);
		page.handle = this.getHandle(page);
		return page;
	}

	public createWizard(title: string, name: string = 'ModelViewWizard', width: azdata.window.DialogWidth = 'wide'): azdata.window.Wizard {
		let wizard = new WizardImpl(title, name, this, this._extHostTaskManagement);
		wizard.width = width;
		this.getHandle(wizard);
		return wizard;
	}

	public updateWizardPage(page: azdata.window.WizardPage): Thenable<void> {
		let handle = this.getHandle(page);
		if (page.customButtons) {
			page.customButtons.forEach(button => {
				this.updateButton(button, true);
			});
		}
		return this._proxy.$setWizardPageDetails(handle, {
			content: page.content,
			customButtons: page.customButtons ? page.customButtons.map(button => this.getHandle(button)) : undefined,
			enabled: page.enabled,
			title: page.title,
			description: page.description,
			pageName: page.pageName
		});
	}

	public updateWizard(wizard: azdata.window.Wizard): Thenable<void> {
		let handle = this.getHandle(wizard);
		wizard.pages.forEach(page => this.updateWizardPage(page));
		this.updateButton(wizard.backButton);
		this.updateButton(wizard.cancelButton);
		this.updateButton(wizard.generateScriptButton);
		this.updateButton(wizard.doneButton);
		this.updateButton(wizard.nextButton);
		if (wizard.customButtons) {
			wizard.customButtons.forEach(button => {
				this.updateButton(button, true);
			});
		}
		return this._proxy.$setWizardDetails(handle, {
			title: wizard.title,
			name: wizard.name,
			width: wizard.width,
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

	public addPage(wizard: azdata.window.Wizard, page: azdata.window.WizardPage, pageIndex?: number): Thenable<void> {
		return this._proxy.$addWizardPage(this.getHandle(wizard), this.getHandle(page), pageIndex);
	}

	public removePage(wizard: azdata.window.Wizard, pageIndex: number): Thenable<void> {
		return this._proxy.$removeWizardPage(this.getHandle(wizard), pageIndex);
	}

	public setWizardPage(wizard: azdata.window.Wizard, pageIndex: number): Thenable<void> {
		return this._proxy.$setWizardPage(this.getHandle(wizard), pageIndex);
	}

	public openWizard(wizard: azdata.window.Wizard, source?: string): Thenable<void> {
		let handle = this.getHandle(wizard);
		this.updateWizard(wizard);
		return this._proxy.$openWizard(handle, source);
	}

	public closeWizard(wizard: azdata.window.Wizard): Thenable<void> {
		let handle = this.getHandle(wizard);
		return this._proxy.$closeWizard(handle);
	}
}
