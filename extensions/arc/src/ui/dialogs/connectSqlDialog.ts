/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { Deferred } from '../../common/promise';
import { createCredentialId } from '../../common/utils';
import { credentialNamespace } from '../../constants';
import * as loc from '../../localizedConstants';
import { ControllerModel } from '../../models/controllerModel';
import { MiaaModel } from '../../models/miaaModel';
import { InitializingComponent } from '../components/initializingComponent';

export class ConnectToSqlDialog extends InitializingComponent {
	private modelBuilder!: azdata.ModelBuilder;

	private serverNameInputBox!: azdata.InputBoxComponent;
	private usernameInputBox!: azdata.InputBoxComponent;
	private passwordInputBox!: azdata.InputBoxComponent;
	private rememberPwCheckBox!: azdata.CheckBoxComponent;

	private _completionPromise = new Deferred<azdata.IConnectionProfile | undefined>();

	constructor(private _controllerModel: ControllerModel, private _miaaModel: MiaaModel) {
		super();
	}

	public showDialog(connectionProfile?: azdata.IConnectionProfile): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(loc.connectToSql(this._miaaModel.info.name));
		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;

			this.serverNameInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: connectionProfile?.serverName,
					enabled: false
				}).component();
			this.usernameInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					value: connectionProfile?.userName
				}).component();
			this.passwordInputBox = this.modelBuilder.inputBox()
				.withProperties<azdata.InputBoxProperties>({
					inputType: 'password',
					value: connectionProfile?.password
				})
				.component();
			this.rememberPwCheckBox = this.modelBuilder.checkBox()
				.withProperties<azdata.CheckBoxProperties>({
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
			this.serverNameInputBox.focus();
			this.initialized = true;
		});

		dialog.registerCloseValidator(async () => await this.validate());
		dialog.okButton.label = loc.connect;
		dialog.cancelButton.label = loc.cancel;
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
			providerName: 'MSSQL',
			connectionName: '',
			userName: this.usernameInputBox.value,
			password: this.passwordInputBox.value,
			savePassword: !!this.rememberPwCheckBox.checked,
			groupFullName: undefined,
			saveProfile: true,
			id: '',
			groupId: undefined,
			options: {}
		};
		const result = await azdata.connection.connect(connectionProfile, false, false);
		if (result.connected) {
			connectionProfile.id = result.connectionId;
			const credentialProvider = await azdata.credentials.getProvider(credentialNamespace);
			if (connectionProfile.savePassword) {
				await credentialProvider.saveCredential(createCredentialId(this._controllerModel.info.id, this._miaaModel.info.resourceType, this._miaaModel.info.name), connectionProfile.password);
			} else {
				await credentialProvider.deleteCredential(createCredentialId(this._controllerModel.info.id, this._miaaModel.info.resourceType, this._miaaModel.info.name));
			}
			this._completionPromise.resolve(connectionProfile);
			return true;
		}
		else {
			vscode.window.showErrorMessage(loc.connectToSqlFailed(this.serverNameInputBox.value, result.errorMessage));
			return false;
		}
	}

	private handleCancel(): void {
		this._completionPromise.resolve(undefined);
	}

	public waitForClose(): Promise<azdata.IConnectionProfile | undefined> {
		return this._completionPromise.promise;
	}
}
