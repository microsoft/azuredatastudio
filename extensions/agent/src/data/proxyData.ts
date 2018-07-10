/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData, AgentDialogMode } from '../interfaces';

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

	constructor(ownerUri:string, proxyInfo: sqlops.AgentProxyInfo) {
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
		let result = await agentService.createProxy(this.ownerUri,  this.toAgentProxyInfo());
		if (!result || !result.success) {
			// TODO handle error here
		}
	}

	public toAgentProxyInfo(): sqlops.AgentProxyInfo {
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
