"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const vscode_languageclient_1 = require("vscode-languageclient");
const dataprotocol_client_1 = require("dataprotocol-client");
const sqlops = require("sqlops");
const UUID = require("vscode-languageclient/lib/utils/uuid");
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
var AgentJobsRequest;
(function (AgentJobsRequest) {
    AgentJobsRequest.type = new vscode_languageclient_1.RequestType('agent/jobs');
})(AgentJobsRequest = exports.AgentJobsRequest || (exports.AgentJobsRequest = {}));
var AgentJobHistoryRequest;
(function (AgentJobHistoryRequest) {
    AgentJobHistoryRequest.type = new vscode_languageclient_1.RequestType('agent/jobhistory');
})(AgentJobHistoryRequest = exports.AgentJobHistoryRequest || (exports.AgentJobHistoryRequest = {}));
var AgentJobActionRequest;
(function (AgentJobActionRequest) {
    AgentJobActionRequest.type = new vscode_languageclient_1.RequestType('agent/jobaction');
})(AgentJobActionRequest = exports.AgentJobActionRequest || (exports.AgentJobActionRequest = {}));
class AgentServicesFeature extends dataprotocol_client_1.SqlOpsFeature {
    constructor(client) {
        super(client, AgentServicesFeature.messagesTypes);
    }
    fillClientCapabilities(capabilities) {
        // this isn't explicitly necessary
        // ensure(ensure(capabilities, 'connection')!, 'agentServices')!.dynamicRegistration = true;
    }
    initialize(capabilities) {
        this.register(this.messages, {
            id: UUID.generateUuid(),
            registerOptions: undefined
        });
    }
    registerProvider(options) {
        const client = this._client;
        let getJobs = (ownerUri) => {
            let params = { ownerUri: ownerUri, jobId: null };
            return client.sendRequest(AgentJobsRequest.type, params).then(r => r, e => {
                client.logFailedRequest(AgentJobsRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let getJobHistory = (connectionUri, jobID) => {
            let params = { ownerUri: connectionUri, jobId: jobID };
            return client.sendRequest(AgentJobHistoryRequest.type, params).then(r => r, e => {
                client.logFailedRequest(AgentJobHistoryRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        let jobAction = (connectionUri, jobName, action) => {
            let params = { ownerUri: connectionUri, jobName: jobName, action: action };
            return client.sendRequest(AgentJobActionRequest.type, params).then(r => r, e => {
                client.logFailedRequest(AgentJobActionRequest.type, e);
                return Promise.resolve(undefined);
            });
        };
        return sqlops.dataprotocol.registerAgentServicesProvider({
            providerId: client.providerId,
            getJobs,
            getJobHistory,
            jobAction
        });
    }
}
AgentServicesFeature.messagesTypes = [
    AgentJobsRequest.type,
    AgentJobHistoryRequest.type,
    AgentJobActionRequest.type
];
exports.AgentServicesFeature = AgentServicesFeature;
//# sourceMappingURL=languageService.js.map