/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import { createCredentialId } from '../../common/utils';
import { credentialNamespace } from '../../constants';
import { InitializingComponent } from '../components/initializingComponent';
import { ResourceModel } from '../../models/resourceModel';
import { ControllerModel } from '../../models/controllerModel';

export abstract class ConnectToSqlDialog extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;

	protected serverNameInputBox!: azdata.InputBoxComponent;
	protected usernameInputBox!: azdata.InputBoxComponent;
	protected passwordInputBox!: azdata.InputBoxComponent;
	protected rememberPwCheckBox!: azdata.CheckBoxComponent;
	private options: { [name: string]: any } = {};

	protected _completionPromise = new Deferred<azdata.IConnectionProfile | undefined>();

	constructor(private _controllerModel: ControllerModel, protected _model: ResourceModel) {
		super();
	}

	public showDialog(dialogTitle: string, connectionProfile?: azdata.IConnectionProfile): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(dialogTitle);
		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;

			this.serverNameInputBox = this.modelBuilder.inputBox()
				.withProps({
					value: connectionProfile?.serverName,
					enabled: false
				}).component();
			this.usernameInputBox = this.modelBuilder.inputBox()
				.withProps({
					value: connectionProfile?.userName
				}).component();
			this.passwordInputBox = this.modelBuilder.inputBox()
				.withProps({
					inputType: 'password',
					value: connectionProfile?.password
				})
				.component();
			this.rememberPwCheckBox = this.modelBuilder.checkBox()
				.withProps({
					label: loc.rememberPassword,
					checked: connectionProfile?.savePassword
				}).component();

			let formModel = this.modelBuilder.formContainer()
				.withFormItems([{
					components: [
						{
							component: this.serverNameInputBox,
							title: loc.serverEndpoint,
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
			this.usernameInputBox.focus();
			this.initialized = true;
		});

		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.label = loc.connect;
		dialog.cancelButton.label = loc.cancel;
		this.options = connectionProfile?.options!;
		azdata.window.openDialog(dialog);
		return dialog;
	}

	public async validate(): Promise<boolean> {
		if (!this.serverNameInputBox.value || !this.usernameInputBox.value || !this.passwordInputBox.value) {
			return false;
		}
		const connectionProfile: azdata.IConnectionProfile = {
			serverName: this.serverNameInputBox.value,
			databaseName: '',
			authenticationType: 'SqlLogin',
			providerName: this.providerName,
			connectionName: '',
			userName: this.usernameInputBox.value,
			password: this.passwordInputBox.value,
			savePassword: !!this.rememberPwCheckBox.checked,
			groupFullName: undefined,
			saveProfile: true,
			id: '',
			groupId: undefined,
			options: this.options
		};
		const result = await azdata.connection.connect(connectionProfile, false, false);
		if (result.connected) {
			connectionProfile.id = result.connectionId;
			const credentialProvider = await azdata.credentials.getProvider(credentialNamespace);
			if (connectionProfile.savePassword) {
				await credentialProvider.saveCredential(createCredentialId(this._controllerModel.info.id, this._model.info.resourceType, this._model.info.name), connectionProfile.password);
			} else {
				await credentialProvider.deleteCredential(createCredentialId(this._controllerModel.info.id, this._model.info.resourceType, this._model.info.name));
			}
			this._completionPromise.resolve(connectionProfile);
			return true;
		}
		else {
			vscode.window.showErrorMessage(this.connectionFailedMessage(result.errorMessage));
			return false;
		}
	}

	protected abstract get providerName(): string;

	protected abstract connectionFailedMessage(error: any): string;

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<azdata.IConnectionProfile | undefined> {
		return this._completionPromise.promise;
	}
}
