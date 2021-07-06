/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { NotificationType, RequestType } from 'vscode-languageclient';
import { ITelemetryEventProperties, ITelemetryEventMeasures } from '../telemetry';
import * as azdata from 'azdata';

// ------------------------------- < Telemetry Sent Event > ------------------------------------

/**
 * Event sent when the language service send a telemetry event
 */
export namespace TelemetryNotification {
	export const type = new NotificationType<TelemetryParams, void>('telemetry/sqlevent');
}

/**
 * Update event parameters
 */
export class TelemetryParams {
	public params!: {
		eventName: string;
		properties: ITelemetryEventProperties;
		measures: ITelemetryEventMeasures;
	};
}

// ------------------------------- </ Telemetry Sent Event > ----------------------------------

// ------------------------------- < Security Token Request > ------------------------------------------
export interface RequestSecurityTokenParams {
	authority: string;
	provider: string;
	resource: string;
	accountId: string;
}

export interface RequestSecurityTokenResponse {
	accountKey: string;
	token: string;
}

export namespace SecurityTokenRequest {
	export const type = new RequestType<RequestSecurityTokenParams, RequestSecurityTokenResponse, void, void>('account/securityTokenRequest');
}
// ------------------------------- </ Security Token Request > ------------------------------------------

// ------------------------------- <Serialization> -----------------------------
export namespace SerializeDataStartRequest {
	export const type = new RequestType<azdata.SerializeDataStartRequestParams, azdata.SerializeDataResult, void, void>('serialize/start');
}

export namespace SerializeDataContinueRequest {
	export const type = new RequestType<azdata.SerializeDataContinueRequestParams, azdata.SerializeDataResult, void, void>('serialize/continue');
}
// ------------------------------- <Serialization> -----------------------------

// ------------------------------- < Load Completion Extension Request > ------------------------------------
/**
 * Completion extension load parameters
 */
export class CompletionExtensionParams {
	/// <summary>
	/// Absolute path for the assembly containing the completion extension
	/// </summary>
	public assemblyPath?: string;
	/// <summary>
	/// The type name for the completion extension
	/// </summary>
	public typeName?: string;
	/// <summary>
	/// Property bag for initializing the completion extension
	/// </summary>
	public properties?: {};
}

export namespace CompletionExtLoadRequest {
	export const type = new RequestType<CompletionExtensionParams, boolean, void, void>('completion/extLoad');
}
