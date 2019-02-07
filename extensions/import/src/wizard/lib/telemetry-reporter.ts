import {ObjectMap} from './utils/collections';
import * as fs from 'fs';

export interface VsTelemetryReporterLike {
    sendTelemetryEvent(eventName: string, properties?: ObjectMap<string>, measurements?: ObjectMap<number>): void;
    dispose(): Promise<any>;
}

export class TelemetryReporterLocator {
    private static telemetryReporter: TelemetryReporter;

    static load(packageConfPath: string, reporterCreator: VsTelemetryReporterCreator): void {
        const packageInfo = JSON.parse(fs.readFileSync(packageConfPath, 'utf8'));
        const extensionId = `${packageInfo.publisher}.${packageInfo.name}`;
        const extensionVersion = packageInfo.version;
        const key = packageInfo.telemetryKey;
        const vsTelemetryReporter = reporterCreator(extensionId, extensionVersion, key);
        TelemetryReporterLocator.telemetryReporter = new TelemetryReporter(vsTelemetryReporter);
    }

    static getReporter(): TelemetryReporter {
        return TelemetryReporterLocator.telemetryReporter;
    }
}

export class TelemetryReporter {
    private readonly reporter: VsTelemetryReporterLike;

    constructor(reporter: VsTelemetryReporterLike) {
        this.reporter = reporter;
    }

    logCommandTrigger(commandName: string): void {
        this.reporter.sendTelemetryEvent('commandTriggered', {commandName});
    }

    logCommandErrored(commandName: string): void {
        this.reporter.sendTelemetryEvent('commandErrored', {commandName});
    }

    dispose(): Promise<any> {
        return this.reporter.dispose();
    }
}

export type VsTelemetryReporterCreator = (extensionId: string, extensionVersion: string, telemetryKey: string) => VsTelemetryReporterLike;

export class NullVsTelemetryReporter implements VsTelemetryReporterLike {
    sendTelemetryEvent(_eventName: string, _properties?: ObjectMap<string>, _measurements?: ObjectMap<number>): void {
    }

    dispose(): Promise<any> {
        return Promise.resolve();
    }
}
