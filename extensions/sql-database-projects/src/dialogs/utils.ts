/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as constants from '../common/constants';

/**
 * Gets connection name from connection object if there is one,
 * otherwise set connection name in format that shows in OE
 */
export function getConnectionName(connection: any): string {
	let connectionName: string;
	if (connection.options['connectionName']) {
		connectionName = connection.options['connectionName'];
	} else {
		let user = connection.options['user'];
		if (!user) {
			user = constants.defaultUser;
		}

		connectionName = `${connection.options['server']} (${user})`;
	}

	return connectionName;
}


export function getDockerBaseImages(): string[] {
	return [
		`${constants.sqlServerDockerRegistry}/${constants.sqlServerDockerRepository}:2017-latest`,
		`${constants.sqlServerDockerRegistry}/${constants.sqlServerDockerRepository}:2019-latest`,
		`${constants.sqlServerDockerRegistry}/${constants.azureSqlEdgeDockerRepository}:latest`
	];
}
