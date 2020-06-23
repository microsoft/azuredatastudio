/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as loc from '../../localizedConstants';
import { AzureArcTreeDataProvider } from '../tree/azureArcTreeDataProvider';
import { ControllerModel, ControllerInfo } from '../../models/controllerModel';
import { Deferred } from '../../common/promise';

export type ConnectToControllerDialogModel = { controllerModel: ControllerModel, password: string };

export class ConnectToControllerDialog {
	private modelBuilder!: azdata.ModelBuilder;

	private urlInputBox!: azdata.InputBoxComponent;
	private usernameInputBox!: azdata.InputBoxComponent;
	private passwordInputBox!: azdata.InputBoxComponent;
	private rememberPwCheckBox!: azdata.CheckBoxComponent;

	private _completionPromise = new Deferred<ConnectToControllerDialogModel | undefined>();

	constructor(private _treeDataProvider: AzureArcTreeDataProvider) { }

	public showDialog(controllerInfo?: ControllerInfo): void {
		const dialog = azdata.window.createModelViewDialog(loc.connectToController);
		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;

			this.urlInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: controllerInfo?.url,
					// If we have a model then we're editing an existing connection so don't let them modify the URL
					readOnly: !!controllerInfo
				}).component();
			this.usernameInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: controllerInfo?.username
				}).component();
			this.passwordInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					inputType: 'password',
				})
				.component();
			this.rememberPwCheckBox = this.modelBuilder.checkBox()
				.withProperties<azdata.CheckBoxProperties>({
					label: loc.rememberPassword,
					checked: controllerInfo?.rememberPassword
				}).component();

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: this.urlInputBox,
							title: loc.controllerUrl,
							required: true
						}, {
							component: this.usernameInputBox,
							title: loc.username,
							required: true
						}, {
							component: this.passwordInputBox,
							title: loc.password,
							required: true
						}, {
							component: this.rememberPwCheckBox,
							title: ''
						}
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();
			await view.initializeModel(formModel);
			this.urlInputBox.focus();
		});

		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.label = loc.connect;
		dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(dialog);
	}

	private async validate(): Promise<boolean> {
		if (!this.urlInputBox.value || !this.usernameInputBox.value || !this.passwordInputBox.value) {
			return false;
		}
		const controllerInfo: ControllerInfo = { url: this.urlInputBox.value, username: this.usernameInputBox.value, rememberPassword: this.rememberPwCheckBox.checked ?? false };
		const controllerModel = new ControllerModel(this._treeDataProvider, controllerInfo, this.passwordInputBox.value);
		try {
			// Validate that we can connect to the controller
			await controllerModel.refresh();
		} catch (err) {
			vscode.window.showErrorMessage(loc.connectToControllerFailed(this.urlInputBox.value, err));
			return false;
		}
		this._completionPromise.resolve({ controllerModel: controllerModel, password: this.passwordInputBox.value });
		return true;
	}

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<ConnectToControllerDialogModel | undefined> {
		return this._completionPromise.promise;
	}
}
