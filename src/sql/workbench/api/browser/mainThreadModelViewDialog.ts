/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

import { MainThreadModelViewDialogShape, SqlMainContext, ExtHostModelViewDialogShape, SqlExtHostContext } from 'sql/workbench/api/common/sqlExtHost.protocol';
import { Dialog, DialogTab, DialogButton, WizardPage, Wizard } from 'sql/workbench/services/dialog/common/dialogTypes';
import { CustomDialogService, DefaultWizardOptions, DefaultDialogOptions } from 'sql/workbench/services/dialog/browser/customDialogService';
import { IModelViewDialogDetails, IModelViewTabDetails, IModelViewButtonDetails, IModelViewWizardPageDetails, IModelViewWizardDetails } from 'sql/workbench/api/common/sqlExtHostTypes';
import { ModelViewInput, ModelViewInputModel, ModeViewSaveHandler } from 'sql/workbench/browser/modelComponents/modelViewInput';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import { TelemetryView, TelemetryAction } from 'sql/platform/telemetry/common/telemetryKeys';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IEditorInput, IEditorPane } from 'vs/workbench/common/editor';
import { Disposable } from 'vs/base/common/lifecycle';

@extHostNamedCustomer(SqlMainContext.MainThreadModelViewDialog)
export class MainThreadModelViewDialog extends Disposable implements MainThreadModelViewDialogShape {
	private readonly _proxy: ExtHostModelViewDialogShape;
	private readonly _dialogs = new Map<number, Dialog>();
	private readonly _tabs = new Map<number, DialogTab>();
	private readonly _buttons = new Map<number, DialogButton>();
	private readonly _wizardPages = new Map<number, WizardPage>();
	private readonly _wizardPageHandles = new Map<WizardPage, number>();
	private readonly _wizards = new Map<number, Wizard>();
	private readonly _editorInputModels = new Map<number, ModelViewInputModel>();
	private readonly _editors = new Map<number, { pane: IEditorPane, input: IEditorInput }>();
	private _dialogService: CustomDialogService;

	constructor(
		context: IExtHostContext,
		@IInstantiationService private _instatiationService: IInstantiationService,
		@IEditorService private _editorService: IEditorService,
		@IAdsTelemetryService private _telemetryService: IAdsTelemetryService
	) {
		super();
		this._proxy = context.getProxy(SqlExtHostContext.ExtHostModelViewDialog);
		this._dialogService = new CustomDialogService(_instatiationService);
	}

	public $openEditor(handle: number, modelViewId: string, title: string, name?: string, options?: azdata.ModelViewEditorOptions, position?: vscode.ViewColumn): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			let saveHandler: ModeViewSaveHandler = options && options.supportsSave ? (h) => this.handleSave(h) : undefined;
			let model = new ModelViewInputModel(modelViewId, handle, saveHandler);
			let input = this._instatiationService.createInstance(ModelViewInput, title, model, options);
			let editorOptions = {
				preserveFocus: true,
				pinned: true
			};
			this._telemetryService.createActionEvent(TelemetryView.Shell, TelemetryAction.ModelViewDashboardOpened)
				.withAdditionalProperties({ name: name })
				.send();
			this._editorService.openEditor(input, editorOptions, position as any).then((editorPane) => {
				this._editorInputModels.set(handle, model);
				this._editors.set(handle, { pane: editorPane, input: editorPane.input });
				const disposable = this._editorService.onDidCloseEditor(e => {
					if (e.editor === input) {
						this._editors.delete(handle);
						disposable.dispose();
					}
				});
				resolve();
			}, error => {
				reject(error);
			});
		});
	}

	public $closeEditor(handle: number): Thenable<void> {
		return new Promise<void>((resolve, reject) => {
			const editor = this._editors.get(handle);
			if (editor) {
				editor.pane.group.closeEditor(editor.input).then(() => {
					resolve();
				}).catch(e => reject(e));
			}
			reject(new Error(`Could not find editor with handle ${handle}`));
		});
	}

	private handleSave(handle: number): Thenable<boolean> {
		return this._proxy.$handleSave(handle);
	}

	public $openDialog(handle: number, dialogName?: string): Thenable<void> {
		let dialog = this.getDialog(handle);
		const options = Object.assign({}, DefaultDialogOptions);
		options.width = dialog.width;
		options.dialogStyle = dialog.dialogStyle;
		options.dialogPosition = dialog.dialogPosition;
		options.renderHeader = dialog.renderHeader;
		options.renderFooter = dialog.renderFooter;
		options.dialogProperties = dialog.dialogProperties;
		const modal = this._dialogService.showDialog(dialog, dialogName, options);
		const onClosed = modal.onClosed(reason => {
			this._proxy.$onClosed(handle, reason);
			onClosed.dispose();
		});
		return Promise.resolve();
	}

	public $closeDialog(handle: number): Thenable<void> {
		let dialog = this.getDialog(handle);
		this._dialogService.closeDialog(dialog);
		return Promise.resolve();
	}

	public $setDialogDetails(handle: number, details: IModelViewDialogDetails): Thenable<void> {
		let dialog = this._dialogs.get(handle);
		if (!dialog) {
			dialog = new Dialog(details.title, details.width, details.dialogStyle, details.dialogPosition, details.renderHeader, details.renderFooter, details.dialogProperties);

			/**
			 * Only peform actions on footer if it is shown.
			 */
			if (details.renderFooter !== false) {
				dialog.okButton = this.getButton(details.okButton);
				dialog.cancelButton = this.getButton(details.cancelButton);
			}

			dialog.onValidityChanged(valid => this._proxy.$onPanelValidityChanged(handle, valid));
			dialog.registerCloseValidator(() => this.validateDialogClose(handle));
			this._dialogs.set(handle, dialog);
		} else {
			dialog.title = details.title;
			dialog.width = details.width;
		}

		if (details.content && typeof details.content !== 'string') {
			dialog.content = details.content.map(tabHandle => this.getTab(tabHandle));
		} else {
			dialog.content = details.content as string;
		}

		if (details.customButtons) {
			dialog.customButtons = details.customButtons.map(buttonHandle => this.getButton(buttonHandle));
		}
		dialog.message = details.message;

		return Promise.resolve();
	}

	public $setTabDetails(handle: number, details: IModelViewTabDetails): Thenable<void> {
		let tab = this._tabs.get(handle);
		if (!tab) {
			tab = new DialogTab(details.title);
			tab.onValidityChanged(valid => this._proxy.$onPanelValidityChanged(handle, valid));
			this._tabs.set(handle, tab);
		}

		tab.title = details.title;
		tab.content = details.content;
		return Promise.resolve();
	}

	public $setButtonDetails(handle: number, details: IModelViewButtonDetails): Thenable<void> {
		let button = this._buttons.get(handle);
		if (!button) {
			button = new DialogButton(details.label, details.enabled);
			button.onClick(() => this.onButtonClick(handle));
			this._buttons.set(handle, button);
		}
		button.setProperties(details);

		return Promise.resolve();
	}

	public $setWizardPageDetails(handle: number, details: IModelViewWizardPageDetails): Thenable<void> {
		let page = this._wizardPages.get(handle);
		if (!page) {
			page = new WizardPage(details.title, details.content, details.pageName);
			page.onValidityChanged(valid => this._proxy.$onPanelValidityChanged(handle, valid));
			this._wizardPages.set(handle, page);
			this._wizardPageHandles.set(page, handle);
		}

		page.title = details.title;
		page.content = details.content;
		page.enabled = details.enabled;
		page.description = details.description;
		page.pageName = details.pageName;
		if (details.customButtons !== undefined) {
			page.customButtons = details.customButtons.map(buttonHandle => this.getButton(buttonHandle));
		}

		return Promise.resolve();
	}

	public $setWizardDetails(handle: number, details: IModelViewWizardDetails): Thenable<void> {
		let wizard = this._wizards.get(handle);
		if (!wizard) {
			wizard = new Wizard(
				details.title,
				details.name || 'WizardPage',
				this.getButton(details.doneButton),
				this.getButton(details.cancelButton),
				this.getButton(details.nextButton),
				this.getButton(details.backButton),
				this.getButton(details.generateScriptButton));
			wizard.width = details.width;
			wizard.onPageChanged(info => this._proxy.$onWizardPageChanged(handle, info));
			wizard.onPageAdded(() => this.handleWizardPageAddedOrRemoved(handle));
			wizard.onPageRemoved(() => this.handleWizardPageAddedOrRemoved(handle));
			wizard.registerNavigationValidator(info => this.validateNavigation(handle, info));
			this._wizards.set(handle, wizard);
		}

		wizard.title = details.title;
		wizard.displayPageTitles = details.displayPageTitles;
		wizard.pages = details.pages.map(handle => this.getWizardPage(handle));
		if (details.currentPage !== undefined) {
			wizard.setCurrentPage(details.currentPage);
		}
		if (details.customButtons !== undefined) {
			wizard.customButtons = details.customButtons.map(buttonHandle => this.getButton(buttonHandle));
		}
		wizard.message = details.message;

		return Promise.resolve();
	}

	public $addWizardPage(wizardHandle: number, pageHandle: number, pageIndex?: number): Thenable<void> {
		if (pageIndex === null) {
			pageIndex = undefined;
		}
		let wizard = this.getWizard(wizardHandle);
		let page = this.getWizardPage(pageHandle);
		wizard.addPage(page, pageIndex);
		return Promise.resolve();
	}

	public $removeWizardPage(wizardHandle: number, pageIndex: number): Thenable<void> {
		let wizard = this.getWizard(wizardHandle);
		wizard.removePage(pageIndex);
		return Promise.resolve();
	}

	public $setWizardPage(wizardHandle: number, pageIndex: number): Thenable<void> {
		let wizard = this.getWizard(wizardHandle);
		const modal = this._dialogService.getWizardModal(wizard);
		return modal.showPage(pageIndex);
	}

	public $openWizard(handle: number, source?: string): Thenable<void> {
		let wizard = this.getWizard(handle);
		const options = Object.assign({}, DefaultWizardOptions);
		options.width = wizard.width;
		this._dialogService.showWizard(wizard, options, source);
		return Promise.resolve();
	}

	public $closeWizard(handle: number): Thenable<void> {
		let wizard = this.getWizard(handle);
		this._dialogService.closeWizard(wizard);
		return Promise.resolve();
	}

	$setDirty(handle: number, isDirty: boolean): void {
		let model = this.getEditor(handle);
		if (model) {
			model.setDirty(isDirty);
		}
	}

	private getEditor(handle: number): ModelViewInputModel {
		let model = this._editorInputModels.get(handle);
		if (!model) {
			throw new Error('No editor matching the given handle');
		}
		return model;
	}

	private getDialog(handle: number): Dialog {
		let dialog = this._dialogs.get(handle);
		if (!dialog) {
			throw new Error('No dialog matching the given handle');
		}
		return dialog;
	}

	private getTab(handle: number): DialogTab {
		let tab = this._tabs.get(handle);
		if (!tab) {
			throw new Error('No tab matching the given handle');
		}
		return tab;
	}

	private getButton(handle: number): DialogButton {
		let button = this._buttons.get(handle);
		if (!button) {
			throw new Error('No button matching the given handle');
		}
		return button;
	}

	private onButtonClick(handle: number): void {
		this._proxy.$onButtonClick(handle);
	}

	private getWizardPage(handle: number): WizardPage {
		let page = this._wizardPages.get(handle);
		if (!page) {
			throw new Error('No page matching the given handle');
		}
		return page;
	}

	private getWizard(handle: number): Wizard {
		let wizard = this._wizards.get(handle);
		if (!wizard) {
			throw new Error('No wizard matching the given handle');
		}
		return wizard;
	}

	private handleWizardPageAddedOrRemoved(handle: number): void {
		let wizard = this._wizards.get(handle);
		this._proxy.$updateWizardPageInfo(handle, wizard.pages.map(page => this._wizardPageHandles.get(page)), wizard.currentPage);
	}

	private validateNavigation(handle: number, info: azdata.window.WizardPageChangeInfo): Thenable<boolean> {
		return this._proxy.$validateNavigation(handle, info);
	}

	private validateDialogClose(handle: number): Thenable<boolean> {
		return this._proxy.$validateDialogClose(handle);
	}
}
