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

// Job Management types
export interface AgentJobsParams {
	ownerUri: string;
	jobId: string;
}

export interface AgentJobsResult {
	succeeded: boolean;
	errorMessage: string;
	jobs: sqlops.AgentJobInfo[];
}

export interface AgentJobHistoryParams {
	ownerUri: string;
	jobId: string;
}

export interface AgentJobHistoryResult {
	succeeded: boolean;
	errorMessage: string;
	jobs: sqlops.AgentJobHistoryInfo[];
}

export interface AgentJobActionParams {
	ownerUri: string;
	jobName: string;
	action: string;
}

export interface AgentJobActionResult {
	succeeded: boolean;
	errorMessage: string;
}

export namespace AgentJobsRequest {
	export const type = new RequestType<AgentJobsParams, AgentJobsResult, void, void>('agent/jobs');
}

export namespace AgentJobHistoryRequest {
	export const type = new RequestType<AgentJobHistoryParams, AgentJobHistoryResult, void, void>('agent/jobhistory');
}


export namespace AgentJobActionRequest {
	export const type = new RequestType<AgentJobActionParams, AgentJobActionResult, void, void>('agent/jobaction');
}

export class AgentServicesFeature extends SqlOpsFeature<undefined> {
	private static readonly messagesTypes: RPCMessageType[] = [
		AgentJobsRequest.type,
		AgentJobHistoryRequest.type,
		AgentJobActionRequest.type
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

		let getJobs = (ownerUri: string): Thenable<sqlops.AgentJobsResult> => {
			let params: AgentJobsParams = { ownerUri: ownerUri, jobId: null };
			return client.sendRequest(AgentJobsRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(AgentJobsRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let getJobHistory = (connectionUri: string, jobID: string): Thenable<sqlops.AgentJobHistoryResult> => {
			let params: AgentJobHistoryParams = { ownerUri: connectionUri, jobId: jobID };

			return client.sendRequest(AgentJobHistoryRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(AgentJobHistoryRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		let jobAction = (connectionUri: string, jobName: string, action: string): Thenable<sqlops.AgentJobActionResult> => {
			let params: AgentJobActionParams = { ownerUri: connectionUri, jobName: jobName, action: action };
			return client.sendRequest(AgentJobActionRequest.type, params).then(
				r => r,
				e => {
					client.logFailedRequest(AgentJobActionRequest.type, e);
					return Promise.resolve(undefined);
				}
			);
		};

		return sqlops.dataprotocol.registerAgentServicesProvider({
			providerId: client.providerId,
			getJobs,
			getJobHistory,
			jobAction
		});
	}
}
