/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { RequestType } from 'vscode-languageclient';
import * as sqlops from 'sqlops';

// ------------------------------- < Resource Events > ------------------------------------
export namespace CreateFirewallRuleRequest {
	export const type = new RequestType<CreateFirewallRuleParams, CreateFirewallRuleResponse, void, void>('resource/createFirewallRule');
}

export namespace HandleFirewallRuleRequest {
	export const type = new RequestType<HandleFirewallRuleParams, HandleFirewallRuleResponse, void, void>('resource/handleFirewallRule');
}

// Firewall rule interfaces
export interface CreateFirewallRuleParams {
	account: sqlops.Account;
	serverName: string;
	startIpAddress: string;
	endIpAddress: string;
	securityTokenMappings: {};
}

export interface CreateFirewallRuleResponse {
	result: boolean;
	errorMessage: string;
}

export interface HandleFirewallRuleParams {
	errorCode: number;
	errorMessage: string;
	connectionTypeId: string;
}

export interface HandleFirewallRuleResponse {
	result: boolean;
	ipAddress: string;
}
