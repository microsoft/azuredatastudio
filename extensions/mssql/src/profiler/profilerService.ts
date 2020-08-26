/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AppContext } from '../appContext';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import * as constants from '../constants';
import * as mssql from '../mssql';
import { ClientCapabilities } from 'vscode-languageclient';
import * as azdata from 'azdata';
import * as contracts from '../contracts';

export class ProfilerService implements mssql.IProfilerService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends ProfilerService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.ProfilerService, this);
	}

	createSession(ownerUri: string, sessionName: string, template: azdata.ProfilerSessionTemplate): Thenable<boolean> {
		let params: contracts.CreateXEventSessionParams = {
			ownerUri,
			sessionName,
			template
		};

		return this.client.sendRequest(contracts.CreateXEventSessionRequest.type, params).then(
			r => true,
			e => {
				this.client.logFailedRequest(contracts.CreateXEventSessionRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	startSession(ownerUri: string, sessionName: string): Thenable<boolean> {
		let params: contracts.StartProfilingParams = {
			ownerUri,
			sessionName
		};

		return this.client.sendRequest(contracts.StartProfilingRequest.type, params).then(
			r => true,
			e => {
				this.client.logFailedRequest(contracts.StartProfilingRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	stopSession(ownerUri: string): Thenable<boolean> {
		let params: contracts.StopProfilingParams = {
			ownerUri
		};

		return this.client.sendRequest(contracts.StopProfilingRequest.type, params).then(
			r => true,
			e => {
				this.client.logFailedRequest(contracts.StopProfilingRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	pauseSession(ownerUri: string): Thenable<boolean> {
		let params: contracts.PauseProfilingParams = {
			ownerUri
		};

		return this.client.sendRequest(contracts.PauseProfilingRequest.type, params).then(
			r => true,
			e => {
				this.client.logFailedRequest(contracts.PauseProfilingRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	getXEventSessions(ownerUri: string): Thenable<string[]> {
		let params: contracts.GetXEventSessionsParams = {
			ownerUri
		};

		return this.client.sendRequest(contracts.GetXEventSessionsRequest.type, params).then(
			r => r.sessions,
			e => {
				this.client.logFailedRequest(contracts.GetXEventSessionsRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	connectSession(sessionId: string): Thenable<boolean> {
		return undefined;
	}

	disconnectSession(ownerUri: string): Thenable<boolean> {
		let params: contracts.DisconnectSessionParams = {
			ownerUri: ownerUri
		};
		return this.client.sendRequest(contracts.DisconnectSessionRequest.type, params).then(
			r => true,
			e => {
				this.client.logFailedRequest(contracts.DisconnectSessionRequest.type, e);
				return Promise.reject(e);
			}
		);
	}

	registerOnSessionEventsAvailable(handler: (response: azdata.ProfilerSessionEvents) => any): void {
		this.client.onNotification(contracts.ProfilerEventsAvailableNotification.type, (params: contracts.ProfilerEventsAvailableParams) => {
			handler(<azdata.ProfilerSessionEvents>{
				sessionId: params.ownerUri,
				events: params.events,
				eventsLost: params.eventsLost
			});
		});
	}


	registerOnSessionStopped(handler: (response: azdata.ProfilerSessionStoppedParams) => any): void {
		this.client.onNotification(contracts.ProfilerSessionStoppedNotification.type, (params: contracts.ProfilerSessionStoppedParams) => {
			handler(<azdata.ProfilerSessionStoppedParams>{
				ownerUri: params.ownerUri,
				sessionId: params.sessionId
			});
		});
	}

	registerOnProfilerSessionCreated(handler: (response: azdata.ProfilerSessionCreatedParams) => any): void {
		this.client.onNotification(contracts.ProfilerSessionCreatedNotification.type, (params: contracts.ProfilerSessionCreatedParams) => {
			handler(<azdata.ProfilerSessionCreatedParams>{
				ownerUri: params.ownerUri,
				sessionName: params.sessionName,
				templateName: params.templateName
			});
		});
	}
}
