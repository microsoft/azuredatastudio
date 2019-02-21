/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { cmsResource } from '../cms-resource';
import { CmsRegisteredServer } from './models';

export interface ICmsResourceService {
	getRegisteredServers(): Promise<CmsRegisteredServer[]>;
	getServerGroups();
}

export interface ICmsRegisteredServerNode extends cmsResource.ICmsResourceNode {
	readonly registeredServer: CmsRegisteredServer;
}