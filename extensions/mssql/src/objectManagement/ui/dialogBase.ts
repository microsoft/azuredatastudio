/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { IObjectManagementService } from 'mssql';
import * as vscode from 'vscode';
import { generateUuid } from 'vscode-languageclient/lib/utils/uuid';
import * as nls from 'vscode-nls';
import { getErrorMessage } from '../../utils';
const localize = nls.loadMessageBundle();

export const DefaultLabelWidth = '120px';
export const DefaultInputWidth = '300px';

export abstract class DialogBase {
	protected readonly disposables: vscode.Disposable[] = [];
	protected readonly dialogObject: azdata.window.Dialog;
	protected readonly contextId: string;

	constructor(protected readonly objectManagementService: IObjectManagementService,
		protected readonly connectionUri: string,
		protected isNewObject: boolean,
		protected readonly objectName: string | undefined,
		dialogTitle: string,
		dialogName: string,
		dialogWidth: azdata.window.DialogWidth = 'narrow') {
		this.dialogObject = azdata.window.createModelViewDialog(dialogTitle, dialogName, dialogWidth);
		this.dialogObject.okButton.label = localize('objectManagementDialog.OkText', "OK");
		this.disposables.push(this.dialogObject.okButton.onClick(() => this.onOkButtonClicked()));
		this.disposables.push(this.dialogObject.onClosed(async () => { await this.dispose(); }));
		this.contextId = generateUuid();
		this.dialogObject.registerCloseValidator(async (): Promise<boolean> => {
			const confirmed = await this.onConfirmation();
			if (!confirmed) {
				return false;
			}
			return await this.runValidation();
		});
	}

	protected abstract initialize(): Promise<void>;
	protected abstract onComplete(): Promise<void>;
	protected abstract onDispose(): Promise<void>;
	protected abstract validate(): Promise<string[]>;

	protected async onConfirmation(): Promise<boolean> {
		return true;
	}

	protected async runValidation(showError: boolean = true): Promise<boolean> {
		const errors = await this.validate();
		if ((this.dialogObject.message !== undefined || showError) && errors.length > 0) {
			this.dialogObject.message = {
				level: azdata.window.MessageLevel.Error,
				text: localize('objectManagementDialog.ValidationError', "There are some validation errors"),
				description: errors.join('\n')
			};
		} else {
			this.dialogObject.message = undefined;
		}
		return errors.length === 0;
	}

	public async open(): Promise<void> {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: localize('objectManagementDialog.loadingDialog', "Loading dialog...")
		}, async () => {
			await this.initialize();
		});
		azdata.window.openDialog(this.dialogObject);
	}

	private async onOkButtonClicked(): Promise<void> {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: localize('objectManagementDialog.savingChanges', "Saving changes...")
		}, async () => {
			try {
				await this.onComplete();
			}
			catch (err) {
				await vscode.window.showErrorMessage(localize('objectManagementDialog.SaveError', "Error occurred while saving changes: {0}", getErrorMessage(err)));
			}
		});
	}

	private async dispose(): Promise<void> {
		await this.onDispose();
		this.disposables.forEach(disposable => disposable.dispose());
	}

	protected createLabelInputContainer(view: azdata.ModelView, label: string, input: azdata.InputBoxComponent | azdata.DropDownComponent): azdata.FlexContainer {
		const labelComponent = view.modelBuilder.text().withProps({ width: DefaultLabelWidth, value: label, requiredIndicator: input.required }).component();
		const row = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'horizontal', flexWrap: 'nowrap', alignItems: 'center' }).withItems([labelComponent, input]).component();
		return row;
	}

	protected createCheckbox(view: azdata.ModelView, label: string, checked: boolean = false, enabled: boolean = true): azdata.CheckBoxComponent {
		return view.modelBuilder.checkBox().withProps({
			label: label,
			checked: checked,
			enabled: enabled,
			CSSStyles: {
				'margin-block-start': '0.5em'
			}
		}).component();
	}

	protected createPasswordInputBox(view: azdata.ModelView, ariaLabel: string, value: string = '', enabled: boolean = true, width: string = DefaultInputWidth): azdata.InputBoxComponent {
		return this.createInputBox(view, ariaLabel, value, enabled, 'password', width);
	}

	protected createInputBox(view: azdata.ModelView, ariaLabel: string, value: string = '', enabled: boolean = true, type: azdata.InputBoxInputType = 'text', width: string = DefaultInputWidth): azdata.InputBoxComponent {
		return view.modelBuilder.inputBox().withProps({ inputType: type, enabled: enabled, ariaLabel: ariaLabel, value: value, width: width }).component();
	}

	protected createGroup(view: azdata.ModelView, header: string, items: azdata.Component[], collapsible: boolean = true): azdata.GroupContainer {
		return view.modelBuilder.groupContainer().withLayout({
			header: header,
			collapsed: false,
			collapsible: collapsible
		}).withItems(items).component();
	}

	protected createFormContainer(view: azdata.ModelView, items: azdata.Component[]): azdata.DivContainer {
		return view.modelBuilder.divContainer().withLayout({ width: 'calc(100% - 20px)', height: 'calc(100% - 20px)' }).withProps({
			CSSStyles: { 'padding': '10px' }
		}).withItems(items).component();
	}
}
