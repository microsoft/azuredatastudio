/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { createCredentialId } from '../../common/utils';
import { credentialNamespace } from '../../constants';
import * as loc from '../../localizedConstants';
import { ControllerModel } from '../../models/controllerModel';
import { MiaaModel } from '../../models/miaaModel';
import { ConnectToSqlDialog } from './connectSqlDialog';

export class ConnectToMiaaSqlDialog extends ConnectToSqlDialog {

	constructor(private _controllerModel: ControllerModel, private _miaaModel: MiaaModel) {
		super();
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
			vscode.window.showErrorMessage(loc.connectToMSSqlFailed(this.serverNameInputBox.value, result.errorMessage));
			return false;
		}
	}
}
