/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { Disposable } from 'vs/base/common/lifecycle';

export interface IConnectionProfileGroup {
	id: string;
	parentId?: string;
	name: string;
	color: string;
	description: string;
}

export class ConnectionProfileGroup extends Disposable implements IConnectionProfileGroup {

	public children: ConnectionProfileGroup[];
	public connections: ConnectionProfile[];
	public parentId?: string;
	private _isRenamed: boolean;
	public constructor(
		public name: string,
		public parent: ConnectionProfileGroup,
		public id: string,
		public color: string,
		public description: string
	) {
		super();
		this.parentId = parent ? parent.id : undefined;
		if (this.name === ConnectionProfileGroup.RootGroupName) {
			this.name = '';
		}
	}

	public static GroupNameSeparator: string = '/';
	public static RootGroupName: string = 'ROOT';

	public toObject(): IConnectionProfileGroup {
		let subgroups = undefined;
		if (this.children) {
			subgroups = [];
			this.children.forEach((group) => {
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

	public hasChildren(): boolean {
		if ((this.children && this.children.length > 0) || (this.connections && this.connections.length > 0)) {
			return true;
		}
		return false;
	}

	/**
	 * Returns true if all connections in the tree have valid options using the correct capabilities
	 */
	public get hasValidConnections(): boolean {
		if (this.connections) {
			let invalidConnections = this.connections.find(c => !c.isConnectionOptionsValid);
			if (invalidConnections !== undefined) {
				return false;
			} else {
				let childrenAreValid: boolean = true;
				this.children.forEach(element => {
					let isChildValid = element.hasValidConnections;
					if (!isChildValid) {
						childrenAreValid = false;
					}
				});
				return childrenAreValid;
			}
		} else {
			return true;
		}
	}

	public getChildren(): (ConnectionProfile | ConnectionProfileGroup)[] {
		let allChildren: (ConnectionProfile | ConnectionProfileGroup)[] = [];
		if (this.connections) {
			this.connections.forEach((conn) => {
				allChildren.push(conn);
			});
		}

		if (this.children) {
			this.children.forEach((group) => {
				allChildren.push(group);
			});
		}
		return allChildren;
	}

	public equals(other: any): boolean {
		if (!(other instanceof ConnectionProfileGroup)) {
			return false;
		}
		return other.id === this.id;
	}

	public addConnections(connections: ConnectionProfile[]): void {
		if (!this.connections) {
			this.connections = [];
		}
		connections.forEach((conn) => {
			this.connections = this.connections.filter((curConn) => { return curConn.id !== conn.id; });
			conn.parent = this;
			this._register(conn);
			this.connections.push(conn);
		});

	}

	public addGroups(groups: ConnectionProfileGroup[]): void {
		if (!this.children) {
			this.children = [];
		}
		groups.forEach((group) => {
			this.children = this.children.filter((grp) => { return group.id !== grp.id; });
			group.parent = this;
			this._register(group);
			this.children.push(group);
		});
	}

	public getParent(): ConnectionProfileGroup {
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

	public static getGroupFullNameParts(groupFullName: string): string[] {
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

	public static sameGroupName(name1: string, name2: string): boolean {
		let sameGroupName: boolean =
			(!name1 && !name2) ||
			name1.toUpperCase() === name2.toUpperCase() ||
			(ConnectionProfileGroup.isRoot(name1) && ConnectionProfileGroup.isRoot(name2));

		return sameGroupName;
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
}
