/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { NodeType, SqlThemeIcon } from 'sql/parts/objectExplorer/common/nodeType';
import * as sqlops from 'sqlops';

import * as UUID from 'vs/base/common/uuid';

export enum TreeItemCollapsibleState {
	None = 0,
	Collapsed = 1,
	Expanded = 2
}

export interface ObjectExplorerCallbacks {
	getChildren(treeNode: TreeNode): Thenable<TreeNode[]>;
	isExpanded(treeNode: TreeNode): Thenable<boolean>;
	setNodeExpandedState(TreeNode: TreeNode, expandedState: TreeItemCollapsibleState): Thenable<void>;
	setNodeSelected(TreeNode: TreeNode, selected: boolean, clearOtherSelections?: boolean): Thenable<void>;
}

export class TreeNode {
	/**
	 * Informs who provides the children to a node, used by data explorer tree view api
	 */
	public childProvider: string;
	/**
	 * Holds the connection profile for nodes, used by data explorer tree view api
	 */
	public payload: any;
	/**
	 * id for TreeNode
	 */
	public id: string;

	/**
	 * string defining the type of the node - for example Server, Database, Folder, Table
	 */
	public nodeTypeId: string;

	/**
	 * Label to display to the user, describing this node
	 */
	public label: string;

	/**
	 * Is this a leaf node (in which case no children can be generated) or is it expandable?
	 */
	public isAlwaysLeaf: boolean;

	/**
	 * Message to show if this Node is in an error state. This indicates
	 * that children could be retrieved
	 */
	public errorStateMessage: string;

	/**
	 * Parent of this node
	 */
	public parent: TreeNode;

	/**
	 * Path identifying this node
	 */
	public nodePath: string;

	/**
	 * Node sub type
	 */
	public nodeSubType: string;

	/**
	 * Node Status
	 */
	public nodeStatus: string;

	/**
	 * Children of this node
	 */
	public children: TreeNode[];


	public connection: ConnectionProfile;

	public session: sqlops.ObjectExplorerSession;

	public metadata: sqlops.ObjectMetadata;

	public iconType: string | SqlThemeIcon;

	constructor(nodeTypeId: string, label: string, isAlwaysLeaf: boolean, nodePath: string,
		nodeSubType: string, nodeStatus: string, parent: TreeNode, metadata: sqlops.ObjectMetadata,
		iconType: string | SqlThemeIcon,
		private _objectExplorerCallbacks: ObjectExplorerCallbacks) {
		this.nodeTypeId = nodeTypeId;
		this.label = label;
		this.isAlwaysLeaf = isAlwaysLeaf;
		this.nodePath = nodePath;
		this.parent = parent;
		this.metadata = metadata;
		this.iconType = iconType;
		this.id = UUID.generateUuid();
		this.nodeSubType = nodeSubType;
		this.nodeStatus = nodeStatus;
	}
	public getConnectionProfile(): ConnectionProfile {
		var currentNode: TreeNode = this;
		while (!currentNode.connection && currentNode.parent) {
			currentNode = currentNode.parent;
		}
		return currentNode.connection;
	}

	public getDatabaseName(): string {
		if (this.connection) {
			return undefined;
		}
		var currentNode: TreeNode = this;
		while (currentNode.nodeTypeId !== NodeType.Database && currentNode.nodeTypeId !== NodeType.Server && currentNode.parent) {
			currentNode = currentNode.parent;
		}

		if (currentNode && currentNode.nodeTypeId === NodeType.Database) {
			return currentNode.metadata ? currentNode.metadata.name : null;
		}
		return undefined;
	}

	public getSession(): sqlops.ObjectExplorerSession {
		var currentNode: TreeNode = this;
		while (!currentNode.session && currentNode.parent) {
			currentNode = currentNode.parent;
		}
		return currentNode.session;
	}

	public isTopLevel(): boolean {
		if (this.parent && this.parent.nodeTypeId === NodeType.Root) {
			return true;
		}
		return false;
	}

	public toNodeInfo(): sqlops.NodeInfo {
		return <sqlops.NodeInfo>{
			nodePath: this.nodePath,
			nodeType: this.nodeTypeId,
			nodeSubType: this.nodeSubType,
			nodeStatus: this.nodeStatus,
			label: this.label,
			isLeaf: this.isAlwaysLeaf,
			metadata: this.metadata,
			errorMessage: this.errorStateMessage
		};
	}

	public getChildren(): Thenable<TreeNode[]> {
		return this._objectExplorerCallbacks.getChildren(this);
	}

	public isExpanded(): Thenable<boolean> {
		return this._objectExplorerCallbacks.isExpanded(this);
	}

	public setExpandedState(expandedState: TreeItemCollapsibleState): Thenable<void> {
		return this._objectExplorerCallbacks.setNodeExpandedState(this, expandedState);
	}

	public setSelected(selected: boolean, clearOtherSelections?: boolean): Thenable<void> {
		return this._objectExplorerCallbacks.setNodeSelected(this, selected, clearOtherSelections);
	}
}