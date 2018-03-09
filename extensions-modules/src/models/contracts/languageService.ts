/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NotificationType, ServerOptions, RequestType, RPCMessageType, ClientCapabilities, ServerCapabilities } from 'vscode-languageclient';
import { ITelemetryEventProperties, ITelemetryEventMeasures } from '../telemetry';
import { Runtime } from '../platform';
import { SqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import * as sqlops from 'sqlops';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { Disposable } from 'vscode';

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
	public params: {
		eventName: string;
		properties: ITelemetryEventProperties;
		measures: ITelemetryEventMeasures;
	};
}

// ------------------------------- </ Telemetry Sent Event > ----------------------------------

// ------------------------------- < Status Event > ------------------------------------

/**
 * Event sent when the language service send a status change event
 */
export namespace StatusChangedNotification {
	export const type = new NotificationType<StatusChangeParams, void>('textDocument/statusChanged');
}

/**
 * Update event parameters
 */
export class StatusChangeParams {
	/**
	 * URI identifying the text document
	 */
	public ownerUri: string;

	/**
	 * The new status of the document
	 */
	public status: string;
}

// ------------------------------- </ Status Sent Event > ----------------------------------

export interface ILanguageClientHelper {
	createServerOptions(servicePath: string, runtimeId?: Runtime): ServerOptions;
}

export interface AgentJobsParams {
	ownerUri: string;
}

export interface AgentJobsResponse {
	jobInfo: sqlops.AgentJobInfo[];
}

export namespace AgentJobsRequest {
	export const type = new RequestType<AgentJobsParams, AgentJobsResponse, void, void>('agent/jobs');
}

export class AgentServicesFeature extends SqlOpsFeature<undefined> {
	private static readonly messagesTypes: RPCMessageType[] = [
		AgentJobsRequest.type
	];

	constructor(client: SqlOpsDataClient) {
		super(client, AgentServicesFeature.messagesTypes);
	}

	public fillClientCapabilities(capabilities: ClientCapabilities): void {
		// this isn't explicitly necessary
		// ensure(ensure(capabilities, 'connection')!, 'agentServices')!.dynamicRegistration = true;
	}

	public initialize(capabilities: ServerCapabilities): void {
		this.register(this.messages, {
			id: UUID.generateUuid(),
			registerOptions: undefined
		});
	}

	protected registerProvider(options: undefined): Disposable {
		const client = this._client;

		let getJobs = (ownerUri: string): Thenable<sqlops.AgentJobInfo[]> => {
			let params: AgentJobsParams = { ownerUri };
			return client.sendRequest(AgentJobsRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(AgentJobsRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		return sqlops.dataprotocol.registerAgentServicesProvider({
			providerId: client.providerId,
			getJobs
		});
	}
}
