/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import * as contracts from '../contracts';
import { AppContext } from '../appContext';
import { ConnectParams, ClientCapabilities } from 'dataprotocol-client/lib/protocol';
import { SqlOpsDataClient, ISqlOpsFeature } from 'dataprotocol-client';
import { ListRegisteredServersResult, ICmsService } from '../mssql';
import * as Utils from '../utils';

export class CmsService implements ICmsService {
	public static asFeature(context: AppContext): ISqlOpsFeature {
		return class extends CmsService {
			constructor(client: SqlOpsDataClient) {
				super(context, client);
			}

			fillClientCapabilities(capabilities: ClientCapabilities): void {
				Utils.ensure(capabilities, 'cms')!.cms = true;
			}

			initialize(): void {
			}
		};
	}

	private constructor(context: AppContext, protected readonly client: SqlOpsDataClient) {
		context.registerService(constants.CmsService, this);
	}

	createCmsServer(name: string, description: string, connectiondetails: azdata.ConnectionInfo, ownerUri: string): Thenable<ListRegisteredServersResult> {
		let connectparams: ConnectParams = { ownerUri: ownerUri, connection: connectiondetails };
		let cmsparams: contracts.CreateCentralManagementServerParams = { registeredServerName: name, registeredServerDescription: description, connectParams: connectparams };

		return this.client.sendRequest(contracts.CreateCentralManagementServerRequest.type, cmsparams).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.CreateCentralManagementServerRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}

	getRegisteredServers(ownerUri: string, relativePath: string): Thenable<ListRegisteredServersResult> {
		let params: contracts.ListRegisteredServersParams = { parentOwnerUri: ownerUri, relativePath: relativePath };
		return this.client.sendRequest(contracts.ListRegisteredServersRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.ListRegisteredServersRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}

	addRegisteredServer(ownerUri: string, relativePath: string, registeredServerName: string, registeredServerDescription: string, connectionDetails: azdata.ConnectionInfo): Thenable<boolean> {
		let params: contracts.AddRegisteredServerParams = { parentOwnerUri: ownerUri, relativePath: relativePath, registeredServerName: registeredServerName, registeredServerDescription: registeredServerDescription, registeredServerConnectionDetails: connectionDetails };
		return this.client.sendRequest(contracts.AddRegisteredServerRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.AddRegisteredServerRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}

	removeRegisteredServer(ownerUri: string, relativePath: string, registeredServerName: string): Thenable<boolean> {
		let params: contracts.RemoveRegisteredServerParams = { parentOwnerUri: ownerUri, relativePath: relativePath, registeredServerName: registeredServerName };
		return this.client.sendRequest(contracts.RemoveRegisteredServerRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.RemoveRegisteredServerRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}

	addServerGroup(ownerUri: string, relativePath: string, groupName: string, groupDescription: string): Thenable<boolean> {
		let params: contracts.AddServerGroupParams = { parentOwnerUri: ownerUri, relativePath: relativePath, groupName: groupName, groupDescription: groupDescription };
		return this.client.sendRequest(contracts.AddServerGroupRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.AddServerGroupRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}

	removeServerGroup(ownerUri: string, relativePath: string, groupName: string): Thenable<boolean> {
		let params: contracts.RemoveServerGroupParams = { parentOwnerUri: ownerUri, relativePath: relativePath, groupName: groupName };
		return this.client.sendRequest(contracts.RemoveServerGroupRequest.type, params).then(
			r => {
				return r;
			},
			e => {
				this.client.logFailedRequest(contracts.RemoveServerGroupRequest.type, e);
				return Promise.reject(new Error(e.message));
			}
		);
	}

	dispose() {

	}
}
