/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities, StaticFeature, RPCMessageType, ServerCapabilities } from 'vscode-languageclient';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { Disposable } from 'vscode';
import * as sqlops from 'sqlops';

import { Telemetry } from './telemetry';
import * as Utils from './utils';
import { TelemetryNotification, AgentJobsRequest, AgentJobActionRequest, AgentJobHistoryRequest, AgentJobsParams, AgentJobHistoryParams, AgentJobActionParams } from './contracts';

export class TelemetryFeature implements StaticFeature {

	constructor(private _client: SqlOpsDataClient) { }

	fillClientCapabilities(capabilities: ClientCapabilities): void {
		Utils.ensure(capabilities, 'telemetry')!.telemetry = true;
	}

	initialize(): void {
		this._client.onNotification(TelemetryNotification.type, e => {
			Telemetry.sendTelemetryEvent(e.params.eventName, e.params.properties, e.params.measures);
		});
	}
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
