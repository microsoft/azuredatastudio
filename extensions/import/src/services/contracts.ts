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

/**
 * Contract Classes
 */
export interface Result {
    success: boolean;
    errorMessage: string;
}

export interface ColumnInfo {
    name: string;
    sqlType: string;
    isNullable: boolean;
}


/**
 * PROSEDiscoveryRequest
 * Send this request to create a new PROSE session with a new file and preview it
 */
const proseDiscoveryRequestName = 'flatfile/proseDiscovery';

export interface PROSEDiscoveryParams {
    filePath: string;
    tableName: string;
    schemaName?: string;
}

export interface PROSEDiscoveryResponse {
    dataPreview: string[][];
    columnInfo: ColumnInfo[];
}

/**
 * InsertDataRequest
 */
const insertDataRequestName = 'flatfile/insertData';

export interface InsertDataParams {
    connectionString: string;
    batchSize: number;
}

export interface InsertDataResponse {
    result: Result;
}


/**
 * GetColumnInfoRequest
 */
const getColumnInfoRequestName = 'flatfile/getColumnInfo';

export interface GetColumnInfoParams {
}

export interface GetColumnInfoResponse {
    columnInfo: ColumnInfo[];
}


/**
 * ChangeColumnNameRequest
 */
const changeColumnNameRequestName = 'flatfile/changeColumnName';

export interface ChangeColumnNameParams {
    index: number;
    newName: string;
}

export interface ChangeColumnNameResponse {
    result: Result;
}


/**
 * ChangeDataTypeRequest
 */
const changeDataTypeRequestName = 'flatfile/changeDataType';

export interface ChangeDataTypeParams {
    index: number;
    newDataType: string;
}

export interface ChangeDataTypeResponse {
    result: Result;
}

/**
 * Requests
 */
export namespace PROSEDiscoveryRequest {
    export const type = new RequestType<PROSEDiscoveryParams, PROSEDiscoveryResponse, void, void>(proseDiscoveryRequestName);
}

export namespace InsertDataRequest {
    export const type = new RequestType<InsertDataParams, InsertDataResponse, void, void>(insertDataRequestName);
}

export namespace GetColumnInfoRequest {
    export const type = new RequestType<GetColumnInfoParams, GetColumnInfoResponse, void, void>(getColumnInfoRequestName);
}

export namespace ChangeColumnNameRequest {
    export const type = new RequestType<ChangeColumnNameParams, ChangeColumnNameResponse, void, void>(changeColumnNameRequestName);
}

export namespace ChangeDataTypeRequest {
    export const type = new RequestType<ChangeDataTypeParams, ChangeDataTypeResponse, void, void>(changeDataTypeRequestName);
}

export interface FlatFileProvider {
    providerId?: string;

    //sendHelloWorldRequest(params: HelloWorldParam): Thenable<HelloWorldResponse>;
    sendPROSEDiscoveryRequest(params: PROSEDiscoveryParams): Thenable<PROSEDiscoveryResponse>;
    sendInsertDataRequest(params: InsertDataParams): Thenable<InsertDataResponse>;
    sendGetColumnInfoRequest(params: GetColumnInfoParams): Thenable<GetColumnInfoResponse>;
    sendChangeColumnNameRequest(params: ChangeColumnNameParams): Thenable<ChangeColumnNameResponse>;
    sendChangeDataTypeRequest(params: ChangeDataTypeParams): Thenable<ChangeDataTypeResponse>;
}
