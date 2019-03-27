/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as interfaces from 'sql/platform/connection/common/interfaces';

/**
 * Sets sensible defaults for key connection properties, especially
 * if connection to Azure
 *
 * @export connectionInfo/fixupConnectionCredentials
 * @param {interfaces.IConnectionCredentials} connCreds connection to be fixed up
 * @returns {interfaces.IConnectionCredentials} the updated connection
 */
export function fixupConnectionCredentials(connCreds: interfaces.IConnectionProfile): interfaces.IConnectionProfile {
	if (!connCreds.serverName) {
		connCreds.serverName = '';
	}

	if (!connCreds.databaseName) {
		connCreds.databaseName = '';
	}

	if (!connCreds.userName) {
		connCreds.userName = '';
	}

	if (!connCreds.password) {
		connCreds.password = '';
	}
	return connCreds;
}
