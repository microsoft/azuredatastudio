/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { Disposable } from 'vs/base/common/lifecycle';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { assign } from 'vs/base/common/objects';
import { find } from 'vs/base/common/arrays';

export interface IConnectionProfileGroup {
	id: string;
	parentId?: string;
	name: string;
	color?: string;
	description?: string;
}

export class ConnectionProfileGroup extends Disposable implements IConnectionProfileGroup {

	private _childGroups: ConnectionProfileGroup[] = [];
	private _childConnections: ConnectionProfile[] = [];
	public parentId?: string;
	private _isRenamed = false;
	public constructor(
		public name: string,
		public parent: ConnectionProfileGroup | undefined,
		public id: string,
		public color?: string,
		public description?: string
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
		if (this._childGroups.length > 0) {
			subgroups = [];
			this._childGroups.forEach((group) => {
				subgroups.push(group.toObject());
			});
		}

		return assign({}, { name: this.name, id: this.id, parentId: this.parentId, children: subgroups, color: this.color, description: this.description });
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
		let invalidConnections = find(this._childConnections, c => !c.isConnectionOptionsValid);
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
			this._register(conn);
			this._childConnections.push(conn);
		});

	}

	public addGroups(groups: ConnectionProfileGroup[] | undefined): void {
		groups?.forEach((group) => {
			this._childGroups = this._childGroups.filter((grp) => { return group.id !== grp.id; });
			group.parent = this;
			this._register(group);
			this._childGroups.push(group);
		});
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
}
