/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';

/**
 * Helper stub class for mocking ExtHostObjectExplorerNode
 */
export class ExtHostObjectExplorerNodeStub implements azdata.objectexplorer.ObjectExplorerNode {
	// Stub properties
	private parent: azdata.objectexplorer.ObjectExplorerNode;

	// Base properties
	public connectionId: string;
	public nodePath: string;
	public nodeType: string;
	public nodeSubType: string;
	public nodeStatus: string;
	public label: string;
	public isLeaf: boolean;
	public metadata: azdata.ObjectMetadata;
	public errorMessage: string;

	constructor(nodeName: string, nodeSchema: string, nodeType: string, parent: azdata.objectexplorer.ObjectExplorerNode) {
		this.parent = parent;
		this.nodeType = nodeType;
		this.metadata = { metadataType: undefined, metadataTypeName: undefined, name: nodeName, schema: nodeSchema, urn: undefined };
	}

	isExpanded(): Thenable<boolean> {
		throw new Error('Method not implemented');
	}

	setExpandedState(expandedState: vscode.TreeItemCollapsibleState): Thenable<void> {
		throw new Error('Method not implemented');
	}

	setSelected(selected: boolean, clearOtherSelections: boolean = undefined): Thenable<void> {
		throw new Error('Method not implemented');
	}

	getChildren(): Thenable<azdata.objectexplorer.ObjectExplorerNode[]> {
		throw new Error('Method not implemented');
	}

	getParent(): Thenable<azdata.objectexplorer.ObjectExplorerNode> {
		return Promise.resolve(this.parent);
	}

	refresh(): Thenable<void> {
		throw new Error('Method not implemented');
	}

	/**
	 *
	 * @param nodeName Helperfunction to create a node that is a child of this one
	 * @param nodeSchema The schema to give the child node
	 * @param nodeType The type of node this should be
	 */
	createChild(nodeName: string, nodeSchema: string, nodeType: string): ExtHostObjectExplorerNodeStub {
		return new ExtHostObjectExplorerNodeStub(nodeName, nodeSchema, nodeType, this);
	}
}
