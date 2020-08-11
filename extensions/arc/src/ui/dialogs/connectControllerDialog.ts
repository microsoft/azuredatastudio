/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import { ControllerInfo, ControllerModel } from '../../models/controllerModel';
import { InitializingComponent } from '../components/initializingComponent';
import { AzureArcTreeDataProvider } from '../tree/azureArcTreeDataProvider';

export type ConnectToControllerDialogModel = { controllerModel: ControllerModel, password: string };
export class ConnectToControllerDialog extends InitializingComponent {
	private modelBuilder!: azdata.ModelBuilder;

	private urlInputBox!: azdata.InputBoxComponent;
	private nameInputBox!: azdata.InputBoxComponent;
	private usernameInputBox!: azdata.InputBoxComponent;
	private passwordInputBox!: azdata.InputBoxComponent;
	private rememberPwCheckBox!: azdata.CheckBoxComponent;

	private _completionPromise = new Deferred<ConnectToControllerDialogModel | undefined>();

	constructor(private _treeDataProvider: AzureArcTreeDataProvider) {
		super();
	}

	public showDialog(controllerInfo?: ControllerInfo, password?: string): azdata.window.Dialog {
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
			this.nameInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: controllerInfo?.name
				}).component();
			this.usernameInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: controllerInfo?.username
				}).component();
			this.passwordInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					inputType: 'password',
					value: password
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
							component: this.nameInputBox,
							title: loc.controllerName,
							required: false
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
			this.initialized = true;
		});

		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.label = loc.connect;
		dialog.cancelButton.label = loc.cancel;
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async validate(): Promise<boolean> {
		if (!this.urlInputBox.value || !this.usernameInputBox.value || !this.passwordInputBox.value) {
			return false;
		}
		let url = this.urlInputBox.value;
		// Only support https connections
		if (url.toLowerCase().startsWith('http://')) {
			url = url.replace('http', 'https');
		}
		// Append https if they didn't type it in
		if (!url.toLowerCase().startsWith('https://')) {
			url = `https://${url}`;
		}
		// Append default port if one wasn't specified
		if (!/.*:\d*$/.test(url)) {
			url = `${url}:30080`;
		}
		const controllerInfo: ControllerInfo = {
			url: url,
			name: this.nameInputBox.value ?? '',
			username: this.usernameInputBox.value,
			rememberPassword: this.rememberPwCheckBox.checked ?? false,
			resources: []
		};
		const controllerModel = new ControllerModel(this._treeDataProvider, controllerInfo, this.passwordInputBox.value);
		try {
			// Validate that we can connect to the controller, this also populates the controllerRegistration from the connection response.
			await controllerModel.refresh(false);
			// default info.name to the name of the controller instance if the user did not specify their own and to a pre-canned default if for some weird reason controller endpoint returned instanceName is also not a valid value
			controllerModel.info.name = controllerModel.info.name || controllerModel.controllerRegistration?.instanceName || loc.defaultControllerName;
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
