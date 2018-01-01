/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { RequestType } from 'vscode-languageclient';
import * as sqlops from 'sqlops';

// DEV-NOTE: Still finalizing what we'll need as part of this interface
/**
 * Contains necessary information for serializing and saving results
 * @param {string} saveFormat the format / type that the results will be saved in
 * @param {string} savePath path the results will be saved to
 * @param {string} results either a subset or all of the results we wish to save to savePath
 * @param {boolean} appendToFile Whether we should append or overwrite the file in savePath
*/
export class SaveResultsInfo {
	constructor(public saveFormat: string, public savePath: string, public results: string,
		public appendToFile: boolean) {
	}
}

export namespace SaveAsRequest {
	export const type = new RequestType<SaveResultsInfo, sqlops.SaveResultRequestResult, void, void>('query/saveAs');
}

// --------------------------------- < Read Credential Request > -------------------------------------------------

// Read Credential request message callback declaration
export namespace ReadCredentialRequest {
	export const type = new RequestType<Credential, Credential, void, void>('credential/read');
}

/**
 * Parameters to initialize a connection to a database
 */
export class Credential {
	/**
	 * Unique ID identifying the credential
	 */
	public credentialId: string;

	/**
	 * password
	 */
	public password: string;
}

// --------------------------------- </ Read Credential Request > -------------------------------------------------

// --------------------------------- < Save Credential Request > -------------------------------------------------

// Save Credential request message callback declaration
export namespace SaveCredentialRequest {
	export const type = new RequestType<Credential, boolean, void, void>('credential/save');
}
// --------------------------------- </ Save Credential Request > -------------------------------------------------


// --------------------------------- < Delete Credential Request > -------------------------------------------------

// Delete Credential request message callback declaration
export namespace DeleteCredentialRequest {
	export const type = new RequestType<Credential, boolean, void, void>('credential/delete');
}
// --------------------------------- </ Delete Credential Request > -------------------------------------------------

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
