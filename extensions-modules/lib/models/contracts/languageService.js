"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const vscode_languageclient_1 = require("vscode-languageclient");
// ------------------------------- < Telemetry Sent Event > ------------------------------------
/**
 * Event sent when the language service send a telemetry event
 */
var TelemetryNotification;
(function (TelemetryNotification) {
    TelemetryNotification.type = new vscode_languageclient_1.NotificationType('telemetry/sqlevent');
})(TelemetryNotification = exports.TelemetryNotification || (exports.TelemetryNotification = {}));
/**
 * Update event parameters
 */
class TelemetryParams {
}
exports.TelemetryParams = TelemetryParams;
// ------------------------------- </ Telemetry Sent Event > ----------------------------------
// ------------------------------- < Status Event > ------------------------------------
/**
 * Event sent when the language service send a status change event
 */
var StatusChangedNotification;
(function (StatusChangedNotification) {
    StatusChangedNotification.type = new vscode_languageclient_1.NotificationType('textDocument/statusChanged');
})(StatusChangedNotification = exports.StatusChangedNotification || (exports.StatusChangedNotification = {}));
/**
 * Update event parameters
 */
class StatusChangeParams {
}
exports.StatusChangeParams = StatusChangeParams;
//# sourceMappingURL=languageService.js.map