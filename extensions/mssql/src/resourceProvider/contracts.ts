/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RequestType } from 'vscode-languageclient';
import * as azdata from 'azdata';

// ------------------------------- < Resource Events > ------------------------------------

/**
 * A request to open up a firewall rule
 */
export namespace CreateFirewallRuleRequest {
	export const type = new RequestType<CreateFirewallRuleParams, CreateFirewallRuleResponse, void, void>('resource/createFirewallRule');
}

/**
 * Firewall rule request handler
 */
export namespace HandleFirewallRuleRequest {
	export const type = new RequestType<HandleFirewallRuleParams, HandleFirewallRuleResponse, void, void>('resource/handleFirewallRule');
}

/**
 * Firewall rule creation parameters
 */
export interface CreateFirewallRuleParams {
	/**
	 * Account information to use in connecting to Azure
	 */
	account: azdata.Account;
	/**
	 * Fully qualified name of the server to create a new firewall rule on
	 */
	serverName: string;
	/**
	 * Firewall rule name to set
	 */
	firewallRuleName: string;
	/**
	 * Start of the IP address range
	 */
	startIpAddress: string;
	/**
	 * End of the IP address range
	 */
	endIpAddress: string;
	/**
	 * Per-tenant token mappings. Ideally would be set independently of this call,
	 * but for now this allows us to get the tokens necessary to find a server and open a firewall rule
	 */
	securityTokenMappings: {};
}

/**
 * Firewall rule creation response
 */
interface CreateFirewallRuleResponse {
	/**
	 * Whether or not request can be handled.
	 */
	result: boolean;
	/**
	 * Contains error message, if request could not be handled.
	 */
	errorMessage: string;
}

/**
 * Firewall rule handling parameters
 */
export interface HandleFirewallRuleParams {
	/**
	 * The error code used to defined the error type
	 */
	errorCode: number;
	/**
	 * The error message from which to parse the IP address
	 */
	errorMessage: string;
	/**
	 * The connection type, for example MSSQL
	 */
	connectionTypeId: string;
}

/**
 * Response to the check for Firewall rule support given an error message
 */
interface HandleFirewallRuleResponse {
	/**
	 * Whether or not request can be handled.
	 */
	result: boolean;
	/**
	 * Contains error message, if request could not be handled.
	 */
	errorMessage: string;
	/**
	 * If handled, the default IP address to send back; so users can tell what their blocked IP is.
	 */
	ipAddress: string;
}
