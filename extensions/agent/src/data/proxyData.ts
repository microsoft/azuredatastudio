/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';
const localize = nls.loadMessageBundle();

export class ProxyData implements IAgentDialogData {
	public dialogMode: AgentDialogMode = AgentDialogMode.CREATE;
	ownerUri: string;
	id: number;
	accountName: string;
	description: string;
	credentialName: string;
	credentialIdentity: string;
	credentialId: number;
	isEnabled: boolean;

	constructor(ownerUri: string, proxyInfo: azdata.AgentProxyInfo) {
		this.ownerUri = ownerUri;

		if (proxyInfo) {
			this.accountName = proxyInfo.accountName;
			this.credentialName = proxyInfo.credentialName;
			this.description = proxyInfo.description;
		}
	}

	public async initialize() {
	}

	public async save() {
		let agentService = await AgentUtils.getAgentService();
		let proxyInfo = this.toAgentProxyInfo();
		let result = await agentService.createProxy(this.ownerUri, proxyInfo);
		if (!result || !result.success) {
			vscode.window.showErrorMessage(
				localize('proxyData.saveErrorMessage', "Proxy update failed '{0}'", result.errorMessage ? result.errorMessage : 'Unknown'));
		} else {
			if (this.dialogMode === AgentDialogMode.EDIT) {
				vscode.window.showInformationMessage(
					localize('proxyData.saveSucessMessage', "Proxy '{0}' updated successfully", proxyInfo.accountName));
			} else {
				vscode.window.showInformationMessage(
					localize('proxyData.newJobSuccessMessage', "Proxy '{0}' created successfully", proxyInfo.accountName));
			}

		}
	}

	public toAgentProxyInfo(): azdata.AgentProxyInfo {
		return {
			id: this.id,
			accountName: this.accountName,
			description: this.description,
			credentialName: this.credentialName,
			credentialIdentity: this.credentialIdentity,
			credentialId: this.credentialId,
			isEnabled: this.isEnabled
		};
	}
}
