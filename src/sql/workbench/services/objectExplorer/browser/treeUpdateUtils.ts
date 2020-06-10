/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionProfileGroup } from 'sql/platform/connection/common/connectionProfileGroup';
import { IConnectionManagementService, IConnectionCompletionOptions, IConnectionCallbacks } from 'sql/platform/connection/common/connectionManagement';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';

import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import * as errors from 'vs/base/common/errors';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Disposable } from 'vs/base/common/lifecycle';

export interface IExpandableTree extends ITree {
	/**
	 * Returns a list of the currently expanded elements.
	 */
	getExpandedElements(): any[];

	/**
	 * Returns a number between 0 and 1 representing how much the tree is scroll down. 0 means all the way
	 * to the top; 1 means all the way down.
	 */
	getScrollPosition(): number;

	/**
	 * Sets the scroll position with a number between 0 and 1 representing how much the tree is scroll down. 0 means all the way
	 * to the top; 1 means all the way down.
	 */
	setScrollPosition(pos: number): void;

	/**
	 * Returns the total height of the tree's content.
	 */
	getContentHeight(): number;
}


export class TreeUpdateUtils {

	public static isInDragAndDrop: boolean = false;

	/**
	 * Set input for the tree.
	 */
	public static structuralTreeUpdate(tree: ITree, viewKey: string, connectionManagementService: IConnectionManagementService, providers?: string[]): Promise<void> {
		// convert to old VS Code tree interface with expandable methods
		let expandableTree: IExpandableTree = <IExpandableTree>tree;

		let selectedElement: any;
		let targetsToExpand: any[];
		if (tree) {
			let selection = tree.getSelection();
			if (selection && selection.length === 1) {
				selectedElement = <any>selection[0];
			}
			targetsToExpand = expandableTree.getExpandedElements();
		}
		let groups;
		let treeInput = new ConnectionProfileGroup('root', null, undefined, undefined, undefined);
		if (viewKey === 'recent') {
			groups = connectionManagementService.getRecentConnections(providers);
			treeInput.addConnections(groups);
		} else if (viewKey === 'active') {
			groups = connectionManagementService.getActiveConnections(providers);
			treeInput.addConnections(groups);
		} else if (viewKey === 'saved') {
			treeInput = TreeUpdateUtils.getTreeInput(connectionManagementService, providers);
		}
		const previousTreeInput: any = tree.getInput();
		return tree.setInput(treeInput).then(async () => {
			if (previousTreeInput instanceof Disposable) {
				previousTreeInput.dispose();
			}
			// Make sure to expand all folders that where expanded in the previous session
			if (targetsToExpand) {
				await tree.expandAll(targetsToExpand);
			}
			if (selectedElement) {
				tree.select(selectedElement);
			}
			tree.getFocus();
		});
	}

	/**
	 * Set input for the registered servers tree.
	 */
	public static registeredServerUpdate(tree: ITree, connectionManagementService: IConnectionManagementService, elementToSelect?: any): Promise<void> {
		// convert to old VS Code tree interface with expandable methods
		let expandableTree: IExpandableTree = <IExpandableTree>tree;

		let selectedElement: any = elementToSelect;
		let targetsToExpand: any[];

		// Focus
		tree.domFocus();

		if (tree) {
			let selection = tree.getSelection();
			if (!selectedElement) {
				if (selection && selection.length === 1) {
					selectedElement = <any>selection[0];
				}
			}
			targetsToExpand = expandableTree.getExpandedElements();
			if (selectedElement && targetsToExpand.indexOf(selectedElement) === -1) {
				targetsToExpand.push(selectedElement);
			}
		}

		let treeInput = TreeUpdateUtils.getTreeInput(connectionManagementService);
		if (treeInput) {
			if (treeInput !== tree.getInput()) {
				return tree.setInput(treeInput).then(async () => {
					// Make sure to expand all folders that where expanded in the previous session
					if (targetsToExpand) {
						await tree.expandAll(targetsToExpand);
					}
					if (selectedElement) {
						tree.select(selectedElement);
					}
					tree.getFocus();
				}, errors.onUnexpectedError);
			}
		}
		return Promise.resolve();
	}

	public static getTreeInput(connectionManagementService: IConnectionManagementService, providers?: string[]): ConnectionProfileGroup {

		let groups = connectionManagementService.getConnectionGroups(providers);
		if (groups && groups.length > 0) {
			let treeInput = groups[0];
			treeInput.name = 'root';
			groups.forEach(cpg => cpg.dispose());
			return treeInput;
		}
		// Should never get to this case.
		return undefined;
	}

	public static hasObjectExplorerNode(connection: ConnectionProfile, connectionManagementService: IConnectionManagementService): boolean {
		let isConnected = connectionManagementService.isConnected(undefined, connection);
		return isConnected;
	}

	public static async connectIfNotConnected(
		connection: IConnectionProfile,
		options: IConnectionCompletionOptions,
		connectionManagementService: IConnectionManagementService,
		tree: ITree): Promise<ConnectionProfile | undefined> {
		if (!connectionManagementService.isProfileConnected(connection)) {
			// don't try to reconnect if currently connecting
			if (connectionManagementService.isProfileConnecting(connection)) {
				return undefined;

				// else if we aren't connected or connecting then try to connect
			} else {
				let callbacks: IConnectionCallbacks = undefined;
				if (tree) {
					// Show the spinner in OE by adding the 'loading' trait to the connection, and set up callbacks to hide the spinner
					tree.addTraits('loading', [connection]);
					let rejectOrCancelCallback = () => {
						tree.collapse(connection);
						tree.removeTraits('loading', [connection]);
					};
					callbacks = {
						onConnectStart: undefined,
						onConnectReject: rejectOrCancelCallback,
						onConnectSuccess: () => tree.removeTraits('loading', [connection]),
						onDisconnect: undefined,
						onConnectCanceled: rejectOrCancelCallback,
					};
				}
				const result = await connectionManagementService.connect(connection, undefined, options, callbacks);
				if (result.connected) {
					let existingConnection = connectionManagementService.findExistingConnection(connection);
					return existingConnection;
				} else {
					throw new Error('connection failed');
				}
			}
		} else {
			let existingConnection = connectionManagementService.findExistingConnection(connection);
			if (options && options.showDashboard) {
				await connectionManagementService.showDashboard(connection);
			}
			return existingConnection;
		}
	}

	/**
	 * Makes a connection if the not already connected and try to create new object explorer session
	 * I the profile is already connected, tries to do the action requested in the options (e.g. open dashboard)
	 * Returns true if new object explorer session created for the connection, otherwise returns false
	 * @param connection Connection  Profile
	 * @param options Includes the actions to happened after connection is made
	 * @param connectionManagementService Connection management service instance
	 * @param objectExplorerService Object explorer service instance
	 */
	public static async connectAndCreateOeSession(connection: IConnectionProfile, options: IConnectionCompletionOptions,
		connectionManagementService: IConnectionManagementService, objectExplorerService: IObjectExplorerService, tree: ITree): Promise<boolean> {
		const connectedConnection = await TreeUpdateUtils.connectIfNotConnected(connection, options, connectionManagementService, tree);
		if (connectedConnection) {
			// append group ID and original display name to build unique OE session ID
			connectedConnection.options['groupId'] = connection.groupId;
			connectedConnection.options['databaseDisplayName'] = connection.databaseName;

			let rootNode: TreeNode = objectExplorerService.getObjectExplorerNode(connectedConnection);
			if (!rootNode) {
				await objectExplorerService.updateObjectExplorerNodes(connectedConnection);
				rootNode = objectExplorerService.getObjectExplorerNode(connectedConnection);
				return true;
				// The oe request is sent. an event will be raised when the session is created
			} else {
				return false;
			}
		} else {
			return false;
		}
	}

	public static getObjectExplorerNode(connection: ConnectionProfile, connectionManagementService: IConnectionManagementService, objectExplorerService: IObjectExplorerService): Promise<TreeNode[]> {
		return new Promise<TreeNode[]>((resolve, reject) => {
			if (connection.isDisconnecting) {
				resolve([]);
			} else {
				let rootNode = objectExplorerService.getObjectExplorerNode(connection);
				if (rootNode) {
					objectExplorerService.resolveTreeNodeChildren(rootNode.getSession(), rootNode).then(() => {
						resolve(rootNode.children);
					}, expandError => {
						resolve([]);
					});

				} else {
					resolve([]);
				}
			}
		});
	}

	public static getObjectExplorerParent(objectExplorerNode: TreeNode, connectionManagementService: IConnectionManagementService): any {
		if (objectExplorerNode && objectExplorerNode.parent) {
			// if object explorer node's parent is root, return connection profile
			if (!objectExplorerNode.parent.parent) {
				let connectionId = objectExplorerNode.getConnectionProfile().id;

				// get connection profile from connection profile groups
				let root = TreeUpdateUtils.getTreeInput(connectionManagementService);
				let connections = ConnectionProfileGroup.getConnectionsInGroup(root);
				let results = connections.filter(con => {
					if (connectionId === con.id) {
						return true;
					} else {
						return false;
					}
				});
				if (results && results.length > 0) {
					return results[0];
				}
			} else {
				return objectExplorerNode.parent;
			}
		}
		return null;
	}

	/**
	 *
	 * @param treeNode Returns true if the tree node is a database node
	 */
	public static isDatabaseNode(treeNode: TreeNode): boolean {
		return treeNode && treeNode.nodeTypeId === NodeType.Database;
	}

	/**
	 *
	 * @param treeNode Returns true if the tree node is an available database node
	 */
	public static isAvailableDatabaseNode(treeNode: TreeNode): boolean {
		return treeNode && treeNode.nodeTypeId === NodeType.Database && treeNode.nodeStatus !== 'Unavailable';
	}

	/**
	 * Get connection profile with the current database
	 */
	public static getConnectionProfile(treeNode: TreeNode): ConnectionProfile {
		let connectionProfile = treeNode.getConnectionProfile();
		let databaseName = treeNode.getDatabaseName();
		if (databaseName !== undefined && connectionProfile.databaseName !== databaseName) {
			connectionProfile = connectionProfile.cloneWithDatabase(databaseName);
		}
		return connectionProfile;
	}
}
