/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from './constants';

const cloudIcon = 'azuremonitor:cloud';

export class AzureMonitorIconProvider implements azdata.IconProvider {
	public readonly providerId: string = constants.azuremonitorProviderName;
	public handle?: number;
	getConnectionIconId(connection: azdata.IConnectionProfile, _serverInfo: azdata.ServerInfo): Thenable<string | undefined> {
		let iconName: string | undefined;
		if (connection.providerName === this.providerId) {
			iconName = cloudIcon;
		}
		return Promise.resolve(iconName);
	}
}
