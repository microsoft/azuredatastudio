/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { isUndefinedOrNull } from 'vs/base/common/types';

export interface INewConnectionProfileGroup {
	id?: string;
	parentId?: string;
	name: string;
	color?: string;
	description?: string;
}

export interface IConnectionProfileGroup extends INewConnectionProfileGroup {
	id?: string;
}

export class ConnectionProfileGroup implements IConnectionProfileGroup {

	private _childGroups: ConnectionProfileGroup[] = [];
	private _childConnections: ConnectionProfile[] = [];
	public parentId?: string;
	private _isRenamed = false;
	public readonly isRoot: boolean = false;
	public readonly textColor: string = 'white'; // This value should come from the constructor when issue: https://github.com/microsoft/azuredatastudio/issues/13138 is fixed

	public constructor(
		public name: string,
		public parent?: ConnectionProfileGroup,
		public id?: string,
		public color?: string,
		public description?: string
	) {
		this.parentId = parent ? parent.id : undefined;
		if (ConnectionProfileGroup.isRoot(this.name)) {
			this.name = '';
			this.isRoot = true;
		}
	}

	public static GroupNameSeparator: string = '/';
	public static RootGroupName: string = 'ROOT';

	public toObject(): IConnectionProfileGroup {
		let subgroups = undefined;
		if (this._childGroups.length > 0) {
			subgroups = [];
			this._childGroups.forEach((group) => {
				subgroups.push(group.toObject());
			});
		}

		return Object.assign({}, { name: this.name, id: this.id, parentId: this.parentId, children: subgroups, color: this.color, description: this.description });
	}

	public get groupName(): string {
		return this.name;
	}

	public get fullName(): string | undefined {
		let fullName: string | undefined = (this.id === 'root') ? undefined : this.name;
		if (this.parent) {
			let parentFullName = this.parent.fullName;
			if (parentFullName) {
				fullName = parentFullName + ConnectionProfileGroup.GroupNameSeparator + this.name;
			}
		}
		return fullName;
	}

	public get isRenamed(): boolean {
		return this._isRenamed;
	}

	public set isRenamed(val: boolean) {
		this._isRenamed = val;
	}

	public get children(): ConnectionProfileGroup[] | undefined {
		return this._childGroups;
	}

	public set children(children: ConnectionProfileGroup[] | undefined) {
		this._childGroups = children ?? [];
	}

	public get connections(): ConnectionProfile[] | undefined {
		return this._childConnections;
	}

	public set connections(connections: ConnectionProfile[] | undefined) {
		this._childConnections = connections ?? [];
	}

	public hasChildren(): boolean {
		if (this._childGroups.length > 0 || this._childConnections.length > 0) {
			return true;
		}
		return false;
	}

	/**
	 * Returns true if all connections in the tree have valid options using the correct capabilities
	 */
	public get hasValidConnections(): boolean {
		let invalidConnections = this._childConnections.find(c => c.serverCapabilities === undefined);
		if (invalidConnections !== undefined) {
			return false;
		} else {
			let childrenAreValid: boolean = true;
			this._childGroups.forEach(element => {
				let isChildValid = element.hasValidConnections;
				if (!isChildValid) {
					childrenAreValid = false;
				}
			});
			return childrenAreValid;
		}
	}

	public getChildren(): (ConnectionProfile | ConnectionProfileGroup)[] {
		let allChildren: (ConnectionProfile | ConnectionProfileGroup)[] = [];
		this._childConnections.forEach((conn) => {
			allChildren.push(conn);
		});

		this._childGroups.forEach((group) => {
			allChildren.push(group);
		});
		return allChildren;
	}

	public equals(other: any): boolean {
		if (!(other instanceof ConnectionProfileGroup)) {
			return false;
		}
		return other.id === this.id;
	}

	public addConnections(connections: ConnectionProfile[] | undefined): void {
		connections?.forEach((conn) => {
			this._childConnections = this._childConnections.filter((curConn) => { return curConn.id !== conn.id; });
			conn.parent = this;
			conn.groupId = this.id;
			this._childConnections.push(conn);
		});

	}

	public addGroups(groups: ConnectionProfileGroup[] | undefined): void {
		groups?.forEach((group) => {
			this._childGroups = this._childGroups.filter((grp) => { return group.id !== grp.id; });
			group.parent = this;
			group.parentId = this.id;
			this._childGroups.push(group);
		});
	}

	/**
	 * Remove the given connections from the group.
	 */
	public removeConnections(connections: ConnectionProfile[]): void {
		const connectionIdsToRemove = connections.map(conn => conn.id);
		this._childConnections = this._childConnections.filter((conn) => { return !connectionIdsToRemove.includes(conn.id); });
	}

	/**
	 * Gets the matching connection from the group if it exists
	 */
	public getMatchingConnection(connection: ConnectionProfile): ConnectionProfile | undefined {
		return this._childConnections.find((conn) => connection.matches(conn));
	}

	/**
	 * Adds the given connection to the group if it doesn't already exist, otherwise replaces the matching connection.
	 */
	public addOrReplaceConnection(connection: ConnectionProfile): void {
		const matchingConnection = this.getMatchingConnection(connection);
		connection.parent = this;
		connection.groupId = this.id;
		connection.groupFullName = this.fullName;
		if (matchingConnection) {
			this.replaceConnection(connection, matchingConnection.id);
		} else {
			this._childConnections.push(connection);
		}
	}

	/**
	 * Replaces the connection with the given id with the given connection
	 * @param connection The connection to replace with
	 * @param oldConnectionId The id of the existing connection to replace
	 */
	public replaceConnection(connection: ConnectionProfile, oldConnectionId: string): void {
		const oldConnectionIndex = this._childConnections.findIndex((conn) => conn.id === oldConnectionId);
		if (oldConnectionIndex !== -1) {
			this._childConnections[oldConnectionIndex] = connection;
			connection.parent = this;
			connection.groupId = this.id;
		} else {
			throw new Error(`Could not find connection with id ${oldConnectionId} in group ${this.name}`);
		}
	}

	public getParent(): ConnectionProfileGroup | undefined {
		return this.parent;
	}

	public isAncestorOf(node: ConnectionProfileGroup | ConnectionProfile): boolean {
		let isAncestor = false;
		let currentNode: ConnectionProfileGroup | ConnectionProfile | undefined = node;
		while (currentNode) {
			if (currentNode.parent && currentNode.parent.id === this.id) {
				isAncestor = true;
				break;
			}
			currentNode = currentNode.parent;
		}
		return isAncestor;
	}

	public static getGroupFullNameParts(groupFullName?: string): string[] {
		groupFullName = groupFullName ? groupFullName : '';
		let groupNames: string[] = groupFullName.split(ConnectionProfileGroup.GroupNameSeparator);
		groupNames = groupNames.filter(g => !!g);
		if (groupNames.length === 0) {
			groupNames.push('ROOT');
		} else if (groupNames[0].toUpperCase() !== 'ROOT') {
			groupNames.unshift('ROOT');
		}
		groupNames[0] = 'ROOT';
		return groupNames;
	}

	public static isRoot(name: string): boolean {
		return (!name || name.toUpperCase() === ConnectionProfileGroup.RootGroupName ||
			name === ConnectionProfileGroup.GroupNameSeparator);
	}

	public static sameGroupName(name1?: string, name2?: string): boolean {
		const isName1Undefined = isUndefinedOrNull(name1);
		const isName2Undefined = isUndefinedOrNull(name2);
		if (isName1Undefined && isName2Undefined) {
			return true;
		}
		if ((isName1Undefined && !isName2Undefined) || !isName1Undefined && isName2Undefined) {
			return false;
		}
		if (name1!.toUpperCase() === name2!.toUpperCase()) {
			return true;
		}
		return ConnectionProfileGroup.isRoot(name1!) && ConnectionProfileGroup.isRoot(name2!);
	}

	public static getConnectionsInGroup(group: ConnectionProfileGroup): ConnectionProfile[] {
		let connections: ConnectionProfile[] = [];
		if (group && group.connections) {
			group.connections.forEach((con) => connections.push(con));
		}
		if (group && group.children) {
			group.children.forEach((subgroup) => {
				connections = connections.concat(this.getConnectionsInGroup(subgroup));
			});
		}
		return connections;
	}

	public static getSubgroups(group: ConnectionProfileGroup): ConnectionProfileGroup[] {
		let subgroups: ConnectionProfileGroup[] = [];
		if (group && group.children) {
			group.children.forEach((grp) => subgroups.push(grp));
			group.children.forEach((subgroup) => {
				subgroups = subgroups.concat(this.getSubgroups(subgroup));
			});
		}
		return subgroups;
	}

	public static createConnectionProfileGroup(group: IConnectionProfileGroup, parentGroup: ConnectionProfileGroup | undefined): ConnectionProfileGroup {
		return new ConnectionProfileGroup(group.name, parentGroup, group.id, group.color, group.description);
	}
}
