/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as constants from './constants';

const cloudIcon = 'kusto:cloud';
const clusterIcon = 'kusto:cluster';

export class MssqlIconProvider implements azdata.IconProvider {
	public readonly providerId: string = constants.sqlProviderName;
	public handle: number;
	getConnectionIconId(connection: azdata.IConnectionProfile, serverInfo: azdata.ServerInfo): Thenable<string> {
		let iconName: string = undefined;
		if (connection.providerName === 'KUSTO') {
			if (serverInfo.isCloud) {
				iconName = cloudIcon;
			} else if (serverInfo.options['isBigDataCluster']) {
				iconName = clusterIcon;
			}
		}
		return Promise.resolve(iconName);
	}
}
