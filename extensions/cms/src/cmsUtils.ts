/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as nls from 'vscode-nls';
import * as vscode from 'vscode';
import * as azdata from 'azdata';
import * as mssql from '../../mssql/src/api/mssqlapis';
import * as Utils from './cmsResource/utils';
import { ICmsResourceNodeInfo } from './cmsResource/tree/baseTreeNodes';

const localize = nls.loadMessageBundle();
const cmsProvider: string = 'MSSQL-CMS';
const mssqlProvider: string = 'MSSQL';

/**
 * Wrapper class to act as a facade over VSCode and Data APIs and allow us to test / mock callbacks into
 * this API from our code
 *
 * @export
 * ApiWrapper
 */
export class CmsUtils {

	private _cmsService: mssql.CmsService;
	private _registeredCmsServers: ICmsResourceNodeInfo[];

	public showErrorMessage(message: string, ...items: string[]): Thenable<string | undefined> {
		return vscode.window.showErrorMessage(message, ...items);
	}

	/**
	 * Get the configuration for a extensionName
	 * @param extensionName The string name of the extension to get the configuration for
	 * @param resource The optional URI, as a URI object or a string, to use to get resource-scoped configurations
	 */
	public getConfiguration(): vscode.WorkspaceConfiguration {
		return vscode.workspace.getConfiguration('centralManagementServers');
	}

	public async setConfiguration(value: any): Promise<void> {
		await vscode.workspace.getConfiguration('centralManagementServers').update('servers', value, true);
	}

	// Connection APIs
	public openConnectionDialog(providers: string[], initialConnectionProfile?: azdata.IConnectionProfile, connectionCompletionOptions?: azdata.IConnectionCompletionOptions): Thenable<azdata.connection.Connection> {
		return azdata.connection.openConnectionDialog(providers, initialConnectionProfile, connectionCompletionOptions);
	}

	public async getUriForConnection(connection: azdata.connection.Connection): Promise<string> {
		let ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
		if (!ownerUri) {
			// Make a connection if it's not already connected
			await azdata.connection.connect(Utils.toConnectionProfile(connection), false, false).then(async (result) => {
				ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
			});
		}
		return ownerUri;
	}

	// CMS APIs
	public async getCmsService(): Promise<mssql.CmsService> {
		if (!this._cmsService) {
			let extensionApi: mssql.MssqlExtensionApi = vscode.extensions.getExtension('Microsoft.mssql').exports;
			this._cmsService = await extensionApi.getCmsServiceProvider();
		}
		return this._cmsService;
	}

	public async getRegisteredServers(ownerUri: string, relativePath: string): Promise<mssql.ListRegisteredServersResult> {
		return this.getCmsService().then((service) => {
			return service.getRegisteredServers(ownerUri, relativePath).then((result) => {
				if (result && result.registeredServersList && result.registeredServersList) {
					return result;
				}
			});
		});
	}

	public async createCmsServer(connection: azdata.connection.Connection,
		name: string, description: string): Promise<mssql.ListRegisteredServersResult> {
		let provider = await this.getCmsService();
		connection.providerName = connection.providerName === cmsProvider ? mssqlProvider : connection.providerName;
		let ownerUri = await azdata.connection.getUriForConnection(connection.connectionId);
		if (!ownerUri) {
			// Make a connection if it's not already connected
			await azdata.connection.connect(Utils.toConnectionProfile(connection), false, false).then(async (result) => {
				ownerUri = await azdata.connection.getUriForConnection(result.connectionId);
			});
		}
		return provider.createCmsServer(name, description, connection, ownerUri).then((result) => {
			if (result) {
				return result;
			}
		});
	}

	public async deleteCmsServer(cmsServer: any): Promise<void> {
		let config = this.getConfiguration();
		if (config && config.servers) {
			let newServers = config.servers.filter((cachedServer) => {
				return cachedServer.name !== cmsServer;
			});
			await this.setConfiguration(newServers);
			this._registeredCmsServers = this._registeredCmsServers.filter((cachedServer) => {
				return cachedServer.name !== cmsServer;
			});
		}
	}

	public cacheRegisteredCmsServer(name: string, description: string, ownerUri: string, connection: azdata.connection.Connection): void {
		if (!this._registeredCmsServers) {
			this._registeredCmsServers = [];
		}
		let cmsServerNode: ICmsResourceNodeInfo = {
			name: name,
			description: description,
			connection: connection,
			ownerUri: ownerUri
		};
		this._registeredCmsServers.push(cmsServerNode);
	}

	public async addRegisteredServer(relativePath: string, ownerUri: string,
		parentServerName?: string): Promise<boolean> {
		let provider = await this.getCmsService();
		// Initial profile to disallow SQL Login without
		// changing provider.
		let initialProfile: azdata.IConnectionProfile = {
			connectionName: undefined,
			serverName: undefined,
			databaseName: undefined,
			userName: undefined,
			password: undefined,
			authenticationType: undefined,
			savePassword: undefined,
			groupFullName: undefined,
			groupId: undefined,
			providerName: undefined,
			saveProfile: undefined,
			id: undefined,
			options: {
				authTypeChanged: true
			}
		};
		return this.openConnectionDialog([cmsProvider], initialProfile, { saveConnection: false }).then(async (connection) => {
			if (connection && connection.options) {
				if (connection.options.server === parentServerName) {
					// error out for same server registration
					let errorText = localize('cms.errors.sameServerUnderCms', 'You cannot add a shared registered server with the same name as the Configuration Server');
					this.showErrorMessage(errorText);
					return false;
				} else {
					let registeredServerName = connection.options.registeredServerName === '' ? connection.options.server : connection.options.registeredServerName;
					let result = await provider.addRegisteredServer(ownerUri, relativePath, registeredServerName, connection.options.registeredServerDescription, connection);
					return result;
				}

			}
		});
	}

	public async removeRegisteredServer(registeredServerName: string, relativePath: string, ownerUri: string): Promise<boolean> {
		let provider = await this.getCmsService();
		return provider.removeRegisteredServer(ownerUri, relativePath, registeredServerName).then((result) => {
			return result;
		});
	}

	public async addServerGroup(groupName: string, groupDescription: string, relativePath: string, ownerUri: string): Promise<boolean> {
		let provider = await this.getCmsService();
		return provider.addServerGroup(ownerUri, relativePath, groupName, groupDescription).then((result) => {
			return result;
		});
	}

	public async removeServerGroup(groupName: string, relativePath: string, ownerUri: string): Promise<boolean> {
		let provider = await this.getCmsService();
		return provider.removeServerGroup(ownerUri, relativePath, groupName).then((result) => {
			return result;
		});
	}

	// Getters
	public get registeredCmsServers(): ICmsResourceNodeInfo[] {
		return this._registeredCmsServers;
	}

	public get connection(): Thenable<azdata.connection.Connection> {
		return this.openConnectionDialog([cmsProvider], undefined, { saveConnection: false }).then((connection) => {
			if (connection) {
				// remove group ID from connection if a user chose connection
				// from the recent connections list
				connection.options['groupId'] = null;
				connection.providerName = mssqlProvider;
				return connection;
			}
		});
	}
}