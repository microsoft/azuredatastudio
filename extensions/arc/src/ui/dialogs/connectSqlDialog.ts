/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { Deferred } from '../../common/promise';
import * as loc from '../../localizedConstants';
import { createCredentialId } from '../../common/utils';
import * as constants from '../../constants';
import { InitializingComponent } from '../components/initializingComponent';
import { ResourceModel } from '../../models/resourceModel';
import { ControllerModel } from '../../models/controllerModel';

export interface IReconnectAction {
	(profile: azdata.IConnectionProfile): Promise<boolean>;
}

export abstract class ConnectToSqlDialog extends InitializingComponent {
	protected modelBuilder!: azdata.ModelBuilder;

	protected serverNameInputBox!: azdata.InputBoxComponent;
	protected usernameInputBox!: azdata.InputBoxComponent;
	protected passwordInputBox!: azdata.InputBoxComponent;
	protected rememberPwCheckBox!: azdata.CheckBoxComponent;
	protected encryptSelectBox!: azdata.DropDownComponent;
	protected trustServerCertificateSelectBox!: azdata.DropDownComponent;

	private options: { [name: string]: any } = {};

	protected _completionPromise = new Deferred<azdata.IConnectionProfile | undefined>();

	constructor(private _controllerModel: ControllerModel, protected _model: ResourceModel) {
		super();
	}

	public showDialog(dialogTitle: string, connectionProfile?: azdata.IConnectionProfile): azdata.window.Dialog {
		const dialog = azdata.window.createModelViewDialog(dialogTitle, undefined, 'narrow');
		const trueCategory: azdata.CategoryValue = { displayName: loc.booleantrue, name: 'true' }
		const falseCategory: azdata.CategoryValue = { displayName: loc.booleanfalse, name: 'false' }
		const booleanCategoryValues: azdata.CategoryValue[] = [trueCategory, falseCategory];

		dialog.cancelButton.onClick(() => this.handleCancel());
		dialog.registerContent(async view => {
			this.modelBuilder = view.modelBuilder;

			this.serverNameInputBox = this.modelBuilder.inputBox()
				.withProps({
					value: connectionProfile?.serverName,
					readOnly: true
				}).component();
			this.usernameInputBox = this.modelBuilder.inputBox()
				.withProps({
					value: connectionProfile?.userName
				}).component();
			this.passwordInputBox = this.modelBuilder.inputBox()
				.withProps({
					inputType: 'password',
					value: connectionProfile?.password
				}).component();
			this.rememberPwCheckBox = this.modelBuilder.checkBox()
				.withProps({
					label: loc.rememberPassword,
					checked: connectionProfile?.savePassword
				}).component();
			this.encryptSelectBox = this.modelBuilder.dropDown()
				.withProps({
					values: booleanCategoryValues,
					value: connectionProfile?.options[constants.encryptOption] ? trueCategory : falseCategory
				}).component();
			this.trustServerCertificateSelectBox = this.modelBuilder.dropDown()
				.withProps({
					values: booleanCategoryValues,
					value: connectionProfile?.options[constants.trustServerCertificateOption] ? trueCategory : falseCategory
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
						}, {
							component: this.encryptSelectBox,
							title: loc.encrypt,
							layout: {
								info: loc.encryptDescription,
							}
						}, {
							component: this.trustServerCertificateSelectBox,
							title: loc.trustServerCertificate,
							layout: {
								info: loc.trustServerCertDescription,
							}
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

		this.options.encrypt = this.encryptSelectBox.value;
		this.options.trustServerCertificate = this.trustServerCertificateSelectBox.value;

		const connectionProfile: azdata.IConnectionProfile = {
			serverName: this.serverNameInputBox.value,
			databaseName: '',
			authenticationType: azdata.connection.AuthenticationType.SqlLogin,
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

		return await this.connect(connectionProfile);
	}

	private async connect(connectionProfile: azdata.IConnectionProfile): Promise<boolean> {
		const result = await azdata.connection.connect(connectionProfile, false, false);
		if (result.connected) {
			connectionProfile.id = result.connectionId!;
			const credentialProvider = await azdata.credentials.getProvider(constants.credentialNamespace);
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
			// Show error with instructions for MSSQL Provider Encryption error code -2146893019 thrown by SqlClient when certificate validation fails.
			if (result.errorCode === -2146893019) {
				return this.showInstructionTextAsWarning(connectionProfile, async updatedConnection => {
					return await this.connect(updatedConnection);
				});
			} else {
				return false;
			}
		}
	}

	private async showInstructionTextAsWarning(profile: azdata.IConnectionProfile, reconnectAction: IReconnectAction): Promise<boolean> {
		while (true) {
			const selection = await vscode.window.showWarningMessage(
				loc.msgPromptSSLCertificateValidationFailed,
				{ modal: false },
				...[
					loc.enableTrustServerCert,
					loc.readMore,
					loc.cancel
				]);
			if (selection === loc.enableTrustServerCert) {
				profile.options.encrypt = true;
				profile.options.trustServerCertificate = true;
				return await reconnectAction(profile);
			} else if (selection === loc.readMore) {
				vscode.env.openExternal(vscode.Uri.parse(constants.encryptReadMoreLink));
				// Show the dialog again so the user can still pick yes or no after they've read the docs
				continue;
			} else {
				return false;
			}
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
