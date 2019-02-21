/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ICmsResourceService } from './interfaces';
import { CmsRegisteredServer } from './models';

export class CmsResourceService implements ICmsResourceService {
	public async getRegisteredServers(): Promise<CmsRegisteredServer[]> {
		const databaseServers: CmsRegisteredServer[] = [];

		const svrs = [];

		svrs.forEach((svr) => databaseServers.push({
			name: svr.name,
			 fullName: svr.fullyQualifiedDomainName,
			 loginName: svr.administratorLogin,
			 defaultDatabaseName: 'master'
		}));

		return databaseServers;
	}

	public getServerGroups() {

	}
}
