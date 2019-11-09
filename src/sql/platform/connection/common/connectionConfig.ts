/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/base/common/connectionProfile';
import { ConnectionGroup, IConnectionProfileGroup } from 'sql/platform/connection/common/connectionGroup';
import { UNSAVED_GROUP_ID } from 'sql/platform/connection/common/constants';
import * as Utils from 'sql/platform/connection/common/utils';
import { generateUuid } from 'vs/base/common/uuid';
import * as nls from 'vs/nls';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { find, firstIndex } from 'vs/base/common/arrays';
import { Connection, ConnectionState } from 'sql/base/common/connection';

const GROUPS_CONFIG_KEY = 'datasource.connectionGroups';
const CONNECTIONS_CONFIG_KEY = 'datasource.connections';

interface StoredConnection {
	options: {};
	groupId: string;
	providerName: string;
	savePassword?: boolean;
	id: string;
}

interface StoredGroup {
	id: string;
	color: string;
}

/**
 * Implements connection profile file storage.
 */
export class ConnectionConfig {

	public constructor(
		private readonly configurationService: IConfigurationService,
		private readonly capabilitiesService: ICapabilitiesService
	) { }

	/**
	 * Returns connection groups from user and workspace settings.
	 */
	public getAllGroups(): IConnectionProfileGroup[] {

		let allGroups: IConnectionProfileGroup[] = [];
		const config = this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY);
		let { user } = config;
		const { workspace } = config;

		if (user) {
			if (workspace) {
				user = user.filter(x => find(workspace, f => this.isSameGroupName(f, x)) === undefined);
				allGroups = allGroups.concat(workspace);
			}
			allGroups = allGroups.concat(user);
		}
		return allGroups.map(g => {
			if (g.parentId === '' || !g.parentId) {
				g.parentId = undefined;
			}
			return g;
		});
	}

	/**
	 * Add a new connection to the connection config.
	 */
	public async addConnection(connection: Connection): Promise<void> {
		const groupId = await this.addGroupFromProfile(profile);
		const profiles = this.configurationService.inspect<StoredConnection[]>(CONNECTIONS_CONFIG_KEY).user || [];
		const newProfile = profileToStore(connectionProfile);

		// Remove the profile if already set
		const indexInProfiles = firstIndex(profiles, value => storeToProfile(value, this.capabilitiesService).matches(connectionProfile));
		if (indexInProfiles >= 0) {
			const sameProfile = profiles[indexInProfiles];
			newProfile.id = sameProfile.id;
			connectionProfile.id = sameProfile.id;
			profiles[indexInProfiles] = newProfile;
		} else {
			profiles.push(newProfile);
		}

		this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, profiles, ConfigurationTarget.USER).then(() => connectionProfile);
	}

	/**
	 *Returns group id
	 */
	public addGroupFromProfile(connection: Connection): Promise<string> {
		if (profile.groupId && profile.groupId !== Utils.defaultGroupId) {
			return Promise.resolve(profile.groupId);
		} else {
			let groups = this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY).user;
			let result = this.saveGroup(groups, profile.groupFullName, undefined, undefined);
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
			let groups = this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY).user;
			let sameNameGroup = groups ? find(groups, group => group.name === profileGroup.name) : undefined;
			if (sameNameGroup) {
				let errMessage: string = nls.localize('invalidServerName', "A server group with the same name already exists.");
				return Promise.reject(errMessage);
			} else {
				let result = this.saveGroup(groups, profileGroup.name, profileGroup.color, profileGroup.description);
				groups = result.groups;

				return this.configurationService.updateValue(GROUPS_CONFIG_KEY, groups, ConfigurationTarget.USER).then(() => result.newGroupId!);
			}
		}
	}

	private getConnectionsForTarget(configTarget: ConfigurationTarget.USER | ConfigurationTarget.WORKSPACE): StoredConnection[] {
		const configs = this.configurationService.inspect<StoredConnection[]>(CONNECTIONS_CONFIG_KEY);
		switch (configTarget) {
			case ConfigurationTarget.USER:
				return configs.user || [];
			case ConfigurationTarget.WORKSPACE:
				return configs.workspace || [];
		}
	}

	private getConnectionGroupsForTarget(configTarget: ConfigurationTarget.USER | ConfigurationTarget.WORKSPACE): StoredGroup[] {
		const configs = this.configurationService.inspect<StoredGroup[]>(CONNECTIONS_CONFIG_KEY);
		switch (configTarget) {
			case ConfigurationTarget.USER:
				return configs.user || [];
			case ConfigurationTarget.WORKSPACE:
				return configs.workspace || [];
		}
	}

	/**
	 * Get a list of all connections in the connection config. Connections returned
	 * are sorted first by whether they were found in the user/workspace settings,
	 * and next alphabetically by profile/server name.
	 */
	public getConnections(getWorkspaceConnections: boolean): Connection[] {
		let profiles: StoredConnection[] = [];
		//TODO: have to figure out how to sort connections for all provider
		// Read from user settings

		const userProfiles = this.getConnectionsForTarget(ConfigurationTarget.USER);
		profiles = profiles.concat(userProfiles);

		if (getWorkspaceConnections) {
			// Read from workspace settings

			const workspaceProfiles = this.getConnectionsForTarget(ConfigurationTarget.WORKSPACE);
			profiles = profiles.concat(workspaceProfiles);
		}

		return profiles.map(p => storeToProfile(p, this.capabilitiesService));
	}

	/**
	 * Delete a connection profile from settings.
	 */
	public deleteConnection(connection: Connection): Promise<void> {
		// Get all connections in the settings
		let profiles = this.getConnectionsForTarget(ConfigurationTarget.USER);
		// Remove the profile from the connections
		profiles = profiles.filter(v => v.id !== connection.id);

		// Write connections back to settings
		return this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, profiles, ConfigurationTarget.USER);
	}

	/**
	 *  Delete a group and all its child connections and groups from settings.
	 * 	Fails if writing to settings fails.
	 */
	public deleteGroup(group: ConnectionGroup): Promise<void> {
		let connections = ConnectionGroup.getConnectionsInGroup(group);
		let subgroups = ConnectionGroup.getSubgroups(group);
		// Add selected group to subgroups list
		subgroups.push(group);
		// Get all connections in the settings
		let profiles = this.getConnectionsForTarget(ConfigurationTarget.USER);
		// Remove the profiles from the connections
		profiles = profiles.filter(value => {
			const providerConnectionProfile = storeToProfile(value, this.capabilitiesService);
			return !connections.some((val) => val.getOptionsKey() === providerConnectionProfile.getOptionsKey());
		});

		// Get all groups in the settings
		let groups = this.getConnectionGroupsForTarget(ConfigurationTarget.USER);
		// Remove subgroups in the settings
		groups = groups.filter((grp) => {
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
	public changeGroupIdForConnectionGroup(source: ConnectionGroup, target: ConnectionGroup): Promise<void> {
		let groups = this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY).user;
		groups = groups.map(g => {
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
		const profiles = this.getConnections(true);
		const existingProfile = find(profiles, p => p.getConnectionInfoId() === profile.getConnectionInfoId() && p.groupId === newGroupID);
		return existingProfile === undefined;
	}

	/**
	 * Moves the connection under the target group with the new ID.
	 */
	private changeGroupIdForConnectionInSettings(profile: ConnectionProfile, newGroupID: string, target: ConfigurationTarget = ConfigurationTarget.USER): Promise<void> {
		const profiles = target === ConfigurationTarget.USER ? this.configurationService.inspect<StoredConnection[]>(CONNECTIONS_CONFIG_KEY).user :
			this.configurationService.inspect<StoredConnection[]>(CONNECTIONS_CONFIG_KEY).workspace;
		if (profiles) {
			if (profile.parent && profile.parent.id === UNSAVED_GROUP_ID) {
				profile.groupId = newGroupID;
				profiles.push(profileToStore(profile));
			} else {
				profiles.forEach((value) => {
					const configProf = storeToProfile(value, this.capabilitiesService);
					if (configProf.getOptionsKey() === profile.getOptionsKey()) {
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
		const groupNames = ConnectionGroup.getGroupFullNameParts(groupFullName);
		return this.saveGroupInTree(groups, undefined, groupNames, color, description, 0);
	}

	public editGroup(source: ConnectionGroup): Promise<void> {
		let groups = this.configurationService.inspect<IConnectionProfileGroup[]>(GROUPS_CONFIG_KEY).user;
		const sameNameGroup = groups ? find(groups, group => group.name === source.name && group.id !== source.id) : undefined;
		if (sameNameGroup) {
			return Promise.reject(nls.localize('invalidServerName', "A server group with the same name already exists."));
		}
		groups = groups.map(g => {
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
				if (ConnectionGroup.isRoot(newGroup.name)) {
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

function storeToProfile(store: StoredConnection, capabilitiesService: ICapabilitiesService): Connection | undefined {
	const shape = capabilitiesService.createConnectionShapeFromOptions(store.options, store.providerName);
	if (shape) {
		return new Connection(ConnectionProfile.from(shape), ConnectionState.disconnected, store.id, store.groupId);
	}
	return undefined;
}

function profileToStore(connection: Connection, capabilitiesService: ICapabilitiesService): StoredConnection | undefined {
	const options = capabilitiesService.createOptionsFromConnectionShape(connection.profile);
	if (options) {
		return { options, providerName: connection.profile.providerName, id: connection.id, groupId: connection.groupId || 'ROOT' };
	}
	return undefined;
}
