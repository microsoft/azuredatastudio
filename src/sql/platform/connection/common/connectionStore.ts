/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as Constants from './constants';
import * as ConnInfo from './connectionInfo';
import { ConnectionProfile } from '../common/connectionProfile';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ICredentialsService } from 'sql/platform/credentials/common/credentialsService';
import { IConnectionConfig } from './iconnectionConfig';
import { ConnectionConfig } from './connectionConfig';
import { Memento } from 'vs/workbench/common/memento';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { ConnectionProfileGroup, IConnectionProfileGroup } from './connectionProfileGroup';
import { ConfigurationEditingService } from 'vs/workbench/services/configuration/node/configurationEditingService';
import { IWorkspaceConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

const MAX_CONNECTIONS_DEFAULT = 25;

/**
 * Manages the connections list including saved profiles and the most recently used connections
 *
 * @export
 * @class ConnectionStore
 */
export class ConnectionStore {
	private _memento: any;
	private _groupIdToFullNameMap: { [groupId: string]: string };
	private _groupFullNameToIdMap: { [groupId: string]: string };

	constructor(
		private _storageService: IStorageService,
		private _context: Memento,
		private _configurationEditService: ConfigurationEditingService,
		private _workspaceConfigurationService: IWorkspaceConfigurationService,
		private _credentialService: ICredentialsService,
		private _capabilitiesService: ICapabilitiesService,
		private _connectionConfig?: IConnectionConfig
	) {
		if (_context) {
			this._memento = this._context.getMemento(StorageScope.GLOBAL);
		}
		this._groupIdToFullNameMap = {};
		this._groupFullNameToIdMap = {};
		if (!this._connectionConfig) {
			this._connectionConfig = new ConnectionConfig(this._configurationEditService,
				this._workspaceConfigurationService, this._capabilitiesService);
		}
	}

	public static get CRED_PREFIX(): string { return 'Microsoft.SqlTools'; }
	public static get CRED_SEPARATOR(): string { return '|'; }
	public static get CRED_ID_PREFIX(): string { return 'id:'; }
	public static get CRED_ITEMTYPE_PREFIX(): string { return 'itemtype:'; }
	public static get CRED_PROFILE_USER(): string { return 'Profile'; }

	public formatCredentialIdForCred(connectionProfile: IConnectionProfile): string {
		if (!connectionProfile) {
			throw new Error('Missing Connection which is required');
		}
		let itemTypeString: string = ConnectionStore.CRED_PROFILE_USER;
		return this.formatCredentialId(connectionProfile, itemTypeString);
	}

	/**
	 * Creates a formatted credential usable for uniquely identifying a SQL Connection.
	 * This string can be decoded but is not optimized for this.
	 * @static
	 * @param {IConnectionProfile} connectionProfile connection profile - require
	 * @param {string} itemType type of the item (MRU or Profile) - optional
	 * @returns {string} formatted string with server, DB and username
	 */
	public formatCredentialId(connectionProfile: IConnectionProfile, itemType?: string): string {
		let connectionProfileInstance: ConnectionProfile = ConnectionProfile.fromIConnectionProfile(
			this._capabilitiesService, connectionProfile);
		if (!connectionProfileInstance.getConnectionInfoId()) {
			throw new Error('Missing Id, which is required');
		}
		let cred: string[] = [ConnectionStore.CRED_PREFIX];
		if (!itemType) {
			itemType = ConnectionStore.CRED_PROFILE_USER;
		}

		ConnectionStore.pushIfNonEmpty(itemType, ConnectionStore.CRED_ITEMTYPE_PREFIX, cred);
		ConnectionStore.pushIfNonEmpty(connectionProfileInstance.getConnectionInfoId(), ConnectionStore.CRED_ID_PREFIX, cred);
		return cred.join(ConnectionStore.CRED_SEPARATOR);
	}

	private static pushIfNonEmpty(value: string, prefix: string, arr: string[]): void {
		if (value) {
			arr.push(prefix.concat(value));
		}
	}

	/**
	 * Returns true if the password is required
	 * @param connection profile
	 */
	public isPasswordRequired(connection: IConnectionProfile): boolean {
		if (connection) {
			let connectionProfile = ConnectionProfile.fromIConnectionProfile(this._capabilitiesService, connection);
			return connectionProfile.isPasswordRequired();
		} else {
			return false;
		}
	}

	public addSavedPassword(credentialsItem: IConnectionProfile): Promise<{ profile: IConnectionProfile, savedCred: boolean }> {
		let self = this;
		return new Promise<{ profile: IConnectionProfile, savedCred: boolean }>((resolve, reject) => {
			if (credentialsItem.savePassword && this.isPasswordRequired(credentialsItem)
				&& !credentialsItem.password) {

				let credentialId = this.formatCredentialIdForCred(credentialsItem);
				self._credentialService.readCredential(credentialId)
					.then(savedCred => {
						if (savedCred) {
							credentialsItem.password = savedCred.password;
							credentialsItem.options['password'] = savedCred.password;
						}
						resolve({ profile: credentialsItem, savedCred: !!savedCred });
					},
					reason => {
						reject(reason);
					});
			} else {
				// No need to look up the password
				resolve({ profile: credentialsItem, savedCred: credentialsItem.savePassword });
			}
		});
	}

	/**
	 * Saves a connection profile to the user settings.
	 * Password values are stored to a separate credential store if the "savePassword" option is true
	 *
	 * @param {IConnectionProfile} profile the profile to save
	 * @param {forceWritePlaintextPassword} whether the plaintext password should be written to the settings file
	 * @returns {Promise<IConnectionProfile>} a Promise that returns the original profile, for help in chaining calls
	 */
	public saveProfile(profile: IConnectionProfile, forceWritePlaintextPassword?: boolean): Promise<IConnectionProfile> {
		const self = this;
		return new Promise<IConnectionProfile>((resolve, reject) => {
			// Add the profile to the saved list, taking care to clear out the password field if necessary
			let savedProfile: IConnectionProfile;
			if (forceWritePlaintextPassword) {
				savedProfile = profile;
			} else {

				savedProfile = this.getProfileWithoutPassword(profile);
			}
			self.saveProfileToConfig(savedProfile)
				.then(savedConnectionProfile => {
					profile.groupId = savedConnectionProfile.groupId;
					profile.id = savedConnectionProfile.id;
					// Only save if we successfully added the profile
					return self.saveProfilePasswordIfNeeded(profile);
					// And resolve / reject at the end of the process
				}, err => {
					reject(err);
				}).then(resolved => {
					// Add necessary default properties before returning
					// this is needed to support immediate connections
					ConnInfo.fixupConnectionCredentials(profile);
					resolve(profile);
				}, err => {
					reject(err);
				});
		});
	}

	/**
	 * Saves a connection profile group to the user settings.
	 *
	 * @param {IConnectionProfileGroup} profile the profile group to save
	 * @returns {Promise<string>} a Promise that returns the id of connection group
	 */
	public saveProfileGroup(profile: IConnectionProfileGroup): Promise<string> {
		const self = this;
		return new Promise<string>((resolve, reject) => {
			self._connectionConfig.addGroup(profile).then(groupId => {
				resolve(groupId);
			}).catch(error => {
				reject(error);
			});
		});
	}

	private saveProfileToConfig(profile: IConnectionProfile): Promise<IConnectionProfile> {
		const self = this;
		return new Promise<IConnectionProfile>((resolve, reject) => {
			if (profile.saveProfile) {
				self._connectionConfig.addConnection(profile).then(savedProfile => {
					resolve(savedProfile);
				}).catch(error => {
					reject(error);
				});
			} else {
				resolve(profile);
			}
		});
	}

	/**
	 * Gets the list of recently used connections. These will not include the password - a separate call to
	 * {addSavedPassword} is needed to fill that before connecting
	 *
	 * @returns {sqlops.ConnectionInfo} the array of connections, empty if none are found
	 */
	public getRecentlyUsedConnections(providers?: string[]): ConnectionProfile[] {
		let configValues: IConnectionProfile[] = this._memento[Constants.recentConnections];
		if (!configValues) {
			configValues = [];
		}

		configValues = configValues.filter(c => !!(c));
		if (providers && providers.length > 0) {
			configValues = configValues.filter(c => providers.includes(c.providerName));
		}
		return this.convertConfigValuesToConnectionProfiles(configValues);
	}

	private convertConfigValuesToConnectionProfiles(configValues: IConnectionProfile[]): ConnectionProfile[] {
		return configValues.map(c => {
			if (c) {
				let connectionProfile = new ConnectionProfile(this._capabilitiesService, c);
				if (connectionProfile.saveProfile) {
					if (!connectionProfile.groupFullName && connectionProfile.groupId) {
						connectionProfile.groupFullName = this.getGroupFullName(connectionProfile.groupId);
					}
					if (!connectionProfile.groupId && connectionProfile.groupFullName) {
						connectionProfile.groupId = this.getGroupId(connectionProfile.groupFullName);
					} else if (!connectionProfile.groupId && !connectionProfile.groupFullName) {
						connectionProfile.groupId = this.getGroupId('');
					}
				}
				return connectionProfile;
			} else {
				return undefined;
			}
		});
	}

	/**
	 * Gets the list of active connections. These will not include the password - a separate call to
	 * {addSavedPassword} is needed to fill that before connecting
	 *
	 * @returns {sqlops.ConnectionInfo} the array of connections, empty if none are found
	 */
	public getActiveConnections(): ConnectionProfile[] {
		let configValues: IConnectionProfile[] = this._memento[Constants.activeConnections];
		if (!configValues) {
			configValues = [];
		}

		return this.convertConfigValuesToConnectionProfiles(configValues);
	}

	public getProfileWithoutPassword(conn: IConnectionProfile): ConnectionProfile {
		if (conn) {
			let savedConn: ConnectionProfile = ConnectionProfile.fromIConnectionProfile(this._capabilitiesService, conn);
			savedConn = savedConn.withoutPassword();

			return savedConn;
		} else {
			return undefined;
		}
	}

	/**
	 * Adds a connection to the active connections list.
	 * Connection is only added if there are no other connections with the same connection ID in the list.
	 * Password values are stored to a separate credential store if the "savePassword" option is true
	 *
	 * @param {IConnectionCredentials} conn the connection to add
	 * @returns {Promise<void>} a Promise that returns when the connection was saved
	 */
	public addActiveConnection(conn: IConnectionProfile, isConnectionToDefaultDb: boolean = false): Promise<void> {
		if (this.getActiveConnections().some(existingConn => existingConn.id === conn.id)) {
			return Promise.resolve(undefined);
		} else {
			return this.addConnectionToMemento(conn, Constants.activeConnections, undefined, conn.savePassword).then(() => {
				let maxConnections = this.getMaxRecentConnectionsCount();
				if (isConnectionToDefaultDb) {
					conn.databaseName = '';
				}
				return this.addConnectionToMemento(conn, Constants.recentConnections, maxConnections);
			});
		}
	}

	public addConnectionToMemento(conn: IConnectionProfile, mementoKey: string, maxConnections?: number, savePassword?: boolean): Promise<void> {
		const self = this;
		return new Promise<void>((resolve, reject) => {
			// Get all profiles
			let configValues = self.getConnectionsFromMemento(mementoKey);
			let configToSave = this.addToConnectionList(conn, configValues);
			if (maxConnections) {
				// Remove last element if needed
				if (configToSave.length > maxConnections) {
					configToSave = configToSave.slice(0, maxConnections);
				}
			}
			self._memento[mementoKey] = configToSave;
			if (savePassword) {
				self.doSavePassword(conn).then(result => {
					resolve(undefined);
				});
			} else {
				resolve(undefined);
			}
		});
	}

	public removeConnectionToMemento(conn: IConnectionProfile, mementoKey: string): Promise<void> {
		const self = this;
		return new Promise<void>((resolve, reject) => {
			// Get all profiles
			let configValues = self.getConnectionsFromMemento(mementoKey);
			let configToSave = this.removeFromConnectionList(conn, configValues);

			self._memento[mementoKey] = configToSave;
			resolve(undefined);
		});
	}

	public getConnectionsFromMemento(mementoKey: string): ConnectionProfile[] {
		let configValues: IConnectionProfile[] = this._memento[mementoKey];
		if (!configValues) {
			configValues = [];
		}

		return this.convertConfigValuesToConnectionProfiles(configValues);
	}

	private addToConnectionList(conn: IConnectionProfile, list: ConnectionProfile[]): IConnectionProfile[] {
		let savedProfile: ConnectionProfile = this.getProfileWithoutPassword(conn);

		// Remove the connection from the list if it already exists
		list = list.filter(value => {
			let equal = value && value.getConnectionInfoId() === savedProfile.getConnectionInfoId();
			if (equal && savedProfile.saveProfile) {
				equal = value.groupId === savedProfile.groupId ||
					ConnectionProfileGroup.sameGroupName(value.groupFullName, savedProfile.groupFullName);
			}
			return !equal;
		});

		list.unshift(savedProfile);

		let newList = list.map(c => {
			let connectionProfile = c ? c.toIConnectionProfile() : undefined;
			return connectionProfile;
		});
		return newList.filter(n => n !== undefined);
	}

	private removeFromConnectionList(conn: IConnectionProfile, list: ConnectionProfile[]): IConnectionProfile[] {
		let savedProfile: ConnectionProfile = this.getProfileWithoutPassword(conn);

		// Remove the connection from the list if it already exists
		list = list.filter(value => {
			let equal = value && value.getConnectionInfoId() === savedProfile.getConnectionInfoId();
			if (equal && savedProfile.saveProfile) {
				equal = value.groupId === savedProfile.groupId ||
					ConnectionProfileGroup.sameGroupName(value.groupFullName, savedProfile.groupFullName);
			}
			return !equal;
		});

		let newList = list.map(c => {
			let connectionProfile = c ? c.toIConnectionProfile() : undefined;
			return connectionProfile;
		});
		return newList.filter(n => n !== undefined);
	}

	/**
	 * Clear all recently used connections from the MRU list.
	 */
	public clearRecentlyUsed(): void {
		this._memento[Constants.recentConnections] = [];
	}

	public clearFromMemento(name: string): void {
		this._memento[name] = [];
	}


	/**
	 * Clear all active connections from the MRU list.
	 */
	public clearActiveConnections(): void {
		this._memento[Constants.activeConnections] = [];
	}

	/**
	 * Remove a connection profile from the active connections list.
	 */
	public removeActiveConnection(conn: IConnectionProfile): Promise<void> {
		return this.removeConnectionToMemento(conn, Constants.activeConnections);
	}

	private saveProfilePasswordIfNeeded(profile: IConnectionProfile): Promise<boolean> {
		if (!profile.savePassword) {
			return Promise.resolve(true);
		}
		return this.doSavePassword(profile);
	}

	private doSavePassword(conn: IConnectionProfile): Promise<boolean> {
		let self = this;
		return new Promise<boolean>((resolve, reject) => {
			if (conn.password) {
				let credentialId = this.formatCredentialId(conn);
				self._credentialService.saveCredential(credentialId, conn.password)
					.then((result) => {
						resolve(result);
					}, reason => {
						// Bubble up error if there was a problem executing the set command
						reject(reason);
					});
			} else {
				resolve(true);
			}
		});
	}

	public getConnectionProfileGroups(withoutConnections?: boolean, providers?: string[]): ConnectionProfileGroup[] {
		let profilesInConfiguration: ConnectionProfile[];
		if (!withoutConnections) {
			profilesInConfiguration = this._connectionConfig.getConnections(true);
			if (providers && providers.length > 0) {
				profilesInConfiguration = profilesInConfiguration.filter(x => providers.includes(x.providerName));
			}
		}
		let groups = this._connectionConfig.getAllGroups();

		let connectionProfileGroups = this.convertToConnectionGroup(groups, profilesInConfiguration, undefined);
		return connectionProfileGroups;
	}

	private convertToConnectionGroup(groups: IConnectionProfileGroup[], connections: ConnectionProfile[], parent: ConnectionProfileGroup = undefined): ConnectionProfileGroup[] {
		let result: ConnectionProfileGroup[] = [];
		let children = groups.filter(g => g.parentId === (parent ? parent.id : undefined));
		if (children) {
			children.map(group => {
				let connectionGroup = new ConnectionProfileGroup(group.name, parent, group.id, group.color, group.description);
				this.addGroupFullNameToMap(group.id, connectionGroup.fullName);
				if (connections) {
					let connectionsForGroup = connections.filter(conn => conn.groupId === connectionGroup.id);
					var conns = [];
					connectionsForGroup.forEach((conn) => {
						conn.groupFullName = connectionGroup.fullName;
						conns.push(conn);
					});
					connectionGroup.addConnections(conns);
				}

				let childrenGroups = this.convertToConnectionGroup(groups, connections, connectionGroup);
				connectionGroup.addGroups(childrenGroups);
				result.push(connectionGroup);
			});
			if (parent) {
				parent.addGroups(result);
			}
		}
		return result;
	}

	public getGroupFromId(groupId: string): IConnectionProfileGroup {
		let groups = this._connectionConfig.getAllGroups();
		return groups.find(group => group.id === groupId);
	}

	private getMaxRecentConnectionsCount(): number {
		let config = this._workspaceConfigurationService.getValue(Constants.sqlConfigSectionName);

		let maxConnections: number = config[Constants.configMaxRecentConnections];
		if (typeof (maxConnections) !== 'number' || maxConnections <= 0) {
			maxConnections = MAX_CONNECTIONS_DEFAULT;
		}
		return maxConnections;
	}

	public editGroup(group: ConnectionProfileGroup): Promise<any> {
		const self = this;
		return new Promise<string>((resolve, reject) => {
			self._connectionConfig.editGroup(group).then(() => {
				resolve(null);
			}).catch(error => {
				reject(error);
			});
		});
	}

	public deleteConnectionFromConfiguration(connection: ConnectionProfile): Promise<void> {
		return this._connectionConfig.deleteConnection(connection);
	}

	public deleteGroupFromConfiguration(group: ConnectionProfileGroup): Promise<void> {
		return this._connectionConfig.deleteGroup(group);
	}

	public changeGroupIdForConnectionGroup(source: ConnectionProfileGroup, target: ConnectionProfileGroup): Promise<void> {
		return this._connectionConfig.changeGroupIdForConnectionGroup(source, target);
	}

	public canChangeConnectionConfig(profile: ConnectionProfile, newGroupID: string): boolean {
		return this._connectionConfig.canChangeConnectionConfig(profile, newGroupID);
	}

	public changeGroupIdForConnection(source: ConnectionProfile, targetGroupId: string): Promise<void> {
		return new Promise<void>((resolve, reject) => {
			this._connectionConfig.changeGroupIdForConnection(source, targetGroupId).then(() => {
				resolve();
			}, (error => {
				reject(error);
			}));
		});
	}

	private addGroupFullNameToMap(groupId: string, groupFullName: string): void {
		if (groupId) {
			this._groupIdToFullNameMap[groupId] = groupFullName;
		}
		if (groupFullName !== undefined) {
			this._groupFullNameToIdMap[groupFullName.toUpperCase()] = groupId;
		}
	}

	private getGroupFullName(groupId: string): string {
		if (groupId in this._groupIdToFullNameMap) {
			return this._groupIdToFullNameMap[groupId];
		} else {
			// Load the cache
			this.getConnectionProfileGroups(true);
		}
		return this._groupIdToFullNameMap[groupId];
	}

	private getGroupId(groupFullName: string): string {
		if (groupFullName === ConnectionProfileGroup.GroupNameSeparator) {
			groupFullName = '';
		}
		let key = groupFullName.toUpperCase();
		let result: string = '';
		if (key in this._groupFullNameToIdMap) {
			result = this._groupFullNameToIdMap[key];
		} else {
			// Load the cache
			this.getConnectionProfileGroups(true);
			result = this._groupFullNameToIdMap[key];
		}
		return result;
	}
}