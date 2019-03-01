/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import { cmsResource } from '../cms-resource';

export interface ICmsRegisteredServerNode extends cmsResource.ICmsResourceNode {
	name: string;
	description: string;
	registeredServers: sqlops.RegisteredServerResult[];
	serverGroups: sqlops.ServerGroupResult[];
}