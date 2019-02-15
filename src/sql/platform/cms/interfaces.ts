/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';

export const SERVICE_ID = 'cmsService';
export const ICmsService = createDecorator<ICmsService>(SERVICE_ID);

export interface ICmsService {
	_serviceBrand: any;

	registerProvider(providerId: string, provider: sqlops.CmsServiceProvider): void;

	createCmsServer(name: string, description:string, connectiondetails: sqlops.ConnectionInfo, connectionUri: string): Thenable<sqlops.ListRegisteredServersResult>;

	getRegisteredServers(ownerUri: string, relativePath: string[]): Thenable<sqlops.ListRegisteredServersResult>;

	addRegisteredServer(ownerUri: string, relativePath: string[], registeredServerName: string, registeredServerDescription: string, connectionDetails: sqlops.ConnectionInfo): Thenable<boolean>;

	removeRegisteredServer(ownerUri: string, relativePath: string[], registeredServerName: string):Thenable<boolean>;

	addServerGroup(ownerUri: string, relativePath: string[], name: string, description:string):Thenable<boolean>;

	removeServerGroup(ownerUri: string, relativePath: string[], name: string):Thenable<boolean>;
}