/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { cmsResource } from '../cms-resource';

export interface ICmsRegisteredServerNode extends cmsResource.ICmsResourceNode {
	readonly registeredServer: CmsRegisteredServer;
	readonly serverGroup: CmsServerGroup;
}

export interface CmsRegisteredServer {
	name: string;
	fullName: string;
	loginName: string;
	defaultDatabaseName: string;
}

export interface CmsServerGroup {
	name: string;
	fullName: string;
}