/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as sqlops from 'sqlops';
import { AgentUtils } from '../agentUtils';

export class CreateOperatorData {
	public ownerUri: string;
	private _alert: sqlops.AgentOperatorInfo;

	constructor(ownerUri:string) {
		this.ownerUri = ownerUri;
	}

	public async initialize() {
		let agentService = await AgentUtils.getAgentService();

	}

	public async save() {
	}
}
