/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { SqlTargetPlatform } from 'sqldbproj';
import * as constants from '../common/constants';
import { AgreementInfo, DockerImageInfo } from '../models/deploy/deployProfile';

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

export function getAgreementDisplayText(agreementInfo: AgreementInfo): string {
	return constants.eulaAgreementText(agreementInfo.link!.text);
}

export function getDockerBaseImages(target: string): DockerImageInfo[] {
	if (target === constants.targetPlatformToVersion.get(SqlTargetPlatform.sqlAzure)) {
		return [{
			name: `${constants.sqlServerDockerRegistry}/${constants.sqlServerDockerRepository}:2019-latest`,
			displayName: 'SQLDB Full',
			agreementInfo: {
				link: {
					text: constants.eulaAgreementTitle,
					url: constants.sqlServerEulaLink,
				}
			}
		}, {
			name: `${constants.sqlServerDockerRegistry}/${constants.azureSqlEdgeDockerRepository}:latest`,
			displayName: 'SQLDB Lite',
			agreementInfo: {
				link: {
					text: constants.edgeEulaAgreementTitle,
					url: constants.sqlServerEdgeEulaLink,
				}
			}
		}];
	} else {
		return [
			{
				name: `${constants.sqlServerDockerRegistry}/${constants.sqlServerDockerRepository}:2017-latest`,
				displayName: 'SQL Server 2017',
				agreementInfo: {
					link: {
						text: constants.eulaAgreementTitle,
						url: constants.sqlServerEulaLink,
					}
				}
			},
			{
				name: `${constants.sqlServerDockerRegistry}/${constants.sqlServerDockerRepository}:2019-latest`,
				displayName: 'SQL Server 2019',
				agreementInfo: {
					link: {
						text: constants.eulaAgreementTitle,
						url: constants.sqlServerEulaLink,
					}
				}
			},
			{
				name: `${constants.sqlServerDockerRegistry}/${constants.azureSqlEdgeDockerRepository}:latest`,
				displayName: 'SQL Server Edge',
				agreementInfo: {
					link: {
						text: constants.edgeEulaAgreementTitle,
						url: constants.sqlServerEdgeEulaLink,
					}
				}
			},
		];
	}
}
