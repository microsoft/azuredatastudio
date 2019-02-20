/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { cmsResource } from '../../cms-resource';
import { CmsResourceRegisteredServer } from './models';

export interface ICmsResourceRegisteredServerService {
	getDatabaseServers(): Promise<CmsResourceRegisteredServer[]>;
}

export interface ICmsResourceRegisteredServerNode extends cmsResource.ICmsResourceNode {
	readonly registeredServer: CmsResourceRegisteredServer;
}