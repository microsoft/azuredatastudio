/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ICmsResourceRegisteredServerService } from './interfaces';
import { CmsResourceRegisteredServer } from './models';

export class AzureResourceDatabaseServerService implements ICmsResourceRegisteredServerService {
	public async getDatabaseServers(): Promise<CmsResourceRegisteredServer[]> {
		const databaseServers: CmsResourceRegisteredServer[] = [];

		const svrs = [];

		svrs.forEach((svr) => databaseServers.push({
			name: svr.name,
			 fullName: svr.fullyQualifiedDomainName,
			 loginName: svr.administratorLogin,
			 defaultDatabaseName: 'master'
		}));

		return databaseServers;
	}
}
