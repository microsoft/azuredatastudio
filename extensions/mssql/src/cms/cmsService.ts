/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as constants from '../constants';
import * as contracts from '../contracts';
import * as Utils from '../utils';
import { AppContext } from '../appContext';
import { ClientCapabilities } from 'dataprotocol-client/lib/protocol';
import { SqlOpsDataClient, ISqlOpsFeature, BaseService } from 'dataprotocol-client';
import { ListRegisteredServersResult, ICmsService } from 'mssql';

export class CmsService extends BaseService implements ICmsService {
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

	private constructor(context: AppContext, client: SqlOpsDataClient) {
		super(client);
		context.registerService(constants.CmsService, this);
	}

	async createCmsServer(name: string, description: string, connectiondetails: azdata.ConnectionInfo, ownerUri: string): Promise<ListRegisteredServersResult> {
		const params: contracts.CreateCentralManagementServerParams = { registeredServerName: name, registeredServerDescription: description, connectParams: { ownerUri: ownerUri, connection: connectiondetails } };
		return this.runWithErrorHandling(contracts.CreateCentralManagementServerRequest.type, params);
	}

	async getRegisteredServers(ownerUri: string, relativePath: string): Promise<ListRegisteredServersResult> {
		const params: contracts.ListRegisteredServersParams = { parentOwnerUri: ownerUri, relativePath: relativePath };
		return this.runWithErrorHandling(contracts.ListRegisteredServersRequest.type, params);
	}

	async addRegisteredServer(ownerUri: string, relativePath: string, registeredServerName: string, registeredServerDescription: string, connectionDetails: azdata.ConnectionInfo): Promise<boolean> {
		const params: contracts.AddRegisteredServerParams = { parentOwnerUri: ownerUri, relativePath: relativePath, registeredServerName: registeredServerName, registeredServerDescription: registeredServerDescription, registeredServerConnectionDetails: connectionDetails };
		return this.runWithErrorHandling(contracts.AddRegisteredServerRequest.type, params);
	}

	async removeRegisteredServer(ownerUri: string, relativePath: string, registeredServerName: string): Promise<boolean> {
		const params: contracts.RemoveRegisteredServerParams = { parentOwnerUri: ownerUri, relativePath: relativePath, registeredServerName: registeredServerName };
		return this.runWithErrorHandling(contracts.RemoveRegisteredServerRequest.type, params);
	}

	async addServerGroup(ownerUri: string, relativePath: string, groupName: string, groupDescription: string): Promise<boolean> {
		const params: contracts.AddServerGroupParams = { parentOwnerUri: ownerUri, relativePath: relativePath, groupName: groupName, groupDescription: groupDescription };
		return this.runWithErrorHandling(contracts.AddServerGroupRequest.type, params);
	}

	async removeServerGroup(ownerUri: string, relativePath: string, groupName: string): Promise<boolean> {
		const params: contracts.RemoveServerGroupParams = { parentOwnerUri: ownerUri, relativePath: relativePath, groupName: groupName };
		return this.runWithErrorHandling(contracts.RemoveServerGroupRequest.type, params);
	}

	dispose() { }
}
