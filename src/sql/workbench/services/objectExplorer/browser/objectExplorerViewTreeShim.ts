/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import { TreeNode } from 'sql/workbench/services/objectExplorer/common/treeNode';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ITreeItem } from 'sql/workbench/common/views';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/browser/objectExplorerService';
import { hash } from 'vs/base/common/hash';
import { Disposable } from 'vs/base/common/lifecycle';
import { generateUuid } from 'vs/base/common/uuid';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';  //TODO: Needed?
import { TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { localize } from 'vs/nls';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { UserCancelledConnectionError } from 'sql/base/common/errors';

export const SERVICE_ID = 'oeShimService';
export const IOEShimService = createDecorator<IOEShimService>(SERVICE_ID);

export interface IOEShimService {
	_serviceBrand: undefined;
	getChildren(node: ITreeItem, viewId: string): Promise<ITreeItem[]>;
	disconnectNode(node: ITreeItem): Promise<boolean>;
	providerExists(providerId: string): boolean;
	isNodeConnected(viewId: string, node: ITreeItem): boolean;
	getNodeInfoForTreeItem(treeItem: ITreeItem): azdata.NodeInfo | undefined;
}

export class OEShimService extends Disposable implements IOEShimService {
	_serviceBrand: undefined;

	private nodeHandleMap = new Map<number, string>();
	private nodeInfoMap = new Map<ITreeItem, azdata.NodeInfo>();

	constructor(
		@IObjectExplorerService private oe: IObjectExplorerService,
		@IConnectionManagementService private cm: IConnectionManagementService,
		@ICapabilitiesService private capabilities: ICapabilitiesService,
	) {
		super();
	}

	private async createSession(viewId: string, providerId: string, node: ITreeItem): Promise<string> {
		let payload = await this.cm.fixProfile(node.payload);
		let connProfile = new ConnectionProfile(this.capabilities, payload);
		connProfile.saveProfile = false;
		if (this.cm.providerRegistered(providerId)) {
			connProfile = await this.connectOrPrompt(connProfile);
		} else {
			// Throw and expect upstream handler to notify about the error
			// TODO: In the future should use extension recommendations to prompt for correct extension
			throw new Error(localize('noProviderFound', "Cannot expand as the required connection provider '{0}' was not found", providerId));
		}
		let sessionResp = await this.oe.createNewSession(providerId, connProfile);
		let sessionId = sessionResp.sessionId;
		await new Promise((resolve, reject) => {
			let listener = this.oe.onUpdateObjectExplorerNodes(e => {
				if (e.connection.id === connProfile.id) {
					if (e.errorMessage) {
						listener.dispose();
						reject(new Error(e.errorMessage));
						return;
					}
					let session = this.oe.getSession(sessionResp.sessionId);
					if (!session) {
						reject(new Error(`Could not have session for ${sessionResp.sessionId}`));
						return;
					}
					// this is how we know it was shimmed
					if (session.rootNode.nodePath) {
						this.nodeHandleMap.set(generateNodeMapKey(viewId, node), session.rootNode.nodePath);
					}
				}
				listener.dispose();
				resolve(sessionResp.sessionId);
			});
		});
		return sessionId;
	}

	private async connectOrPrompt(connProfile: ConnectionProfile): Promise<ConnectionProfile> {
		connProfile = await new Promise(async (resolve, reject) => {
			let result = await this.cm.connect(connProfile, undefined, { showConnectionDialogOnError: true, showFirewallRuleOnError: true, saveTheConnection: false, showDashboard: false }, {
				onConnectSuccess: async (e, profile) => {
					let existingConnection = this.cm.findExistingConnection(profile);
					connProfile = new ConnectionProfile(this.capabilities, existingConnection);
					connProfile = <ConnectionProfile>await this.cm.addSavedPassword(connProfile);
					resolve(connProfile);
				},
				onConnectCanceled: () => {
					reject(new UserCancelledConnectionError(localize('loginCanceled', "User canceled")));
				},
				onConnectReject: () => { },
				onConnectStart: () => { },
				onDisconnect: () => { }
			});
			// connection cancelled from firewall dialog
			if (!result) {
				reject(new UserCancelledConnectionError(localize('firewallCanceled', "Firewall dialog canceled")));
			}
		});
		return connProfile;
	}

	public async disconnectNode(node: ITreeItem): Promise<boolean> {
		if (node.sessionId !== undefined) {
			const closed = (await this.oe.closeSession(node.childProvider!, this.oe.getSession(node.sessionId)!))!.success;
			return closed;
		}
		return false;
	}

	public async getChildren(node: ITreeItem, viewId: string): Promise<ITreeItem[]> {
		if (node.payload) {
			node.payload = await this.cm.fixProfile(node.payload);

			if (node.sessionId === undefined) {
				node.sessionId = await this.createSession(viewId, node.childProvider!, node);
			}
			const requestHandle = this.nodeHandleMap.get(generateNodeMapKey(viewId, node)) || node.handle;
			const treeNode = new TreeNode(undefined!, undefined!, undefined!, undefined!, requestHandle, undefined!, undefined!); // hack since this entire system is a hack anyways
			treeNode.connection = new ConnectionProfile(this.capabilities, node.payload);
			const childrenNodes = await this.oe.refreshTreeNode({
				success: true,
				sessionId: node.sessionId!,
				rootNode: undefined!, // hack since this entire system is a hack anyways
				errorMessage: undefined
			}, treeNode);
			return childrenNodes.map(n => this.treeNodeToITreeItem(viewId, n, node));
		}
		return [];
	}

	private treeNodeToITreeItem(viewId: string, node: TreeNode, parentNode: ITreeItem): ITreeItem {
		let handle = generateUuid();
		let icon: string = '';
		let nodePath = node.nodePath;
		if (node.iconType) {
			icon = (typeof node.iconType === 'string') ? node.iconType : node.iconType.id;
		} else {
			icon = node.nodeTypeId;
			if (node.nodeStatus) {
				icon = node.nodeTypeId + '_' + node.nodeStatus;
			}
			if (node.nodeSubType) {
				icon = node.nodeTypeId + '_' + node.nodeSubType;
			}
		}
		icon = icon.toLowerCase();
		// Change the database if the node has a different database
		// than its parent
		let databaseChanged = false;
		let updatedPayload: azdata.IConnectionProfile | any = {};
		if (node.nodeTypeId === NodeType.Database) {
			const database = node.getDatabaseName();
			if (database) {
				databaseChanged = true;
				updatedPayload = Object.assign(updatedPayload, parentNode.payload);
				updatedPayload.databaseName = node.getDatabaseName();
			}
		}
		const nodeInfo: azdata.NodeInfo = {
			nodePath: nodePath,
			parentNodePath: node.parentNodePath,
			nodeType: node.nodeTypeId,
			objectType: node.objectType,
			nodeSubType: node.nodeSubType,
			nodeStatus: node.nodeStatus,
			label: node.label,
			isLeaf: node.isAlwaysLeaf,
			metadata: node.metadata,
			errorMessage: node.errorStateMessage,
			iconType: icon,
			childProvider: node.childProvider || parentNode.childProvider,
			payload: node.payload || (databaseChanged ? updatedPayload : parentNode.payload)
		};
		let newTreeItem: ITreeItem = {
			parentHandle: node.parent!.id,
			handle,
			collapsibleState: node.isAlwaysLeaf ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed,
			label: {
				label: node.label
			},
			childProvider: node.childProvider || parentNode.childProvider,
			providerHandle: parentNode.childProvider,
			payload: node.payload || (databaseChanged ? updatedPayload : parentNode.payload),
			contextValue: node.nodeTypeId,
			sqlIcon: icon,
			nodeInfo: nodeInfo,
			sessionId: parentNode.sessionId
		};
		this.nodeHandleMap.set(generateNodeMapKey(viewId, newTreeItem), nodePath);
		this.nodeInfoMap.set(newTreeItem, nodeInfo);
		return newTreeItem;
	}

	public providerExists(providerId: string): boolean {
		return this.oe.providerRegistered(providerId);
	}

	public isNodeConnected(viewId: string, node: ITreeItem): boolean {
		return node.sessionId !== undefined;
	}

	public getNodeInfoForTreeItem(treeItem: ITreeItem): azdata.NodeInfo | undefined {
		if (this.nodeInfoMap.has(treeItem)) {
			return this.nodeInfoMap.get(treeItem);
		}
		return undefined;
	}

	public getDefaultAuthenticationType(configurationService: IConfigurationService): string {
		return WorkbenchUtils.getSqlConfigValue<string>(configurationService, 'defaultAuthenticationType');
	}
}

function generateNodeMapKey(viewId: string, node: ITreeItem): number {
	return hash([viewId, node.handle]);
}
