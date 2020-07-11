/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ConnectionProfileGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { UNSAVED_GROUP_ID } from 'sql/platform/connection/common/constants';
import { IConnectionProfile, IConnectionProfileStore, ProfileMatcher } from 'sql/platform/connection/common/interfaces';
import * as Utils from 'sql/platform/connection/common/utils';
import { generateUuid } from 'vs/base/common/uuid';
import * as nls from 'vs/nls';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { find, firstIndex } from 'vs/base/common/arrays';
import { deepClone } from 'vs/base/common/objects';

const GROUPS_CONFIG_KEY = 'datasource.connectionGroups';
const CONNECTIONS_CONFIG_KEY = 'datasource.connections';

export interface ISaveGroupResult {
	groups: IConnectionProfileGroup[];
	newGroupId?: string;
}

/**
 * Implements connection profile file storage.
 */
export class ConnectionConfig {

	public constructor(
		private configurationService: IConfigurationService,
		private _capabilitiesService: ICapabilitiesService
	) { }

	/**
	 * Returns connection groups from user and workspace settings.
	 */
	public getAllGroups(): IConnectionProfileGroup[] {

		let allGroups: IConnectionProfileGroup[] = [];
		const config = this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY);
		let { userValue } = config;
		const { workspaceValue } = config;

		if (userValue) {
			if (workspaceValue) {
				userValue = userValue.filter(x => find(workspaceValue, f => this.isSameGroupName(f, x)) === undefined);
				allGroups = allGroups.concat(workspaceValue);
			}
			allGroups = allGroups.concat(userValue);
		}
		return deepClone(allGroups).map(g => {
			if (g.parentId === '' || !g.parentId) {
				g.parentId = undefined;
			}
			return g;
		});
	}

	/**
	 * Add a new connection to the connection config.
	 */
	public addConnection(profile: IConnectionProfile, matcher: ProfileMatcher = ConnectionProfile.matchesProfile): Promise<IConnectionProfile> {
		if (profile.saveProfile) {
			return this.addGroupFromProfile(profile).then(groupId => {
				let profiles = deepClone(this.configurationService.inspect<IConnectionProfileStore[]>(CONNECTIONS_CONFIG_KEY).userValue);
				if (!profiles) {
					profiles = [];
				}

				let connectionProfile = this.getConnectionProfileInstance(profile, groupId);
				let newProfile = ConnectionProfile.convertToProfileStore(this._capabilitiesService, connectionProfile);

				// Remove the profile if already set
				let sameProfileInList = find(profiles, value => {
					let providerConnectionProfile = ConnectionProfile.createFromStoredProfile(value, this._capabilitiesService);
					return matcher(providerConnectionProfile, connectionProfile);
				});
				if (sameProfileInList) {
					let profileIndex = firstIndex(profiles, value => value === sameProfileInList);
					newProfile.id = sameProfileInList.id;
					connectionProfile.id = sameProfileInList.id;
					profiles[profileIndex] = newProfile;
				} else {
					profiles.push(newProfile);
				}

				return this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, profiles, ConfigurationTarget.USER).then(() => connectionProfile);
			});
		} else {
			return Promise.resolve(profile);
		}
	}

	private getConnectionProfileInstance(profile: IConnectionProfile, groupId: string): ConnectionProfile {
		let connectionProfile = profile as ConnectionProfile;
		if (connectionProfile === undefined) {
			connectionProfile = new ConnectionProfile(this._capabilitiesService, profile);
		}
		connectionProfile.groupId = groupId;
		return connectionProfile;
	}

	/**
	 *Returns group id
	 */
	public addGroupFromProfile(profile: IConnectionProfile): Promise<string> {
		if (profile.groupId && profile.groupId !== Utils.defaultGroupId) {
			return Promise.resolve(profile.groupId);
		} else {
			let groups = deepClone(this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY).userValue);
			let result = this.saveGroup(groups!, profile.groupFullName, undefined, undefined);
			groups = result.groups;

			return this.configurationService.updateValue(GROUPS_CONFIG_KEY, groups, ConfigurationTarget.USER).then(() => result.newGroupId!);
		}
	}

	/**
	 *Returns group id
	 */
	public addGroup(profileGroup: IConnectionProfileGroup): Promise<string> {
		if (profileGroup.id) {
			return Promise.resolve(profileGroup.id);
		} else {
			let groups = deepClone(this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY).userValue);
			let sameNameGroup = groups ? find(groups, group => group.name === profileGroup.name) : undefined;
			if (sameNameGroup) {
				let errMessage: string = nls.localize('invalidServerName', "A server group with the same name already exists.");
				return Promise.reject(errMessage);
			} else {
				let result = this.saveGroup(groups!, profileGroup.name, profileGroup.color, profileGroup.description);
				groups = result.groups;

				return this.configurationService.updateValue(GROUPS_CONFIG_KEY, groups, ConfigurationTarget.USER).then(() => result.newGroupId!);
			}
		}
	}

	private getConnectionProfilesForTarget(configTarget: ConfigurationTarget): IConnectionProfileStore[] {
		let configs = this.configurationService.inspect<IConnectionProfileStore[]>(CONNECTIONS_CONFIG_KEY);
		let profiles: IConnectionProfileStore[];
		if (configs) {
			let fromConfig: IConnectionProfileStore[] | undefined;
			if (configTarget === ConfigurationTarget.USER) {
				fromConfig = configs.userValue;
			} else if (configTarget === ConfigurationTarget.WORKSPACE) {
				fromConfig = configs.workspaceValue || [];
			}
			if (fromConfig) {
				profiles = deepClone(fromConfig);
				if (this.fixConnectionIds(profiles)) {
					this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, profiles, configTarget);
				}
			} else {
				profiles = [];
			}
		} else {
			profiles = [];
		}

		return profiles;
	}

	/**
	 * Replace duplicate ids with new ones. Sets id for the profiles without id
	 */
	private fixConnectionIds(profiles: IConnectionProfileStore[]): boolean {
		let idsCache: { [label: string]: boolean } = {};
		let changed: boolean = false;
		for (let profile of profiles) {
			if (!profile.id) {
				profile.id = generateUuid();
				changed = true;
			}
			if (profile.id in idsCache) {
				profile.id = generateUuid();
				changed = true;
			}
			idsCache[profile.id] = true;
		}
		return changed;
	}

	public getIConnectionProfileStores(getWorkspaceConnections: boolean): IConnectionProfileStore[] {
		let profiles: IConnectionProfileStore[] = [];
		//TODO: have to figure out how to sort connections for all provider
		// Read from user settings

		let userProfiles: IConnectionProfileStore[] = this.getConnectionProfilesForTarget(ConfigurationTarget.USER);
		if (userProfiles !== undefined) {
			profiles = profiles.concat(userProfiles);
		}

		if (getWorkspaceConnections) {
			// Read from workspace settings

			let workspaceProfiles: IConnectionProfileStore[] = this.getConnectionProfilesForTarget(ConfigurationTarget.WORKSPACE);
			if (workspaceProfiles !== undefined) {
				profiles = profiles.concat(workspaceProfiles);
			}
		}

		return profiles;
	}

	/**
	 * Get a list of all connections in the connection config. Connections returned
	 * are sorted first by whether they were found in the user/workspace settings,
	 * and next alphabetically by profile/server name.
	 */
	public getConnections(getWorkspaceConnections: boolean): ConnectionProfile[] {
		let connectionProfiles = this.getIConnectionProfileStores(getWorkspaceConnections).map(p => {
			return ConnectionProfile.createFromStoredProfile(p, this._capabilitiesService);
		});

		return connectionProfiles;
	}

	/**
	 * Delete a connection profile from settings.
	 */
	public deleteConnection(profile: ConnectionProfile): Promise<void> {
		// Get all connections in the settings
		let profiles = this.configurationService.inspect<IConnectionProfileStore[]>(CONNECTIONS_CONFIG_KEY).userValue;
		// Remove the profile from the connections
		profiles = profiles!.filter(value => {
			let providerConnectionProfile = ConnectionProfile.createFromStoredProfile(value, this._capabilitiesService);
			return providerConnectionProfile.getOptionsKey() !== profile.getOptionsKey();
		});

		// Write connections back to settings
		return this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, profiles, ConfigurationTarget.USER);
	}

	/**
	 *  Delete a group and all its child connections and groups from settings.
	 * 	Fails if writing to settings fails.
	 */
	public deleteGroup(group: ConnectionProfileGroup): Promise<void> {
		let connections = ConnectionProfileGroup.getConnectionsInGroup(group);
		let subgroups = ConnectionProfileGroup.getSubgroups(group);
		// Add selected group to subgroups list
		subgroups.push(group);
		// Get all connections in the settings
		let profiles = this.configurationService.inspect<IConnectionProfileStore[]>(CONNECTIONS_CONFIG_KEY).userValue;
		// Remove the profiles from the connections
		profiles = profiles!.filter(value => {
			let providerConnectionProfile = ConnectionProfile.createFromStoredProfile(value, this._capabilitiesService);
			return !connections.some((val) => val.getOptionsKey() === providerConnectionProfile.getOptionsKey());
		});

		// Get all groups in the settings
		let groups = this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY).userValue;
		// Remove subgroups in the settings
		groups = groups!.filter((grp) => {
			return !subgroups.some((item) => item.id === grp.id);
		});
		return Promise.all([
			this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, profiles, ConfigurationTarget.USER),
			this.configurationService.updateValue(GROUPS_CONFIG_KEY, groups, ConfigurationTarget.USER)
		]).then(() => Promise.resolve());
	}

	/**
	 * Moves the source group under the target group.
	 */
	public changeGroupIdForConnectionGroup(source: ConnectionProfileGroup, target: ConnectionProfileGroup): Promise<void> {
		let groups = deepClone(this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY).userValue);
		groups = groups!.map(g => {
			if (g.id === source.id) {
				g.parentId = target.id;
			}
			return g;
		});
		return this.configurationService.updateValue(GROUPS_CONFIG_KEY, groups, ConfigurationTarget.USER);
	}

	/**
	 * Returns true if connection can be moved to another group
	 */
	public canChangeConnectionConfig(profile: ConnectionProfile, newGroupID: string): boolean {
		let profiles = this.getIConnectionProfileStores(true);
		let existingProfile = find(profiles, p =>
			p.providerName === profile.providerName &&
			p.options.authenticationType === profile.options.authenticationType &&
			p.options.database === profile.options.database &&
			p.options.server === profile.options.server &&
			p.options.user === profile.options.user &&
			p.groupId === newGroupID);
		return existingProfile === undefined;
	}

	/**
	 * Moves the connection under the target group with the new ID.
	 */
	private changeGroupIdForConnectionInSettings(profile: ConnectionProfile, newGroupID: string, target: ConfigurationTarget = ConfigurationTarget.USER): Promise<void> {
		let profiles = deepClone(target === ConfigurationTarget.USER ? this.configurationService.inspect<IConnectionProfileStore[]>(CONNECTIONS_CONFIG_KEY).userValue :
			this.configurationService.inspect<IConnectionProfileStore[]>(CONNECTIONS_CONFIG_KEY).workspaceValue);
		if (profiles) {
			if (profile.parent && profile.parent.id === UNSAVED_GROUP_ID) {
				profile.groupId = newGroupID;
				profiles.push(ConnectionProfile.convertToProfileStore(this._capabilitiesService, profile));
			} else {
				profiles.forEach((value) => {
					if (value.id === profile.id) {
						value.groupId = newGroupID;
					}
				});
			}

			return this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, profiles, target);
		} else {
			return Promise.resolve();
		}
	}

	/**
	 * Moves the connection under the target group with the new ID.
	 */
	public changeGroupIdForConnection(profile: ConnectionProfile, newGroupID: string): Promise<void> {
		if (!this.canChangeConnectionConfig(profile, newGroupID)) {
			// Same connection already exists in this group
			return Promise.reject('Same connection already exists in the group');
		} else {
			return Promise.all([
				this.changeGroupIdForConnectionInSettings(profile, newGroupID, ConfigurationTarget.USER),
				this.changeGroupIdForConnectionInSettings(profile, newGroupID, ConfigurationTarget.WORKSPACE)
			]).then(() => Promise.resolve());
		}
	}

	public saveGroup(groups: IConnectionProfileGroup[], groupFullName?: string, color?: string, description?: string): ISaveGroupResult {
		let groupNames = ConnectionProfileGroup.getGroupFullNameParts(groupFullName);
		return this.saveGroupInTree(groups, undefined, groupNames, color, description, 0);
	}

	public editGroup(source: ConnectionProfileGroup): Promise<void> {
		let groups = deepClone(this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY).userValue);
		let sameNameGroup = groups ? find(groups, group => group.name === source.name && group.id !== source.id) : undefined;
		if (sameNameGroup) {
			let errMessage: string = nls.localize('invalidServerName', "A server group with the same name already exists.");
			return Promise.reject(errMessage);
		}
		groups = groups!.map(g => {
			if (g.id === source.id) {
				g.name = source.name;
				g.description = source.description;
				g.color = source.color;
				source.isRenamed = false;
			}
			return g;
		});
		return this.configurationService.updateValue(GROUPS_CONFIG_KEY, groups, ConfigurationTarget.USER);
	}

	private isSameGroupName(group1: IConnectionProfileGroup, group2: IConnectionProfileGroup): boolean {
		let sameGroupName: boolean = false;
		if (group1 && group2) {
			sameGroupName = ((!group1.name && !group2.name) || group1.name.toUpperCase() === group2.name.toUpperCase()) &&
				(group1.parentId === group2.parentId || (!group1.parentId && !group2.parentId));
		}
		return sameGroupName;
	}

	private saveGroupInTree(groupTree: IConnectionProfileGroup[], parentId: string | undefined, groupNames: string[], color: string | undefined, description: string | undefined, index: number): ISaveGroupResult {
		if (!groupTree) {
			groupTree = [];
		}
		let newGroupId: string | undefined;

		if (index < groupNames.length) {
			let groupName: string = groupNames[index];
			let newGroup = <unknown>{ // workaround to make this work properly
				name: groupName,
				id: undefined,
				parentId: parentId,
				color: color,
				description: description
			} as IConnectionProfileGroup;
			let found = find(groupTree, group => this.isSameGroupName(group, newGroup));
			if (found) {
				if (index === groupNames.length - 1) {
					newGroupId = found.id;
					//Found the group full name
				} else {
					let result = this.saveGroupInTree(groupTree, found.id, groupNames, color, description, index + 1);
					groupTree = result.groups;
					newGroupId = result.newGroupId;
				}

			} else {
				if (ConnectionProfileGroup.isRoot(newGroup.name)) {
					newGroup.id = Utils.defaultGroupId;
				} else {
					newGroup.id = generateUuid();
				}
				let result = this.saveGroupInTree(groupTree, newGroup.id, groupNames, color, description, index + 1);
				newGroupId = result.newGroupId;
				groupTree = result.groups;
				groupTree.push(newGroup);
				if (index === groupNames.length - 1) {
					newGroupId = newGroup.id;
				}
			}
		}
		let groupResult: ISaveGroupResult = {
			groups: groupTree,
			newGroupId: newGroupId
		};
		return groupResult;
	}
}
