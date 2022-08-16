/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { NodeType, SqlThemeIcon } from 'sql/workbench/services/objectExplorer/common/nodeType';
import * as azdata from 'azdata';

import * as UUID from 'vs/base/common/uuid';
import { IconPath } from 'sql/workbench/api/common/sqlExtHostTypes';

export enum TreeItemCollapsibleState {
	None = 0,
	Collapsed = 1,
	Expanded = 2
}

export interface ObjectExplorerCallbacks {
	getChildren(treeNode?: TreeNode): Promise<TreeNode[]>;
	isExpanded(treeNode: TreeNode): Thenable<boolean>;
	setNodeExpandedState(TreeNode: TreeNode, expandedState: TreeItemCollapsibleState): Thenable<void>;
	setNodeSelected(TreeNode: TreeNode, selected: boolean, clearOtherSelections?: boolean): Thenable<void>;
}

export class TreeNode {
	/**
	 * Informs who provides the children to a node, used by data explorer tree view api
	 */
	public childProvider?: string;
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
	 * The object type.
	 */
	public objectType: string;

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
	public errorStateMessage?: string;

	/**
	 * Parent of this node
	 */
	public parent?: TreeNode;

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
	public nodeStatus?: string;

	/**
	 * Children of this node
	 */
	public children?: TreeNode[];


	public connection?: ConnectionProfile;

	public session?: azdata.ObjectExplorerSession;

	public metadata?: azdata.ObjectMetadata;

	public iconType?: string | SqlThemeIcon;

	public icon?: IconPath | SqlThemeIcon;

	constructor(nodeTypeId: string, objectType: string, label: string, isAlwaysLeaf: boolean, nodePath: string,
		nodeSubType: string, nodeStatus?: string, parent?: TreeNode, metadata?: azdata.ObjectMetadata,
		iconType?: string | SqlThemeIcon,
		icon?: IconPath | SqlThemeIcon,
		private _objectExplorerCallbacks?: ObjectExplorerCallbacks) {
		this.nodeTypeId = nodeTypeId;
		this.objectType = objectType;
		this.label = label;
		this.isAlwaysLeaf = isAlwaysLeaf;
		this.nodePath = nodePath;
		this.parent = parent;
		this.metadata = metadata;
		this.iconType = iconType;
		this.id = UUID.generateUuid();
		this.nodeSubType = nodeSubType;
		this.nodeStatus = nodeStatus;
		this.icon = icon;
	}
	public getConnectionProfile(): ConnectionProfile | undefined {
		let currentNode: TreeNode = this;
		while (!currentNode.connection && currentNode.parent) {
			currentNode = currentNode.parent;
		}
		return currentNode.connection;
	}

	public getDatabaseName(): string | undefined {
		if (this.connection) {
			return undefined;
		}
		let currentNode: TreeNode = this;
		while (currentNode.nodeTypeId !== NodeType.Database && currentNode.nodeTypeId !== NodeType.Server && currentNode.parent) {
			currentNode = currentNode.parent;
		}

		if (currentNode && currentNode.nodeTypeId === NodeType.Database) {
			return currentNode?.metadata?.name;
		}
		return undefined;
	}

	public getSession(): azdata.ObjectExplorerSession | undefined {
		let currentNode: TreeNode = this;
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

	public toNodeInfo(): azdata.NodeInfo {
		return <azdata.NodeInfo>{
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

	public getChildren(): Promise<TreeNode[]> {
		return this._objectExplorerCallbacks?.getChildren(this) ?? Promise.resolve([]);
	}

	public isExpanded(): Thenable<boolean> {
		return this._objectExplorerCallbacks?.isExpanded(this) ?? Promise.resolve(false);
	}

	public setExpandedState(expandedState: TreeItemCollapsibleState): Thenable<void | undefined> {
		return this._objectExplorerCallbacks?.setNodeExpandedState(this, expandedState) ?? Promise.resolve();
	}

	public setSelected(selected: boolean, clearOtherSelections?: boolean): Thenable<void | undefined> {
		return this._objectExplorerCallbacks?.setNodeSelected(this, selected, clearOtherSelections) ?? Promise.resolve();
	}
}
