import { NotificationType, ServerOptions } from 'vscode-languageclient';
import { ITelemetryEventProperties, ITelemetryEventMeasures } from '../telemetry';
import { Runtime } from '../platform';
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
