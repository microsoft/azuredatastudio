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
import { Disposable } from 'vs/base/common/lifecycle';
import { onUnexpectedError } from 'vs/base/common/errors';
import { AsyncServerTree, ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';

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
	public static async structuralTreeUpdate(tree: AsyncServerTree | ITree, viewKey: 'recent' | 'active' | 'saved', connectionManagementService: IConnectionManagementService, providers?: string[]): Promise<void> {
		// convert to old VS Code tree interface with expandable methods
		let expandableTree: IExpandableTree = <IExpandableTree>tree;

		let selectedElement: any;
		let targetsToExpand: any[] = [];
		if (tree && !(tree instanceof AsyncServerTree)) {
			let selection = tree.getSelection();
			if (selection && selection.length === 1) {
				selectedElement = <any>selection[0];
			}
			targetsToExpand = expandableTree.getExpandedElements();
		}
		let groups;
		let treeInput: ConnectionProfileGroup | undefined = new ConnectionProfileGroup('root', undefined, undefined);
		if (viewKey === 'recent') {
			groups = connectionManagementService.getRecentConnections(providers);
			treeInput.addConnections(groups);
		} else if (viewKey === 'active') {
			groups = connectionManagementService.getActiveConnections(providers);
			treeInput.addConnections(groups);
		} else if (viewKey === 'saved') {
			treeInput = TreeUpdateUtils.getTreeInput(connectionManagementService, providers);
		}
		const previousTreeInput = tree.getInput();
		if (treeInput) {
			await tree.setInput(treeInput);
		}
		if (previousTreeInput instanceof Disposable) {
			previousTreeInput.dispose();
		}

		if (tree && !(tree instanceof AsyncServerTree)) {
			// Make sure to expand all folders that where expanded in the previous session
			if (targetsToExpand) {
				await tree.expandAll(targetsToExpand);
			}
			if (selectedElement) {
				tree.select(selectedElement);
			}
		}
	}

	/**
	 * Set input for the registered servers tree.
	 */
	public static async registeredServerUpdate(tree: ITree | AsyncServerTree, connectionManagementService: IConnectionManagementService, elementToSelect?: any): Promise<void> {
		if (tree instanceof AsyncServerTree) {
			const treeInput = TreeUpdateUtils.getTreeInput(connectionManagementService);
			if (treeInput) {
				await tree.setInput(treeInput);
			}
			tree.rerender();
		} else {
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
					}, onUnexpectedError);
				}
			}
		}
	}

	public static getTreeInput(connectionManagementService: IConnectionManagementService, providers?: string[]): ConnectionProfileGroup | undefined {
		const groups = connectionManagementService.getConnectionGroups(providers);
		const input = groups.find(group => group.isRoot);
		// Dispose of the unused groups to clean up their handlers
		groups.filter(g => g !== input).forEach(g => g.dispose());
		return input;
	}

	public static hasObjectExplorerNode(connection: ConnectionProfile, connectionManagementService: IConnectionManagementService): boolean {
		let isConnected = connectionManagementService.isConnected(undefined, connection);
		return isConnected;
	}

	public static async connectIfNotConnected(
		connection: ConnectionProfile,
		options: IConnectionCompletionOptions,
		connectionManagementService: IConnectionManagementService,
		tree: AsyncServerTree | ITree | undefined): Promise<ConnectionProfile | undefined> {
		if (!connectionManagementService.isProfileConnected(connection)) {
			// don't try to reconnect if currently connecting
			if (connectionManagementService.isProfileConnecting(connection)) {
				return undefined;

				// else if we aren't connected or connecting then try to connect
			} else {
				let callbacks: IConnectionCallbacks | undefined;
				if (tree instanceof AsyncServerTree) {
					callbacks = {
						onConnectStart: () => { },
						onConnectReject: () => { },
						onConnectSuccess: () => { },
						onDisconnect: () => { },
						onConnectCanceled: () => { },
					};
				} else if (tree) {
					// Show the spinner in OE by adding the 'loading' trait to the connection, and set up callbacks to hide the spinner
					tree.addTraits('loading', [connection]);
					let rejectOrCancelCallback = () => {
						tree.collapse(connection);
						tree.removeTraits('loading', [connection]);
					};
					callbacks = {
						onConnectStart: () => { },
						onConnectReject: rejectOrCancelCallback,
						onConnectSuccess: () => tree.removeTraits('loading', [connection]),
						onDisconnect: () => { },
						onConnectCanceled: rejectOrCancelCallback,
					};
				}

				const result = await connectionManagementService.connect(connection, undefined, options, callbacks);
				if (result.connected) {
					let existingConnection = connectionManagementService.findExistingConnection(connection);
					return existingConnection;
				} else {
					throw new Error(result.errorMessage);
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
	public static async connectAndCreateOeSession(connection: ConnectionProfile, options: IConnectionCompletionOptions,
		connectionManagementService: IConnectionManagementService, objectExplorerService: IObjectExplorerService, tree: AsyncServerTree | ITree | undefined): Promise<boolean> {
		const connectedConnection = await TreeUpdateUtils.connectIfNotConnected(connection, options, connectionManagementService, tree);
		if (connectedConnection) {
			// append group ID and original display name to build unique OE session ID
			connectedConnection.options['groupId'] = connection.groupId;
			connectedConnection.options['databaseDisplayName'] = connection.databaseName;

			let rootNode: TreeNode | undefined = objectExplorerService.getObjectExplorerNode(connectedConnection);
			if (!rootNode) {
				await objectExplorerService.updateObjectExplorerNodes(connectedConnection);
				return true;
				// The oe request is sent. an event will be raised when the session is created
			} else {
				return false;
			}
		} else {
			return false;
		}
	}

	public static async getConnectionNodeChildren(connection: ConnectionProfile, objectExplorerService: IObjectExplorerService): Promise<TreeNode[]> {
		if (connection.isDisconnecting) {
			return [];
		} else {
			let rootNode = objectExplorerService.getObjectExplorerNode(connection);
			const session = rootNode?.getSession();
			if (rootNode && session) {
				try {
					await objectExplorerService.resolveTreeNodeChildren(session, rootNode);
					return rootNode.children ?? [];
				} catch (err) {
					onUnexpectedError(err);
					return [];
				}

			} else {
				return [];
			}
		}
	}

	public static async getAsyncConnectionNodeChildren(connection: ConnectionProfile, connectionManagementService: IConnectionManagementService, objectExplorerService: IObjectExplorerService): Promise<TreeNode[]> {
		if (connection.isDisconnecting) {
			return [];
		} else {
			let rootNode = objectExplorerService.getObjectExplorerNode(connection);
			const session = rootNode?.getSession();
			if (rootNode && session) {
				await objectExplorerService.resolveTreeNodeChildren(session, rootNode);
				return rootNode.children ?? [];
			} else {
				const options: IConnectionCompletionOptions = {
					params: undefined,
					saveTheConnection: true,
					showConnectionDialogOnError: true,
					showFirewallRuleOnError: true,
					showDashboard: false
				};
				// Need to wait for the OE service to update its nodes in order to resolve the children
				const nodesUpdatedPromise = new Promise((resolve, reject) => {
					objectExplorerService.onUpdateObjectExplorerNodes(e => {
						if (e.errorMessage) {
							reject(new Error(e.errorMessage));
						}
						if (e.connection.id === connection.id) {
							resolve();
						}
					});
				});
				await TreeUpdateUtils.connectAndCreateOeSession(connection, options, connectionManagementService, objectExplorerService, undefined);
				await nodesUpdatedPromise;
				let rootNode = objectExplorerService.getObjectExplorerNode(connection); // Major code change
				const session = rootNode?.getSession();
				if (rootNode && session) {
					await objectExplorerService.resolveTreeNodeChildren(session, rootNode);
				}
				return rootNode?.children ?? [];
			}
		}
	}

	public static getObjectExplorerParent(objectExplorerNode: TreeNode, connectionManagementService: IConnectionManagementService): ServerTreeElement | undefined {
		if (objectExplorerNode && objectExplorerNode.parent) {
			// if object explorer node's parent is root, return connection profile
			if (!objectExplorerNode.parent.parent) {
				const connectionId = objectExplorerNode.getConnectionProfile()?.id;
				// get connection profile from connection profile groups
				const root = TreeUpdateUtils.getTreeInput(connectionManagementService);
				if (root) {
					return ConnectionProfileGroup.getConnectionsInGroup(root).find(conn => connectionId === conn.id);
				}
			} else {
				return objectExplorerNode.parent;
			}
		}
		return undefined;
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
	public static getConnectionProfile(treeNode: TreeNode): ConnectionProfile | undefined {
		let connectionProfile = treeNode.getConnectionProfile();
		let databaseName = treeNode.getDatabaseName();
		if (databaseName !== undefined && connectionProfile?.databaseName !== databaseName) {
			connectionProfile = connectionProfile?.cloneWithDatabase(databaseName);
		}
		return connectionProfile;
	}
}
