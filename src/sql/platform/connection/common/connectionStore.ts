/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ReverseLookUpMap } from 'sql/base/common/map';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionConfig } from 'sql/platform/connection/common/connectionConfig';
import { fixupConnectionCredentials } from 'sql/platform/connection/common/connectionInfo';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { IConnectionProfile, ProfileMatcher } from 'sql/platform/connection/common/interfaces';
import { ICredentialsService } from 'sql/platform/credentials/common/credentialsService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { find } from 'vs/base/common/arrays';

const MAX_CONNECTIONS_DEFAULT = 25;

const RECENT_CONNECTIONS_STATE_KEY = 'recentConnections';
const CRED_PREFIX = 'Microsoft.SqlTools';
const CRED_SEPARATOR = '|';
const CRED_ID_PREFIX = 'id:';
const CRED_ITEMTYPE_PREFIX = 'itemtype:';
const CRED_PROFILE_USER = 'Profile';

/**
 * Manages the connections list including saved profiles and the most recently used connections
 *
 * @export
 */
export class ConnectionStore {
	private groupIdMap = new ReverseLookUpMap<string, string | undefined>();
	private connectionConfig = new ConnectionConfig(this.configurationService, this.capabilitiesService);
	private mru: Array<IConnectionProfile>;

	constructor(
		@IStorageService private storageService: IStorageService,
		@IConfigurationService private configurationService: IConfigurationService,
		@ICredentialsService private credentialService: ICredentialsService,
		@ICapabilitiesService private capabilitiesService: ICapabilitiesService
	) {
		try {
			const configRaw = this.storageService.get(RECENT_CONNECTIONS_STATE_KEY, StorageScope.GLOBAL, '[]');
			this.mru = JSON.parse(configRaw);
		} catch (e) {
			this.mru = [];
		}

		this.storageService.onWillSaveState(() => this.storageService.store(RECENT_CONNECTIONS_STATE_KEY, JSON.stringify(this.mru), StorageScope.GLOBAL));
	}

	/**
	 * Creates a formatted credential usable for uniquely identifying a SQL Connection.
	 * This string can be decoded but is not optimized for this.
	 * @param connectionProfile connection profile - require
	 * @param itemType type of the item (MRU or Profile) - optional
	 * @returns formatted string with server, DB and username
	 */
	private formatCredentialId(connectionProfile: IConnectionProfile, itemType?: string): string {
		const connectionProfileInstance = ConnectionProfile.fromIConnectionProfile(this.capabilitiesService, connectionProfile);
		const cred: string[] = [CRED_PREFIX];
		if (!itemType) {
			itemType = CRED_PROFILE_USER;
		}

		cred.push(CRED_ITEMTYPE_PREFIX.concat(itemType));
		cred.push(CRED_ID_PREFIX.concat(connectionProfileInstance.getConnectionInfoId()));
		return cred.join(CRED_SEPARATOR);
	}

	/**
	 * Returns true if the password is required
	 * @param connection profile
	 */
	public isPasswordRequired(connection: IConnectionProfile): boolean {
		const connectionProfile = ConnectionProfile.fromIConnectionProfile(this.capabilitiesService, connection);
		return connectionProfile.isPasswordRequired();
	}

	public addSavedPassword(credentialsItem: IConnectionProfile): Promise<{ profile: IConnectionProfile, savedCred: boolean }> {
		if (credentialsItem.savePassword && this.isPasswordRequired(credentialsItem) && !credentialsItem.password) {
			const credentialId = this.formatCredentialId(credentialsItem, CRED_PROFILE_USER);
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
	 * @param profile the profile to save
	 * @param whether the plaintext password should be written to the settings file
	 * @returns a Promise that returns the original profile, for help in chaining calls
	 */
	public async saveProfile(profile: IConnectionProfile, forceWritePlaintextPassword?: boolean, matcher?: ProfileMatcher): Promise<IConnectionProfile> {
		// Add the profile to the saved list, taking care to clear out the password field if necessary
		const savedProfile = forceWritePlaintextPassword ? profile : this.getProfileWithoutPassword(profile);
		const savedConnectionProfile = await this.saveProfileToConfig(savedProfile, matcher);
		profile.groupId = savedConnectionProfile.groupId;
		profile.id = savedConnectionProfile.id;
		// Only save if we successfully added the profile
		await this.saveProfilePasswordIfNeeded(profile);
		// Add necessary default properties before returning
		// this is needed to support immediate connections
		fixupConnectionCredentials(profile);
		return profile;
	}

	public savePassword(profile: IConnectionProfile): Promise<boolean> {
		return this.saveProfilePasswordIfNeeded(profile);
	}

	/**
	 * Saves a connection profile group to the user settings.
	 *
	 * @param profile the profile group to save
	 * @returns a Promise that returns the id of connection group
	 */
	public saveProfileGroup(profile: IConnectionProfileGroup): Promise<string> {
		return this.connectionConfig.addGroup(profile);
	}

	private saveProfileToConfig(profile: IConnectionProfile, matcher?: ProfileMatcher): Promise<IConnectionProfile> {
		if (profile.saveProfile) {
			return this.connectionConfig.addConnection(profile, matcher);
		} else {
			return Promise.resolve(profile);
		}
	}

	/**
	 * Gets the list of recently used connections. These will not include the password - a separate call to
	 * {addSavedPassword} is needed to fill that before connecting
	 *
	 * @returns the array of connections, empty if none are found
	 */
	public getRecentlyUsedConnections(providers?: string[]): ConnectionProfile[] {
		let mru = this.mru.slice();
		if (providers && providers.length > 0) {
			mru = mru.filter(c => find(providers, x => x === c.providerName));
		}
		return this.convertConfigValuesToConnectionProfiles(mru);
	}

	private convertConfigValuesToConnectionProfiles(configValues: IConnectionProfile[]): ConnectionProfile[] {
		return configValues.map(c => {
			const connectionProfile = new ConnectionProfile(this.capabilitiesService, c);
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
		});
	}

	public getProfileWithoutPassword(conn: IConnectionProfile): ConnectionProfile {
		let savedConn = ConnectionProfile.fromIConnectionProfile(this.capabilitiesService, conn);
		savedConn = savedConn.withoutPassword();

		return savedConn;
	}

	/**
	 * Adds a connection to the active connections list.
	 * Connection is only added if there are no other connections with the same connection ID in the list.
	 * Password values are stored to a separate credential store if the "savePassword" option is true
	 *
	 * @param conn the connection to add
	 * @param addToMru Whether to add this connection to the MRU
	 * @returns a Promise that returns when the connection was saved
	 */
	public addRecentConnection(conn: IConnectionProfile): Promise<void> {
		const maxConnections = this.getMaxRecentConnectionsCount();
		return this.addConnectionToState(conn, maxConnections, conn.savePassword);
	}

	private addConnectionToState(conn: IConnectionProfile, maxConnections?: number, savePassword?: boolean): Promise<void> {
		// Get all profiles
		const configValues = this.convertConfigValuesToConnectionProfiles(this.mru.slice());
		let configToSave = this.addToConnectionList(conn, configValues);
		if (maxConnections) {
			// Remove last element if needed
			if (configToSave.length > maxConnections) {
				configToSave = configToSave.slice(0, maxConnections);
			}
		}
		this.mru = configToSave;
		return savePassword ? this.doSavePassword(conn).then() : Promise.resolve();
	}

	private addToConnectionList(conn: IConnectionProfile, list: ConnectionProfile[]): IConnectionProfile[] {
		const savedProfile = this.getProfileWithoutPassword(conn);

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
		const savedProfile = this.getProfileWithoutPassword(conn);

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
		this.mru = new Array<IConnectionProfile>();
	}

	public removeRecentConnection(conn: IConnectionProfile): void {
		// Get all profiles
		const configValues = this.convertConfigValuesToConnectionProfiles(this.mru.slice());
		const configToSave = this.removeFromConnectionList(conn, configValues);

		this.mru = configToSave;
	}

	private saveProfilePasswordIfNeeded(profile: IConnectionProfile): Promise<boolean> {
		if (!profile.savePassword) {
			return Promise.resolve(true);
		}
		return this.doSavePassword(profile);
	}

	private doSavePassword(conn: IConnectionProfile): Promise<boolean> {
		if (conn.password) {
			const credentialId = this.formatCredentialId(conn);
			return this.credentialService.saveCredential(credentialId, conn.password);
		} else {
			return Promise.resolve(true);
		}
	}

	public getConnectionProfileGroups(withoutConnections?: boolean, providers?: string[]): ConnectionProfileGroup[] {
		let profilesInConfiguration: ConnectionProfile[] | undefined;
		if (!withoutConnections) {
			profilesInConfiguration = this.connectionConfig.getConnections(true);
			if (providers && providers.length > 0) {
				profilesInConfiguration = profilesInConfiguration.filter(x => find(providers, p => p === x.providerName));
			}
		}
		const groups = this.connectionConfig.getAllGroups();

		return this.convertToConnectionGroup(groups, profilesInConfiguration);
	}

	private convertToConnectionGroup(groups: IConnectionProfileGroup[], connections?: ConnectionProfile[], parent?: ConnectionProfileGroup): ConnectionProfileGroup[] {
		const result: ConnectionProfileGroup[] = [];
		const children = groups.filter(g => g.parentId === (parent ? parent.id : undefined));
		if (children) {
			children.map(group => {
				let connectionGroup = new ConnectionProfileGroup(group.name, parent, group.id, group.color, group.description);
				this.addGroupFullNameToMap(group.id, connectionGroup.fullName);
				if (connections) {
					let connectionsForGroup = connections.filter(conn => conn.groupId === connectionGroup.id);
					let conns: ConnectionProfile[] = [];
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

	public getGroupFromId(groupId: string): IConnectionProfileGroup | undefined {
		const groups = this.connectionConfig.getAllGroups();
		return find(groups, group => group.id === groupId);
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

	private addGroupFullNameToMap(groupId: string, groupFullName?: string): void {
		if (groupId) {
			this.groupIdMap.set(groupId, groupFullName);
		}
		if (groupFullName !== undefined) {
			this.groupIdMap.set(groupFullName.toUpperCase(), groupId);
		}
	}

	private getGroupFullName(groupId: string): string {
		if (!this.groupIdMap.has(groupId)) {
			// Load the cache
			this.getConnectionProfileGroups(true);
		}
		return this.groupIdMap.get(groupId)!;
	}

	private getGroupId(groupFullName: string): string {
		if (groupFullName === ConnectionProfileGroup.GroupNameSeparator) {
			groupFullName = '';
		}
		const key = groupFullName.toUpperCase();
		if (!this.groupIdMap.reverseHas(key)) {
			// Load the cache
			this.getConnectionProfileGroups(true);
		}
		return this.groupIdMap.reverseGet(key)!;
	}
}
