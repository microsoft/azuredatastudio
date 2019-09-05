/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { getEndPoints, ControllerError } from '../controller/clusterControllerApi';
import { ControllerTreeDataProvider } from '../tree/controllerTreeDataProvider';
import { TreeNode } from '../tree/treeNode';
import { showErrorMessage } from '../utils';

const localize = nls.loadMessageBundle();

export class AddControllerDialogModel {

	private _canceled = false;

	constructor(
		public treeDataProvider: ControllerTreeDataProvider,
		public node?: TreeNode,
		public prefilledUrl?: string,
		public prefilledUsername?: string,
		public prefilledPassword?: string,
		public prefilledRememberPassword?: boolean
	) {
		this.prefilledUrl = prefilledUrl || (node && node['url']);
		this.prefilledUsername = prefilledUsername || (node && node['username']);
		this.prefilledPassword = prefilledPassword || (node && node['password']);
		this.prefilledRememberPassword = prefilledRememberPassword || (node && node['rememberPassword']);
	}

	public async onComplete(url: string, username: string, password: string, rememberPassword: boolean): Promise<void> {
		try {
			// We pre-fetch the endpoints here to verify that the information entered is correct (the user is able to connect)
			let response = await getEndPoints(url, username, password, true);
			if (response && response.endPoints) {
				if (this._canceled) {
					return;
				}
				this.treeDataProvider.addController(url, username, password, rememberPassword);
				await this.treeDataProvider.saveControllers();
			}
		} catch (error) {
			// Ignore the error if we cancelled the request since we can't stop the actual request from completing
			if (!this._canceled) {
				throw error;
			}
		}

	}

	public async onError(error: ControllerError): Promise<void> {
		// implement
	}

	public async onCancel(): Promise<void> {
		this._canceled = true;
		if (this.node) {
			this.node.refresh();
		}
	}
}

export class AddControllerDialog {

	private dialog: azdata.window.Dialog;
	private uiModelBuilder: azdata.ModelBuilder;

	private urlInputBox: azdata.InputBoxComponent;
	private usernameInputBox: azdata.InputBoxComponent;
	private passwordInputBox: azdata.InputBoxComponent;
	private rememberPwCheckBox: azdata.CheckBoxComponent;

	constructor(private model: AddControllerDialogModel) {
	}

	public showDialog(): void {
		this.createDialog();
		azdata.window.openDialog(this.dialog);
	}

	private createDialog(): void {
		this.dialog = azdata.window.createModelViewDialog(localize('textAddNewController', 'Add New Controller'));
		this.dialog.registerContent(async view => {
			this.uiModelBuilder = view.modelBuilder;

			this.urlInputBox = this.uiModelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: localize('textUrlLower', 'url'),
					value: this.model.prefilledUrl
				}).component();
			this.usernameInputBox = this.uiModelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: localize('textUsernameLower', 'username'),
					value: this.model.prefilledUsername
				}).component();
			this.passwordInputBox = this.uiModelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: localize('textPasswordLower', 'password'),
					inputType: 'password',
					value: this.model.prefilledPassword
				})
				.component();
			this.rememberPwCheckBox = this.uiModelBuilder.checkBox()
				.withProperties<azdata.CheckBoxProperties>({
					label: localize('textRememberPassword', 'Remember Password'),
					checked: this.model.prefilledRememberPassword
				}).component();

			let formModel = this.uiModelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: this.urlInputBox,
							title: localize('textUrlCapital', 'URL'),
							required: true
						}, {
							component: this.usernameInputBox,
							title: localize('textUsernameCapital', 'Username'),
							required: true
						}, {
							component: this.passwordInputBox,
							title: localize('textPasswordCapital', 'Password'),
							required: true
						}, {
							component: this.rememberPwCheckBox,
							title: ''
						}
					],
					title: ''
				}]).withLayout({ width: '100%' }).component();

			await view.initializeModel(formModel);
		});

		this.dialog.registerCloseValidator(async () => await this.validate());
		this.dialog.cancelButton.onClick(async () => await this.cancel());
		this.dialog.okButton.label = localize('textAdd', 'Add');
		this.dialog.cancelButton.label = localize('textCancel', 'Cancel');
	}

	private async validate(): Promise<boolean> {
		let url = this.urlInputBox && this.urlInputBox.value;
		let username = this.usernameInputBox && this.usernameInputBox.value;
		let password = this.passwordInputBox && this.passwordInputBox.value;
		let rememberPassword = this.passwordInputBox && !!this.rememberPwCheckBox.checked;

		try {
			await this.model.onComplete(url, username, password, rememberPassword);
			return true;
		} catch (error) {
			showErrorMessage(error);
			if (this.model && this.model.onError) {
				await this.model.onError(error as ControllerError);
			}
			return false;
		}
	}

	private async cancel(): Promise<void> {
		if (this.model && this.model.onCancel) {
			await this.model.onCancel();
		}
	}
}
