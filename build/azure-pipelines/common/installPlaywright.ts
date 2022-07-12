/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { retry } from './retry';
const { installBrowsersWithProgressBar } = require('playwright/lib/install/installer');

async function install() {
	await retry(() => installDefaultBrowsersForNpmInstall());
}

install();
