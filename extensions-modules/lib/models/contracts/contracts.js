/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_languageclient_1 = require("vscode-languageclient");
// --------------------------------- < Version Request > -------------------------------------------------
// Version request message callback declaration
var VersionRequest;
(function (VersionRequest) {
    VersionRequest.type = new vscode_languageclient_1.RequestType('version');
})(VersionRequest = exports.VersionRequest || (exports.VersionRequest = {}));
//# sourceMappingURL=contracts.js.map