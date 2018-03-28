import vscode = require('vscode');
import { PlatformInformation, Runtime, LinuxDistribution } from './platform';
import { IExtensionConstants } from './contracts/contracts';
export interface ITelemetryEventProperties {
    [key: string]: string;
}
export interface ITelemetryEventMeasures {
    [key: string]: number;
}
/**
 * Filters error paths to only include source files. Exported to support testing
 */
export declare function FilterErrorPath(line: string): string;
export declare class Telemetry {
    private static reporter;
    private static userId;
    private static platformInformation;
    private static disabled;
    private static _getRuntimeId;
    static getRuntimeId: (platform: string, architecture: string, distribution: LinuxDistribution) => Runtime;
    static getUserId(): Promise<string>;
    static getPlatformInformation(): Promise<PlatformInformation>;
    /**
     * Disable telemetry reporting
     */
    static disable(): void;
    /**
     * Initialize the telemetry reporter for use.
     */
    static initialize(context: vscode.ExtensionContext, extensionConstants: IExtensionConstants): void;
    /**
     * Send a telemetry event for an exception
     */
    static sendTelemetryEventForException(err: any, methodName: string, extensionConfigName: string): void;
    /**
     * Send a telemetry event using application insights
     */
    static sendTelemetryEvent(eventName: string, properties?: ITelemetryEventProperties, measures?: ITelemetryEventMeasures): void;
}
