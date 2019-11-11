/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { ConnectionProfile } from 'sql/base/common/connectionProfile';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { find, coalesce, firstIndex } from 'vs/base/common/arrays';
import { Connection, ConnectionState } from 'sql/base/common/connection';
import { Disposable } from 'vs/base/common/lifecycle';
import { ConnectionGroup } from 'sql/base/common/connectionGroup';
import { ILogService } from 'vs/platform/log/common/log';
import { isUndefined } from 'vs/base/common/types';
import { createMemoizer } from 'vs/base/common/decorators';
import { deepClone } from 'vs/base/common/objects';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';

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

export const IConnectionConfig = createDecorator<IConnectionConfig>('connectionConfig');
export interface IConnectionConfig {
	readonly groups: ReadonlyArray<ConnectionGroup>;
	readonly connections: ReadonlyArray<Connection>;
	addGroup(group: ConnectionGroup): Promise<void>;
	addConnection(connection: Connection): Promise<void>;
	deleteGroup(group: ConnectionGroup): Promise<void>;
	deleteConnection(connection: Connection): Promise<void>;
}

/**
 * Implements connection profile file storage.
 */
export class ConnectionConfig extends Disposable implements IConnectionConfig {

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
				//TODO
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

		// at this point we should have all the groups we need to add connections to
		if (toBeAdded.size > 0) {
			this.logService.error('There are hanging groups in the settings with invalid parent groups');
		}

		for (const connection of connections) {
			const existing = this.findInTree<Connection>(i => i.id === connection.id);
			if (existing) {
				//TODO
			} else if (connection.groupId) {
				const existingParent = this.findInTree<ConnectionGroup>(i => i.id === connection.groupId);
				if (existingParent) {
					existingParent.add(connection);
				} else {
					this.logService.error(`Group for connection ${connection.id} is missing`);
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
		const connections = this.configurationService.inspect<StoredConnection[]>(CONNECTIONS_CONFIG_KEY).user || [];
		const newConnection = connectionToStore(connection, this.capabilitiesService);

		if (find(connections, p => p.id === newConnection.id)) {
			throw new Error('Connection already exists in config');
		}

		connections.push(newConnection);

		await this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, connections, ConfigurationTarget.USER);
	}

	/**
	 *Returns group id
	 */
	public async addGroup(group: ConnectionGroup): Promise<void> {
		const groups = this.configurationService.inspect<StoredGroup[]>(GROUPS_CONFIG_KEY).user || [];
		const newGroup = groupToStore(group);

		if (find(groups, p => p.id === newGroup.id)) {
			throw new Error('Connection group already existing in config');
		}

		groups.push(newGroup);

		await this.configurationService.updateValue(GROUPS_CONFIG_KEY, groups, ConfigurationTarget.USER);
	}

	/**
	 * Delete a connection profile from settings.
	 */
	public async deleteConnection(connection: Connection): Promise<void> {
		const connections = this.configurationService.inspect<StoredConnection[]>(CONNECTIONS_CONFIG_KEY).user || [];
		const newConnections = connections.filter(v => v.id !== connection.id);

		if (connection.groupId) {
			const parent = this.findInTree<ConnectionGroup>(i => i.id === connection.groupId);
			if (parent) {
				parent.remove(connection);
			}
		} else {
			const deleted = this._rootItems.delete(connection);
			if (!deleted) {
				throw new Error('connection didnt originate from connection config');
			}
			ConnectionConfig.CONNECTION_CONFIG_MEMOIZE.clear();
		}

		if (connections.length === newConnections.length) {
			this.logService.warn('Delete connection didnt result in any changes, not updating settings');
		} else {
			// Write connections back to settings
			await this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, newConnections, ConfigurationTarget.USER);
		}
	}

	/**
	 *  Delete a group and all its child connections and groups from settings.
	 * 	Fails if writing to settings fails.
	 */
	public deleteGroup(group: ConnectionGroup, deleteChildren: boolean = true): Promise<void> {
		const connections = this.configurationService.inspect<StoredConnection[]>(CONNECTIONS_CONFIG_KEY).user || [];
		const groups = this.configurationService.inspect<StoredGroup[]>(GROUPS_CONFIG_KEY).user || [];

		if (deleteChildren) {
			const deleteChildren = (group: ConnectionGroup): void => {
				for (const child of group.children) {
					if (child instanceof ConnectionGroup) {
						deleteChildren(child);
						group.remove(child);
						const deleteIndex = firstIndex(groups, g => g.id === child.id);
						groups.splice(deleteIndex, 1);
					} else {
						group.remove(child);
						const deleteIndex = firstIndex(groups, g => g.id === child.id);
						connections.splice(deleteIndex, 1);
					}
				}
			};

			deleteChildren(group);
		}

		if (group.parent) {
			const parent = this.findInTree<ConnectionGroup>(i => i.id === group.parent);
			if (parent) {
				parent.remove(group);
			}
		} else {
			this._rootItems.delete(group);
			ConnectionConfig.CONNECTION_CONFIG_MEMOIZE.clear();
		}
		const deleteIndex = firstIndex(groups, g => g.id === group.id);
		groups.splice(deleteIndex, 1);

		const updateConnections = this.configurationService.updateValue(CONNECTIONS_CONFIG_KEY, connections, ConfigurationTarget.USER);
		const updateGroups = this.configurationService.updateValue(GROUPS_CONFIG_KEY, groups, ConfigurationTarget.USER);

		return Promise.all([updateConnections, updateGroups]).then();
	}
}

function storeToConnection(store: StoredConnection, capabilitiesService: ICapabilitiesService): Connection | undefined {
	const shape = capabilitiesService.createConnectionShapeFromOptions(deepClone(store.options), store.providerName);
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
	const obj: StoredGroup = {
		id: group.id,
		name: group.name
	};

	if (group.color) {
		obj.color = group.color;
	}

	if (group.description) {
		obj.description = group.description;
	}

	if (group.parent) {
		obj.parentId = group.parent;
	}

	return obj;
}

registerSingleton(IConnectionConfig, ConnectionConfig, true);
