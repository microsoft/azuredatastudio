/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from './constants';

const cloudIcon = 'mssql:cloud';
const managedInstanceIcon = 'mssql:managedInstance';
export class MssqlIconProvider implements azdata.IconProvider {
	public readonly providerId: string = constants.sqlProviderName;
	public handle: number;
	getConnectionIconId(connection: azdata.IConnectionProfile, serverInfo: azdata.ServerInfo): Thenable<string | undefined> {
		let iconName: string | undefined = undefined;
		if (connection.providerName === constants.sqlProviderName) {
			if (serverInfo.engineEditionId === azdata.DatabaseEngineEdition.SqlManagedInstance) {
				iconName = managedInstanceIcon;
			}
			if (serverInfo.isCloud) {
				iconName = cloudIcon;
			}
		}
		return Promise.resolve(iconName);
	}
}
