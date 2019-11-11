/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/base/common/connectionProfile';
import * as nls from 'vs/nls';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { find, firstIndex, coalesce } from 'vs/base/common/arrays';
import { Connection, ConnectionState } from 'sql/base/common/connection';
import { Disposable } from 'vs/base/common/lifecycle';
import { ConnectionGroup } from 'sql/base/common/connectionGroup';
import { ILogService } from 'vs/platform/log/common/log';
import { isUndefined } from 'vs/base/common/types';
import { createMemoizer } from 'vs/base/common/decorators';

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
	name: string;
	parentId?: string;
	color?: string;
	description?: string;
}

/**
 * Implements connection profile file storage.
 */
export class ConnectionConfig extends Disposable {

	private static readonly CONNECTION_CONFIG_MEMOIZE = createMemoizer();

	private _rootItems = new Set<ConnectionGroup | Connection>();

	public constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ICapabilitiesService private readonly capabilitiesService: ICapabilitiesService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		this._register(configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration(GROUPS_CONFIG_KEY) || e.affectsConfiguration(CONNECTIONS_CONFIG_KEY)) {
				this.generateGroups();
			}
		}));
		this.generateGroups();
	}

	private generateGroups(): void {
		const toBeAdded = new Map<string, Set<Connection | ConnectionGroup>>();
		const groupConfig = this.configurationService.inspect<StoredGroup[] | undefined>(GROUPS_CONFIG_KEY);
		const connectionConfig = this.configurationService.inspect<StoredConnection[] | undefined>(CONNECTIONS_CONFIG_KEY);
		const groups = coalesce((groupConfig.user || []).concat(groupConfig.workspace || []).map(storeToGroup));
		const connections = coalesce((connectionConfig.user || []).concat(connectionConfig.workspace || []).map(c => storeToConnection(c, this.capabilitiesService)));

		for (const group of groups) {
			const existing = this.findInTree<ConnectionGroup>(i => i.id === group.id);
			if (existing) {

			} else if (group.parent) {
				const existingParent = this.findInTree<ConnectionGroup>(i => i.id === group.parent);
				if (existingParent) {
					existingParent.add(group);
				} else {
					if (!toBeAdded.has(group.parent)) {
						toBeAdded.set(group.parent, new Set<Connection | ConnectionGroup>());
					}
					toBeAdded.get(group.parent).add(group);
				}
			} else {
				// new group and a top level group
				this._rootItems.add(group);
			}

			if (toBeAdded.has(group.id)) {
				const children = toBeAdded.get(group.id);
				toBeAdded.delete(group.id);
				for (const child of children) {
					group.add(child);
				}
			}
		}

		for (const connection of connections) {
			const existing = this.findInTree<Connection>(i => i.id === connection.id);
			if (existing) {

			} else if (connection.groupId) {
				const existingParent = this.findInTree<ConnectionGroup>(i => i.id === connection.groupId);
				if (existingParent) {
					existingParent.add(connection);
				} else {
					if (!toBeAdded.has(connection.groupId)) {
						toBeAdded.set(connection.groupId, new Set<Connection | ConnectionGroup>());
					}
					toBeAdded.get(connection.groupId).add(connection);
				}
			} else {
				// new group and a top level group
				this._rootItems.add(connection);
			}
		}

		ConnectionConfig.CONNECTION_CONFIG_MEMOIZE.clear();
	}

	@ConnectionConfig.CONNECTION_CONFIG_MEMOIZE
	public get groups(): ReadonlyArray<ConnectionGroup> {
		return this.filterAndFlattenTree(item => item instanceof ConnectionGroup) as ReadonlyArray<ConnectionGroup>;
	}

	@ConnectionConfig.CONNECTION_CONFIG_MEMOIZE
	public get connections(): ReadonlyArray<Connection> {
		return this.filterAndFlattenTree(item => item instanceof Connection) as ReadonlyArray<Connection>;
	}

	private filterAndFlattenTree(predicate: (item: ConnectionGroup | Connection) => boolean): Array<ConnectionGroup | Connection> {
		const reduce = (items: Array<ConnectionGroup | Connection>): Array<ConnectionGroup | Connection> => {
			const array = new Array<ConnectionGroup | Connection>();
			for (const item of items) {
				if (predicate(item)) {
					array.push(item);
				}

				if (item instanceof ConnectionGroup) {
					array.push(...reduce(item.children));
				}
			}
			return array;
		};

		return reduce(Array.from(this._rootItems));
	}

	private findInTree<T extends ConnectionGroup | Connection>(predicate: (item: ConnectionGroup | Connection) => boolean): T | undefined {
		const find = (items: Array<ConnectionGroup | Connection>): T | undefined => {
			for (const item of items) {
				if (predicate(item)) {
					return item as T;
				} else if (item instanceof ConnectionGroup) {
					const sub = find(item.children);
					if (!isUndefined(sub)) {
						return sub;
					}
				}
			}
			return undefined;
		};

		return find(Array.from(this._rootItems));
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
	public addGroup(profileGroup: ConnectionGroup): Promise<string> {
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
}

function storeToConnection(store: StoredConnection, capabilitiesService: ICapabilitiesService): Connection | undefined {
	const shape = capabilitiesService.createConnectionShapeFromOptions(store.options, store.providerName);
	if (shape) {
		return new Connection(ConnectionProfile.from(shape), ConnectionState.disconnected, store.id, store.groupId);
	}
	return undefined;
}

function connectionToStore(connection: Connection, capabilitiesService: ICapabilitiesService): StoredConnection | undefined {
	const options = capabilitiesService.createOptionsFromConnectionShape(connection.profile);
	if (options) {
		return { options, providerName: connection.profile.providerName, id: connection.id, groupId: connection.groupId || 'ROOT' };
	}
	return undefined;
}

function storeToGroup(store: StoredGroup): ConnectionGroup {
	return new ConnectionGroup(store.name, store.id, store.parentId, store.color, store.description);
}

function groupToStore(group: ConnectionGroup): StoredGroup {
	return {
		id: group.id,
		name: group.name,
		color: group.color,
		description: group.description,
		parentId: group.parent
	};
}
