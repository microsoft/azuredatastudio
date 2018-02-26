/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const vscode_extension_telemetry_1 = require("vscode-extension-telemetry");
const utils_1 = require("./utils");
const platform_1 = require("./platform");
/**
 * Filters error paths to only include source files. Exported to support testing
 */
function FilterErrorPath(line) {
    if (line) {
        let values = line.split('/out/');
        if (values.length <= 1) {
            // Didn't match expected format
            return line;
        }
        else {
            return values[1];
        }
    }
}
exports.FilterErrorPath = FilterErrorPath;
class Telemetry {
    static get getRuntimeId() {
        return this._getRuntimeId;
    }
    static set getRuntimeId(runtimeIdGetter) {
        this._getRuntimeId = runtimeIdGetter;
    }
    // Get the unique ID for the current user of the extension
    static getUserId() {
        return new Promise(resolve => {
            // Generate the user id if it has not been created already
            if (typeof this.userId === 'undefined') {
                let id = utils_1.Utils.generateUserId();
                id.then(newId => {
                    this.userId = newId;
                    resolve(this.userId);
                });
            }
            else {
                resolve(this.userId);
            }
        });
    }
    static getPlatformInformation() {
        if (this.platformInformation) {
            return Promise.resolve(this.platformInformation);
        }
        else {
            return new Promise(resolve => {
                platform_1.PlatformInformation.getCurrent(this.getRuntimeId, 'telemetry').then(info => {
                    this.platformInformation = info;
                    resolve(this.platformInformation);
                });
            });
        }
    }
    /**
     * Disable telemetry reporting
     */
    static disable() {
        this.disabled = true;
    }
    /**
     * Initialize the telemetry reporter for use.
     */
    static initialize(context, extensionConstants) {
        if (typeof this.reporter === 'undefined') {
            // Check if the user has opted out of telemetry
            if (!vscode.workspace.getConfiguration('telemetry').get('enableTelemetry', true)) {
                this.disable();
                return;
            }
            let packageInfo = utils_1.Utils.getPackageInfo(context);
            this.reporter = new vscode_extension_telemetry_1.default(extensionConstants.telemetryExtensionName, packageInfo.version, packageInfo.aiKey);
        }
    }
    /**
     * Send a telemetry event for an exception
     */
    static sendTelemetryEventForException(err, methodName, extensionConfigName) {
        try {
            let stackArray;
            let firstLine = '';
            if (err !== undefined && err.stack !== undefined) {
                stackArray = err.stack.split('\n');
                if (stackArray !== undefined && stackArray.length >= 2) {
                    firstLine = stackArray[1]; // The fist line is the error message and we don't want to send that telemetry event
                    firstLine = FilterErrorPath(firstLine);
                }
            }
            // Only adding the method name and the fist line of the stack trace. We don't add the error message because it might have PII
            this.sendTelemetryEvent('Exception', { methodName: methodName, errorLine: firstLine });
            utils_1.Utils.logDebug('Unhandled Exception occurred. error: ' + err + ' method: ' + methodName, extensionConfigName);
        }
        catch (telemetryErr) {
            // If sending telemetry event fails ignore it so it won't break the extension
            utils_1.Utils.logDebug('Failed to send telemetry event. error: ' + telemetryErr, extensionConfigName);
        }
    }
    /**
     * Send a telemetry event using application insights
     */
    static sendTelemetryEvent(eventName, properties, measures) {
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
        Promise.all([this.getUserId, this.getPlatformInformation]).then(() => {
            properties['userId'] = this.userId;
            properties['distribution'] = (this.platformInformation && this.platformInformation.distribution) ?
                `${this.platformInformation.distribution.name}, ${this.platformInformation.distribution.version}` : '';
            this.reporter.sendTelemetryEvent(eventName, properties, measures);
        });
    }
}
exports.Telemetry = Telemetry;
//# sourceMappingURL=telemetry.js.map