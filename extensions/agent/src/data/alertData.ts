/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';
import { IAgentDialogData } from '../interfaces';

export class AlertData implements IAgentDialogData {
	public ownerUri: string;

	public alert: sqlops.AgentAlertInfo;

	constructor(ownerUri:string) {
		this.ownerUri = ownerUri;
	}

	public async initialize() {
		let agentService = await AgentUtils.getAgentService();

	}

	public async save() {
	}
}
