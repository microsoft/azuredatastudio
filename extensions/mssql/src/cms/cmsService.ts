/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as azdata from 'azdata';
import * as constants from '../constants';
import * as contracts from '../contracts';
import { AppContext } from '../appContext';
import { ConnectParams } from 'dataprotocol-client/lib/protocol';
import { SqlOpsDataClient } from 'dataprotocol-client';
import { ListRegisteredServersResult } from '../api/mssqlapis';

export class CmsService {

	constructor(private appContext: AppContext, private client: SqlOpsDataClient) {

		this.appContext.registerService<CmsService>(constants.CmsService, this);
	}

	 createCmsServer(name: string, description:string, connectiondetails: azdata.ConnectionInfo, ownerUri: string): Thenable<ListRegisteredServersResult> {
		let connectparams: ConnectParams = { ownerUri: ownerUri, connection: connectiondetails };
		let cmsparams: contracts.CreateCentralManagementServerParams = { registeredServerName: name, registeredServerDescription: description, connectParams: connectparams};

		return this.client.sendRequest(contracts.CreateCentralManagementServerRequest.type, cmsparams).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.CreateCentralManagementServerRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	 getRegisteredServers(ownerUri: string, relativePath: string): Thenable<ListRegisteredServersResult>  {
		let params: contracts.ListRegisteredServersParams = { parentOwnerUri: ownerUri, relativePath: relativePath };
		return this.client.sendRequest(contracts.ListRegisteredServersRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.ListRegisteredServersRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	 addRegisteredServer (ownerUri: string, relativePath: string, registeredServerName: string, registeredServerDescription:string, connectionDetails:azdata.ConnectionInfo): Thenable<boolean> {
		let params: contracts.AddRegisteredServerParams = { parentOwnerUri: ownerUri, relativePath: relativePath, registeredServerName: registeredServerName, registeredServerDescription: registeredServerDescription, registeredServerConnectionDetails: connectionDetails };
		return this.client.sendRequest(contracts.AddRegisteredServerRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.AddRegisteredServerRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	 removeRegisteredServer (ownerUri: string, relativePath: string, registeredServerName: string): Thenable<boolean> {
		let params: contracts.RemoveRegisteredServerParams = { parentOwnerUri: ownerUri, relativePath: relativePath, registeredServerName: registeredServerName };
		return this.client.sendRequest(contracts.RemoveRegisteredServerRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.RemoveRegisteredServerRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	 addServerGroup (ownerUri: string, relativePath: string, groupName: string, groupDescription:string): Thenable<boolean> {
		let params: contracts.AddServerGroupParams = { parentOwnerUri: ownerUri, relativePath: relativePath, groupName: groupName, groupDescription: groupDescription };
		return this.client.sendRequest(contracts.AddServerGroupRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.AddServerGroupRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}

	 removeServerGroup (ownerUri: string, relativePath: string, groupName: string): Thenable<boolean>  {
		let params: contracts.RemoveServerGroupParams = { parentOwnerUri: ownerUri, relativePath: relativePath, groupName: groupName };
		return this.client.sendRequest(contracts.RemoveServerGroupRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.RemoveServerGroupRequest.type, e);
				return Promise.resolve(undefined);
			}
		);
	}
}