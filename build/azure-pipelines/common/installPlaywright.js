"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const retry_1 = require("./retry");
const { installDefaultBrowsersForNpmInstall } = require('playwright-core/lib/server');
async function install() {
    await (0, retry_1.retry)(() => installDefaultBrowsersForNpmInstall());
}
install();
