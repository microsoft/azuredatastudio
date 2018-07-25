/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SqlOpsDataClient, SqlOpsFeature } from 'dataprotocol-client';
import { ClientCapabilities, StaticFeature, RPCMessageType, ServerCapabilities, RequestType } from 'vscode-languageclient';
import * as UUID from 'vscode-languageclient/lib/utils/uuid';
import { Disposable } from 'vscode';
import * as sqlops from 'sqlops';

import { Telemetry } from './telemetry';
import * as serviceUtils from './serviceUtils';
import * as Contracts from './contracts';
import { IServiceApi, managerInstance, ApiType } from './serviceApiManager';
import { ConnectionDetails } from 'dataprotocol-client/lib/types';

export class TelemetryFeature implements StaticFeature {

    constructor(private _client: SqlOpsDataClient) { }

    fillClientCapabilities(capabilities: ClientCapabilities): void {
        serviceUtils.ensure(capabilities, 'telemetry')!.telemetry = true;
    }

    initialize(): void {
        this._client.onNotification(Contracts.TelemetryNotification.type, e => {
            Telemetry.sendTelemetryEvent(e.params.eventName, e.params.properties, e.params.measures);
        });
    }
}

export class FlatFileImportFeature extends SqlOpsFeature<undefined> {
    private static readonly messagesTypes: RPCMessageType[] = [
        Contracts.PROSEDiscoveryRequest.type
    ];

    constructor(client: SqlOpsDataClient) {
        super(client, FlatFileImportFeature.messagesTypes);
    }

    public fillClientCapabilities(capabilities: ClientCapabilities): void {
        // ensure(ensure(capabilities, 'connection')!, 'objectExplorer')!.dynamicRegistration = true;
    }

    public initialize(capabilities: ServerCapabilities): void {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }

    protected registerProvider(options: undefined): Disposable {
        console.log('Flat file import registering provider');
        const client = this._client;

        // let sendHelloWorldRequest = (params: Contracts.HelloWorldParam): Thenable<Contracts.HelloWorldResponse> => {
        //     return client.sendRequest(Contracts.HelloWorldRequest.type, params).then(
        //         r => r,
        //         e => {
        //             client.logFailedRequest(Contracts.HelloWorldRequest.type, e);
        //             return Promise.reject(e);
        //         }
        //     );
        // };

        let requestSender = (requestType, params) => {
            return client.sendRequest(requestType, params).then(
                r => r as any,
                e => {
                    client.logFailedRequest(requestType, e);
                    return Promise.reject(e);
                }
            );
        };

        let sendPROSEDiscoveryRequest = (params: Contracts.PROSEDiscoveryParams): Thenable<Contracts.PROSEDiscoveryResponse> => {
            return requestSender(Contracts.PROSEDiscoveryRequest.type, params);
        };

        let sendInsertDataRequest = (params: Contracts.InsertDataParams): Thenable<Contracts.InsertDataResponse> => {
            return requestSender(Contracts.InsertDataRequest.type, params);
        };

        let sendGetColumnInfoRequest = (params: Contracts.GetColumnInfoParams): Thenable<Contracts.GetColumnInfoResponse> => {
            return requestSender(Contracts.GetColumnInfoRequest.type, params);
        };

        let sendChangeColumnSettingsRequest = (params: Contracts.ChangeColumnSettingsParams): Thenable<Contracts.ChangeColumnSettingsResponse> => {
            return requestSender(Contracts.ChangeColumnSettingsRequest.type, params);
        };

        return managerInstance.registerApi<Contracts.FlatFileProvider>(ApiType.FlatFileProvider, {
            providerId: client.providerId,
            sendPROSEDiscoveryRequest,
            sendChangeColumnSettingsRequest,
            sendGetColumnInfoRequest,
            sendInsertDataRequest
        });
    }
}
