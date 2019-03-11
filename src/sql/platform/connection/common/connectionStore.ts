/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ReverseLookUpMap } from 'sql/base/common/map';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionConfig } from 'sql/platform/connection/common/connectionConfig';
import { fixupConnectionCredentials } from 'sql/platform/connection/common/connectionInfo';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import * as Constants from 'sql/platform/connection/common/constants';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { ICredentialsService } from 'sql/platform/credentials/common/credentialsService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStateService } from 'vs/platform/state/common/state';

const MAX_CONNECTIONS_DEFAULT = 25;

/**
 * Manages the connections list including saved profiles and the most recently used connections
 *
 * @export
 * @class ConnectionStore
 */
export class ConnectionStore {
	private groupIdMap = new ReverseLookUpMap<string, string>();
	private connectionConfig = new ConnectionConfig(this.configurationService, this.capabilitiesService);

	constructor(
		private stateService: IStateService,
		private configurationService: IConfigurationService,
		private credentialService: ICredentialsService,
		private capabilitiesService: ICapabilitiesService
	) {
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
			this.capabilitiesService, connectionProfile);
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
			let connectionProfile = ConnectionProfile.fromIConnectionProfile(this.capabilitiesService, connection);
			return connectionProfile.isPasswordRequired();
		} else {
			return false;
		}
	}

	public addSavedPassword(credentialsItem: IConnectionProfile): Promise<{ profile: IConnectionProfile, savedCred: boolean }> {
		if (credentialsItem.savePassword && this.isPasswordRequired(credentialsItem) && !credentialsItem.password) {
			let credentialId = this.formatCredentialIdForCred(credentialsItem);
			return this.credentialService.readCredential(credentialId)
				.then(savedCred => {
					if (savedCred) {
						credentialsItem.password = savedCred.password;
						credentialsItem.options['password'] = savedCred.password;
					}
					return { profile: credentialsItem, savedCred: !!savedCred };
				});
		} else {
			// No need to look up the password
			return Promise.resolve({ profile: credentialsItem, savedCred: credentialsItem.savePassword });
		}
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
		// Add the profile to the saved list, taking care to clear out the password field if necessary
		let savedProfile = forceWritePlaintextPassword ? profile : this.getProfileWithoutPassword(profile);
		return this.saveProfileToConfig(savedProfile)
			.then(savedConnectionProfile => {
				profile.groupId = savedConnectionProfile.groupId;
				profile.id = savedConnectionProfile.id;
				// Only save if we successfully added the profile
				return this.saveProfilePasswordIfNeeded(profile);
			}).then(() => {
				// Add necessary default properties before returning
				// this is needed to support immediate connections
				fixupConnectionCredentials(profile);
				return profile;
			});
	}

	/**
	 * Saves a connection profile group to the user settings.
	 *
	 * @param {IConnectionProfileGroup} profile the profile group to save
	 * @returns {Promise<string>} a Promise that returns the id of connection group
	 */
	public saveProfileGroup(profile: IConnectionProfileGroup): Promise<string> {
		return this.connectionConfig.addGroup(profile);
	}

	private saveProfileToConfig(profile: IConnectionProfile): Promise<IConnectionProfile> {
		if (profile.saveProfile) {
			return this.connectionConfig.addConnection(profile);
		} else {
			return Promise.resolve(profile);
		}
	}

	/**
	 * Gets the list of recently used connections. These will not include the password - a separate call to
	 * {addSavedPassword} is needed to fill that before connecting
	 *
	 * @returns {azdata.ConnectionInfo} the array of connections, empty if none are found
	 */
	public getRecentlyUsedConnections(providers?: string[]): ConnectionProfile[] {
		let configValues = this.stateService.getItem<IConnectionProfile[]>(Constants.recentConnections, []).filter(c => !!c);

		if (providers && providers.length > 0) {
			configValues = configValues.filter(c => providers.includes(c.providerName));
		}
		return this.convertConfigValuesToConnectionProfiles(configValues);
	}

	private convertConfigValuesToConnectionProfiles(configValues: IConnectionProfile[]): ConnectionProfile[] {
		return configValues.map(c => {
			if (c) {
				let connectionProfile = new ConnectionProfile(this.capabilitiesService, c);
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
	 * @returns {azdata.ConnectionInfo} the array of connections, empty if none are found
	 */
	public getActiveConnections(): ConnectionProfile[] {
		let configValues: IConnectionProfile[] = this.stateService.getItem<IConnectionProfile[]>(Constants.activeConnections, []);

		return this.convertConfigValuesToConnectionProfiles(configValues);
	}

	public getProfileWithoutPassword(conn: IConnectionProfile): ConnectionProfile {
		if (conn) {
			let savedConn: ConnectionProfile = ConnectionProfile.fromIConnectionProfile(this.capabilitiesService, conn);
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
			return Promise.resolve();
		} else {
			return this.addConnectionToState(conn, Constants.activeConnections, undefined, conn.savePassword).then(() => {
				let maxConnections = this.getMaxRecentConnectionsCount();
				if (isConnectionToDefaultDb) {
					conn.databaseName = '';
				}
				return this.addConnectionToState(conn, Constants.recentConnections, maxConnections);
			});
		}
	}

	public addConnectionToState(conn: IConnectionProfile, key: string, maxConnections?: number, savePassword?: boolean): Promise<void> {
		// Get all profiles
		let configValues = this.getConnectionsFromState(key);
		let configToSave = this.addToConnectionList(conn, configValues);
		if (maxConnections) {
			// Remove last element if needed
			if (configToSave.length > maxConnections) {
				configToSave = configToSave.slice(0, maxConnections);
			}
		}
		this.stateService.setItem(key, configToSave);
		return savePassword ? this.doSavePassword(conn).then() : Promise.resolve();
	}

	public removeConnectionFromState(conn: IConnectionProfile, key: string): void {
		// Get all profiles
		let configValues = this.getConnectionsFromState(key);
		let configToSave = this.removeFromConnectionList(conn, configValues);

		this.stateService.setItem(key, configToSave);
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

		return list.filter(n => n !== undefined).map(c => c.toIConnectionProfile());
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

		return list.filter(n => n !== undefined).map(c => c.toIConnectionProfile());
	}

	/**
	 * Clear all recently used connections from the MRU list.
	 */
	public clearRecentlyUsed(): void {
		this.stateService.setItem(Constants.recentConnections, []);
	}

	/**
	 * Remove a connection profile from the active connections list.
	 */
	public removeActiveConnection(conn: IConnectionProfile): void {
		return this.removeConnectionFromState(conn, Constants.activeConnections);
	}

	private saveProfilePasswordIfNeeded(profile: IConnectionProfile): Promise<boolean> {
		if (!profile.savePassword) {
			return Promise.resolve(true);
		}
		return this.doSavePassword(profile);
	}

	private doSavePassword(conn: IConnectionProfile): Promise<boolean> {
		if (conn.password) {
			let credentialId = this.formatCredentialId(conn);
			return this.credentialService.saveCredential(credentialId, conn.password);
		} else {
			return Promise.resolve(true);
		}
	}

	public getConnectionProfileGroups(withoutConnections?: boolean, providers?: string[]): ConnectionProfileGroup[] {
		let profilesInConfiguration: ConnectionProfile[];
		if (!withoutConnections) {
			profilesInConfiguration = this.connectionConfig.getConnections(true);
			if (providers && providers.length > 0) {
				profilesInConfiguration = profilesInConfiguration.filter(x => providers.includes(x.providerName));
			}
		}
		let groups = this.connectionConfig.getAllGroups();

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
		let groups = this.connectionConfig.getAllGroups();
		return groups.find(group => group.id === groupId);
	}

	private getMaxRecentConnectionsCount(): number {
		return this.configurationService.getValue('sql.maxRecentConnections') || MAX_CONNECTIONS_DEFAULT;
	}

	public editGroup(group: ConnectionProfileGroup): Promise<void> {
		return this.connectionConfig.editGroup(group).then();
	}

	public deleteConnectionFromConfiguration(connection: ConnectionProfile): Promise<void> {
		return this.connectionConfig.deleteConnection(connection);
	}

	public deleteGroupFromConfiguration(group: ConnectionProfileGroup): Promise<void> {
		return this.connectionConfig.deleteGroup(group);
	}

	public changeGroupIdForConnectionGroup(source: ConnectionProfileGroup, target: ConnectionProfileGroup): Promise<void> {
		return this.connectionConfig.changeGroupIdForConnectionGroup(source, target);
	}

	public canChangeConnectionConfig(profile: ConnectionProfile, newGroupID: string): boolean {
		return this.connectionConfig.canChangeConnectionConfig(profile, newGroupID);
	}

	public changeGroupIdForConnection(source: ConnectionProfile, targetGroupId: string): Promise<void> {
		return this.connectionConfig.changeGroupIdForConnection(source, targetGroupId).then();
	}

	private addGroupFullNameToMap(groupId: string, groupFullName: string): void {
		if (groupId) {
			this.groupIdMap.set(groupId, groupFullName);
		}
		if (groupFullName !== undefined) {
			this.groupIdMap.set(groupFullName.toUpperCase(), groupId);
		}
	}

	private getGroupFullName(groupId: string): string {
		if (this.groupIdMap.has(groupId)) {
			return this.groupIdMap.get(groupId);
		} else {
			// Load the cache
			this.getConnectionProfileGroups(true);
		}
		return this.groupIdMap.get(groupId);
	}

	private getGroupId(groupFullName: string): string {
		if (groupFullName === ConnectionProfileGroup.GroupNameSeparator) {
			groupFullName = '';
		}
		let key = groupFullName.toUpperCase();
		let result: string = '';
		if (this.groupIdMap.reverseHas(key)) {
			result = this.groupIdMap.reverseGet(key);
		} else {
			// Load the cache
			this.getConnectionProfileGroups(true);
			result = this.groupIdMap.reverseGet(key);
		}
		return result;
	}
}
