/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { RequestType, NotificationType } from 'vscode-languageclient';

/**
 * @interface IMessage
 */
export interface IMessage {
    jsonrpc: string;
}

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

export interface ITelemetryEventProperties {
    [key: string]: string;
}

export interface ITelemetryEventMeasures {
    [key: string]: number;
}


// ------------------------------- </ Telemetry Sent Event > ----------------------------------

// ------------------------------- < Flat File Methods > ------------------------------------

// export interface HelloWorldParam {
//     name: string;
// }

// export interface HelloWorldResponse {
//     response: string;
// }

// export namespace HelloWorldRequest {
//     export const type = new RequestType<HelloWorldParam, HelloWorldResponse, void, void>('flatfile/helloworld');
// }

export interface PROSEDiscoveryParam {
    filePath: string;
}

export interface ColumnInfo
{
    name: string;
    sqlType: string;
}

export interface PROSEDiscoveryResponse {
    dataPreview: string[][];
    columnsInfo: ColumnInfo[];
}

export namespace PROSEDiscoveryRequest {
    export const type = new RequestType<PROSEDiscoveryParam, PROSEDiscoveryResponse, void, void>('flatfile/prosediscovery');
}

export interface FlatFileProvider {
    providerId?: string;

    //sendHelloWorldRequest(params: HelloWorldParam): Thenable<HelloWorldResponse>;
    sendPROSEDiscoveryRequest(params: PROSEDiscoveryParam): Thenable<PROSEDiscoveryResponse>;
}
