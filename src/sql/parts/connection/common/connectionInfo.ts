/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import Interfaces = require('./interfaces');

/**
 * Sets sensible defaults for key connection properties, especially
 * if connection to Azure
 *
 * @export connectionInfo/fixupConnectionCredentials
 * @param {Interfaces.IConnectionCredentials} connCreds connection to be fixed up
 * @returns {Interfaces.IConnectionCredentials} the updated connection
 */
export function fixupConnectionCredentials(connCreds: Interfaces.IConnectionProfile): Interfaces.IConnectionProfile {
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

