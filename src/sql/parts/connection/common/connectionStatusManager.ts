/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ConnectionManagementInfo } from './connectionManagementInfo';
import { ICapabilitiesService } from 'sql/services/capabilities/capabilitiesService';
import { ConnectionProfile } from 'sql/parts/connection/common/connectionProfile';
import { IConnectionProfile } from './interfaces';
import * as Utils from './utils';
import * as data from 'data';
import { StopWatch } from 'vs/base/common/stopwatch';

export class ConnectionStatusManager {

	private _connections: { [id: string]: ConnectionManagementInfo };
	private _providerCapabilitiesMap: { [providerName: string]: data.DataProtocolServerCapabilities };

	constructor( @ICapabilitiesService private _capabilitiesService: ICapabilitiesService) {
		this._connections = {};
		this._providerCapabilitiesMap = {};
	}

	public getCapabilities(providerName: string): data.DataProtocolServerCapabilities {
		let result: data.DataProtocolServerCapabilities;

		if (providerName in this._providerCapabilitiesMap) {
			result = this._providerCapabilitiesMap[providerName];
		} else {
			let capabilities = this._capabilitiesService.getCapabilities();
			if (capabilities) {
				let providerCapabilities = capabilities.find(c => c.providerName === providerName);
				if (providerCapabilities) {
					this._providerCapabilitiesMap[providerName] = providerCapabilities;
					result = providerCapabilities;
				}
			}
		}

		return result;
	}

	public findConnection(id: string): ConnectionManagementInfo {
		if (id in this._connections) {
			return this._connections[id];
		} else {
			return undefined;
		}
	}

	public findConnectionProfile(connectionProfile: IConnectionProfile): ConnectionManagementInfo {
		let id = Utils.generateUri(connectionProfile);
		return this.findConnection(id);
	}

	public hasConnection(id: string): Boolean {
		return !!this.findConnection(id);
	}

	public deleteConnection(id: string): void {
		let info = this.findConnection(id);
		if (info) {
			for (let key in this._connections) {
				if (this._connections[key].connectionId === info.connectionId) {
					if (this._connections[key].connecting) {
						this._connections[key].deleted = true;
					} else {
						delete this._connections[key];
					}
				}
			}
		}
	}

	public getConnectionProfile(id: string): ConnectionProfile {
		let connectionInfoForId = this.findConnection(id);
		return connectionInfoForId ? connectionInfoForId.connectionProfile : undefined;
	}

	public addConnection(connection: IConnectionProfile, id: string): ConnectionManagementInfo {
		// Always create a copy and save that in the list
		let connectionProfile = new ConnectionProfile(this.getCapabilities(connection.providerName), connection);
		const self = this;
		let connectionInfo: ConnectionManagementInfo = new ConnectionManagementInfo();
		connectionInfo.providerId = connection.providerName;
		connectionInfo.extensionTimer = StopWatch.create();
		connectionInfo.intelliSenseTimer = StopWatch.create();
		connectionInfo.connectionProfile = connectionProfile;
		connectionInfo.connecting = true;
		self._connections[id] = connectionInfo;
		connectionInfo.serviceTimer = StopWatch.create();
		connectionInfo.ownerUri = id;

		return connectionInfo;
	}

	/**
	 *
	 * @param uri Remove connection from list of active connections
	 */
	public removeConnection(uri: string) {
		delete this._connections[uri];
	}

	/**
	 * Call after a connection is saved to settings. It's only for default url connections
	 * which their id is generated from connection options. The group id is used in the generated id.
	 * when the connection is stored, the group id get assigned to the profile and it can change the id
	 * So for those kind of connections, we need to add the new id and the connection
	 */
	public updateConnectionProfile(connection: IConnectionProfile, id: string): string {
		let newId: string = id;
		let connectionInfo: ConnectionManagementInfo = this._connections[id];
		if (connectionInfo && connection) {
			if (this.isDefaultTypeUri(id)) {
				connectionInfo.connectionProfile.groupId = connection.groupId;
				newId = Utils.generateUri(connection);
				if (newId !== id) {
					this.deleteConnection(id);
					this._connections[newId] = connectionInfo;
				}
			}
			connectionInfo.connectionProfile.id = connection.id;
		}
		return newId;
	}

	public onConnectionComplete(summary: data.ConnectionInfoSummary): ConnectionManagementInfo {
		let connection = this._connections[summary.ownerUri];
		connection.serviceTimer.stop();
		connection.connecting = false;
		connection.connectionId = summary.connectionId;
		connection.serverInfo = summary.serverInfo;
		return connection;
	}

	/**
	 * Updates database name after connection is complete
	 * @param summary connection summary
	 */
	public updateDatabaseName(summary: data.ConnectionInfoSummary): void {
		let connection = this._connections[summary.ownerUri];

		//Check if the existing connection database name is different the one in the summary
		if (connection.connectionProfile.databaseName !== summary.connectionSummary.databaseName) {
			//Add the ownerUri with database name to the map if not already exists
			connection.connectionProfile.databaseName = summary.connectionSummary.databaseName;
			let prefix = Utils.getUriPrefix(summary.ownerUri);
			let ownerUriWithDbName = Utils.generateUriWithPrefix(connection.connectionProfile, prefix);
			if (!(ownerUriWithDbName in this._connections)) {
				this._connections[ownerUriWithDbName] = connection;
			}
		}
	}

	/**
	 * Tries to find an existing connection that's mapped with the given ownerUri
	 * The purpose for this method is to find the connection given the ownerUri and find the original uri assigned to it. most of the times should be the same.
	 * Only if the db name in the original uri is different when connection is complete, we need to use the original uri
	 * Returns the generated ownerUri for the connection profile if not existing connection found
	 * @param ownerUri connection owner uri to find an existing connection
	 * @param purpose purpose for the connection
	 */
	public getOriginalOwnerUri(ownerUri: string): string {
		let ownerUriToReturn: string = ownerUri;

		let connectionStatusInfo = this.findConnection(ownerUriToReturn);
		if (connectionStatusInfo && connectionStatusInfo.ownerUri) {
			//The ownerUri in the connection status is the one service knows about so use that
			//To call the service for any operation
			ownerUriToReturn = connectionStatusInfo.ownerUri;
		}
		return ownerUriToReturn;
	}

	public onConnectionChanged(changedConnInfo: data.ChangedConnectionInfo): IConnectionProfile {
		let connection = this._connections[changedConnInfo.connectionUri];
		if (connection && connection.connectionProfile) {
			connection.connectionProfile.serverName = changedConnInfo.connection.serverName;
			connection.connectionProfile.databaseName = changedConnInfo.connection.databaseName;
			connection.connectionProfile.userName = changedConnInfo.connection.userName;
			return connection.connectionProfile;
		}
		return undefined;
	}

	public isConnected(id: string): boolean {
		return (id in this._connections && this._connections[id].connectionId && !!this._connections[id].connectionId);
	}

	public isConnecting(id: string): boolean {
		return (id in this._connections && this._connections[id].connecting);
	}

	public isDefaultTypeUri(uri: string): boolean {
		return uri && uri.startsWith(Utils.uriPrefixes.default);
	}

	public getProviderIdFromUri(ownerUri: string): string {
		let providerId: string = '';
		let connection = this.findConnection(ownerUri);
		if (connection) {
			providerId = connection.connectionProfile.providerName;
		}
		if (!providerId && this.isDefaultTypeUri(ownerUri)) {
			let optionsKey = ownerUri.replace(Utils.uriPrefixes.default, '');
			providerId = ConnectionProfile.getProviderFromOptionsKey(optionsKey);
		}
		return providerId;
	}

	/**
	 * Get a list of the active connection profiles managed by the status manager
	*/
	public getActiveConnectionProfiles(): ConnectionProfile[] {
		let profiles = Object.values(this._connections).map((connectionInfo: ConnectionManagementInfo) => connectionInfo.connectionProfile);
		// Remove duplicate profiles that may be listed multiple times under different URIs by filtering for profiles that don't have the same ID as an earlier profile in the list
		return profiles.filter((profile, index) => profiles.findIndex(otherProfile => otherProfile.id === profile.id) === index);
	}
}