/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as sqlops from 'sqlops';
import * as mssql from '../../../../mssql/src/api/mssqlapis';
import { cmsResource } from '../cms-resource';

export interface ICmsRegisteredServerNode extends cmsResource.ICmsResourceNode {
	name: string;
	description: string;
	registeredServers: mssql.RegisteredServerResult[];
	serverGroups: mssql.RegisteredServerGroup[];
}