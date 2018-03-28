import { NotificationType, ServerOptions, RequestType, ClientCapabilities, ServerCapabilities } from 'vscode-languageclient';
import { ITelemetryEventProperties, ITelemetryEventMeasures } from '../telemetry';
import { Runtime } from '../platform';
import { SqlOpsFeature, SqlOpsDataClient } from 'dataprotocol-client';
import * as sqlops from 'sqlops';
import { Disposable } from 'vscode';
/**
 * Event sent when the language service send a telemetry event
 */
export declare namespace TelemetryNotification {
    const type: NotificationType<TelemetryParams, void>;
}
/**
 * Update event parameters
 */
export declare class TelemetryParams {
    params: {
        eventName: string;
        properties: ITelemetryEventProperties;
        measures: ITelemetryEventMeasures;
    };
}
/**
 * Event sent when the language service send a status change event
 */
export declare namespace StatusChangedNotification {
    const type: NotificationType<StatusChangeParams, void>;
}
/**
 * Update event parameters
 */
export declare class StatusChangeParams {
    /**
     * URI identifying the text document
     */
    ownerUri: string;
    /**
     * The new status of the document
     */
    status: string;
}
export interface ILanguageClientHelper {
    createServerOptions(servicePath: string, runtimeId?: Runtime): ServerOptions;
}
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
export declare namespace AgentJobsRequest {
    const type: RequestType<AgentJobsParams, AgentJobsResult, void, void>;
}
export declare namespace AgentJobHistoryRequest {
    const type: RequestType<AgentJobHistoryParams, AgentJobHistoryResult, void, void>;
}
export declare namespace AgentJobActionRequest {
    const type: RequestType<AgentJobActionParams, AgentJobActionResult, void, void>;
}
export declare class AgentServicesFeature extends SqlOpsFeature<undefined> {
    private static readonly messagesTypes;
    constructor(client: SqlOpsDataClient);
    fillClientCapabilities(capabilities: ClientCapabilities): void;
    initialize(capabilities: ServerCapabilities): void;
    protected registerProvider(options: undefined): Disposable;
}
