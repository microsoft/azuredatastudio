/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from './constants';

const cloudIcon = 'kusto:cloud';

export class KustoIconProvider implements azdata.IconProvider {
	public readonly providerId: string = constants.kustoProviderName;
	public handle?: number;
	getConnectionIconId(connection: azdata.IConnectionProfile, serverInfo: azdata.ServerInfo): Thenable<string | undefined> {
		let iconName: string | undefined;
		if (connection.providerName === this.providerId) {
			iconName = cloudIcon;
		}
		return Promise.resolve(iconName);
	}
}
