"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const os = require("os");
const utils_1 = require("./utils");
/*
* Logger class handles logging messages using the Util functions.
*/
class Logger {
    constructor(writer, extensionConstants, prefix) {
        this._indentLevel = 0;
        this._indentSize = 4;
        this._atLineStart = false;
        this._writer = writer;
        this._prefix = prefix;
        this._extensionConstants = extensionConstants;
    }
    logDebug(message) {
        utils_1.Utils.logDebug(message, this._extensionConstants.extensionConfigSectionName);
    }
    _appendCore(message) {
        if (this._atLineStart) {
            if (this._indentLevel > 0) {
                const indent = ' '.repeat(this._indentLevel * this._indentSize);
                this._writer(indent);
            }
            if (this._prefix) {
                this._writer(`[${this._prefix}] `);
            }
            this._atLineStart = false;
        }
        this._writer(message);
    }
    increaseIndent() {
        this._indentLevel += 1;
    }
    decreaseIndent() {
        if (this._indentLevel > 0) {
            this._indentLevel -= 1;
        }
    }
    append(message) {
        message = message || '';
        this._appendCore(message);
    }
    appendLine(message) {
        message = message || '';
        this._appendCore(message + os.EOL);
        this._atLineStart = true;
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map