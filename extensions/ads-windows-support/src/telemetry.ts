/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as vscode from 'vscode';
import TelemetryReporter from 'vscode-extension-telemetry';
import { PlatformInformation } from 'service-downloader/out/platform';

import * as Utils from './utils';

const packageJson = require('../package.json');

export interface ITelemetryEventProperties {
    [key: string]: string;
}

export interface ITelemetryEventMeasures {
    [key: string]: number;
}

/**
 * Filters error paths to only include source files. Exported to support testing
 */
export function filterErrorPath(line: string): string {
    if (line) {
        let values: string[] = line.split('/out/');
        if (values.length <= 1) {
            // Didn't match expected format
            return line;
        } else {
            return values[1];
        }
    }
}

export class Telemetry {
    private static reporter: TelemetryReporter;
    private static userId: string;
    private static platformInformation: PlatformInformation;
    private static disabled: boolean;

    public static getPlatformInformation(): Promise<PlatformInformation> {
        if (this.platformInformation) {
            return Promise.resolve(this.platformInformation);
        } else {
            return new Promise<PlatformInformation>(resolve => {
                PlatformInformation.getCurrent().then(info => {
                    this.platformInformation = info;
                    resolve(this.platformInformation);
                });
            });
        }
    }

    /**
     * Disable telemetry reporting
     */
    public static disable(): void {
        this.disabled = true;
    }

    /**
     * Initialize the telemetry reporter for use.
     */
    public static initialize(): void {
        if (typeof this.reporter === 'undefined') {
            // Check if the user has opted out of telemetry
            if (!vscode.workspace.getConfiguration('telemetry').get<boolean>('enableTelemetry', true)) {
                this.disable();
                return;
            }

            let packageInfo = Utils.getPackageInfo(packageJson);
            this.reporter = new TelemetryReporter(packageInfo.name, packageInfo.version, packageInfo.aiKey);
        }
    }

    /**
     * Send a telemetry event for an exception
     */
    public static sendTelemetryEventForException(
        err: any, methodName: string, extensionConfigName: string): void {
        try {
            let stackArray: string[];
            let firstLine: string = '';
            if (err !== undefined && err.stack !== undefined) {
                stackArray = err.stack.split('\n');
                if (stackArray !== undefined && stackArray.length >= 2) {
                    firstLine = stackArray[1]; // The first line is the error message and we don't want to send that telemetry event
                    firstLine = filterErrorPath(firstLine);
                }
            }

            // Only adding the method name and the fist line of the stack trace. We don't add the error message because it might have PII
            this.sendTelemetryEvent('Exception', { methodName: methodName, errorLine: firstLine });
        } catch (telemetryErr) {
            // If sending telemetry event fails ignore it so it won't break the extension
            console.error('Failed to send telemetry event. error: ' + telemetryErr, extensionConfigName);
        }
    }

    /**
     * Send a telemetry event using application insights
     */
    public static sendTelemetryEvent(
        eventName: string,
        properties?: ITelemetryEventProperties,
        measures?: ITelemetryEventMeasures): void {

        if (typeof this.disabled === 'undefined') {
            this.disabled = false;
        }

        if (this.disabled || typeof (this.reporter) === 'undefined') {
            // Don't do anything if telemetry is disabled
            return;
        }

        if (!properties || typeof properties === 'undefined') {
            properties = {};
        }

        // Augment the properties structure with additional common properties before sending
        Promise.all([this.getPlatformInformation()]).then(() => {
            properties['distribution'] = (this.platformInformation && this.platformInformation.distribution) ?
                `${this.platformInformation.distribution.name}, ${this.platformInformation.distribution.version}` : '';

            this.reporter.sendTelemetryEvent(eventName, properties, measures);
        });
    }
}

Telemetry.initialize();
