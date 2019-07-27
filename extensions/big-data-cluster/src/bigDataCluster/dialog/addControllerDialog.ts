/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as nls from 'vscode-nls';
import { IEndPoint, IControllerError, getEndPoints } from '../controller/clusterControllerApi';
import { ControllerTreeDataProvider } from '../tree/controllerTreeDataProvider';
import { TreeNode } from '../tree/treeNode';
import { showErrorMessage } from '../utils';

const localize = nls.loadMessageBundle();

export class AddControllerDialogModel {
	constructor(
		public treeDataProvider: ControllerTreeDataProvider,
		public node?: TreeNode,
		public prefilledClusterName?: string,
		public prefilledUrl?: string,
		public prefilledUsername?: string,
		public prefilledPassword?: string,
		public prefilledRememberPassword?: boolean
	) {
		this.prefilledClusterName = prefilledClusterName || (node && node['clusterName']);
		this.prefilledUrl = prefilledUrl || (node && node['url']);
		this.prefilledUsername = prefilledUsername || (node && node['username']);
		this.prefilledPassword = prefilledPassword || (node && node['password']);
		this.prefilledRememberPassword = prefilledRememberPassword || (node && node['rememberPassword']);
	}

	public async onComplete(clusterName: string, url: string, username: string, password: string, rememberPassword: boolean): Promise<void> {
		let response = await getEndPoints(clusterName, url, username, password, true);
		if (response && response.endPoints) {
			let masterInstance: IEndPoint = undefined;
			if (response.endPoints) {
				masterInstance = response.endPoints.find(e => e.name && e.name === 'sql-server-master');
			}
			this.treeDataProvider.addController(clusterName, url, username, password, rememberPassword, masterInstance);
			await this.treeDataProvider.saveControllers();
		}
	}

	public async onError(error: IControllerError): Promise<void> {
		// implement
	}

	public async onCancel(): Promise<void> {
		if (this.node) {
			this.node.refresh();
		}
	}
}

export class AddControllerDialog {

	private dialog: azdata.window.Dialog;
	private uiModelBuilder: azdata.ModelBuilder;

	private clusterNameInputBox: azdata.InputBoxComponent;
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

			this.clusterNameInputBox = this.uiModelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					placeHolder: localize('textClusterNameLower', 'mssql-cluster'),
					value: this.model.prefilledUrl || 'mssql-cluster'
				}).component();
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
							component: this.clusterNameInputBox,
							title: localize('textClusterNameCapital', 'Cluster Name'),
							required: true
						}, {
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
		let clusterName = this.clusterNameInputBox && this.clusterNameInputBox.value;
		let url = this.urlInputBox && this.urlInputBox.value;
		let username = this.usernameInputBox && this.usernameInputBox.value;
		let password = this.passwordInputBox && this.passwordInputBox.value;
		let rememberPassword = this.passwordInputBox && !!this.rememberPwCheckBox.checked;

		try {
			await this.model.onComplete(clusterName, url, username, password, rememberPassword);
			return true;
		} catch (error) {
			showErrorMessage(error);
			if (this.model && this.model.onError) {
				await this.model.onError(error as IControllerError);
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
