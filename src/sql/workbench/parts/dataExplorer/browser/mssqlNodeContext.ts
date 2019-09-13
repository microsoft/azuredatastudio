/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INodeContextValue } from 'sql/workbench/parts/dataExplorer/browser/nodeContext';
import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { Disposable } from 'vs/base/common/lifecycle';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { NodeType } from 'sql/workbench/parts/objectExplorer/common/nodeType';
import { ExtensionNodeType } from 'sql/workbench/api/common/sqlExtHostTypes';
import { isWindows } from 'vs/base/common/platform';

export class MssqlNodeContext extends Disposable {

	static readonly canSelect = new Set([NodeType.Table, NodeType.View]);
	static readonly canEditData = new Set([NodeType.Table]);
	static readonly canCreateOrDelete = new Set([NodeType.AggregateFunction, NodeType.PartitionFunction, NodeType.ScalarValuedFunction,
	NodeType.Schema, NodeType.StoredProcedure, NodeType.Table, NodeType.TableValuedFunction,
	NodeType.User, NodeType.UserDefinedTableType, NodeType.View]);
	static readonly canExecute = new Set([NodeType.StoredProcedure]);
	static readonly canAlter = new Set([NodeType.AggregateFunction, NodeType.PartitionFunction, NodeType.ScalarValuedFunction,
	NodeType.StoredProcedure, NodeType.TableValuedFunction, NodeType.View]);

	// General node context keys
	static NodeProvider = new RawContextKey<string>('nodeProvider', undefined);
	static IsDatabaseOrServer = new RawContextKey<boolean>('isDatabaseOrServer', false);
	static IsWindows = new RawContextKey<boolean>('isWindows', isWindows);
	static IsCloud = new RawContextKey<boolean>('isCloud', false);
	static NodeType = new RawContextKey<string>('nodeType', undefined);
	static NodeLabel = new RawContextKey<string>('nodeLabel', undefined);

	// Scripting context keys
	static CanScriptAsSelect = new RawContextKey<boolean>('canScriptAsSelect', false);
	static CanEditData = new RawContextKey<boolean>('canEditData', false);
	static CanScriptAsCreateOrDelete = new RawContextKey<boolean>('canScriptAsCreateOeDelete', false);
	static CanScriptAsExecute = new RawContextKey<boolean>('canScriptAsExecute', false);
	static CanScriptAsAlter = new RawContextKey<boolean>('canScriptAsAlter', false);

	private nodeProviderKey: IContextKey<string>;
	private isCloudKey: IContextKey<boolean>;
	private nodeTypeKey: IContextKey<string>;
	private nodeLabelKey: IContextKey<string>;
	private isDatabaseOrServerKey: IContextKey<boolean>;

	private canScriptAsSelectKey: IContextKey<boolean>;
	private canEditDataKey: IContextKey<boolean>;
	private canScriptAsCreateOrDeleteKey: IContextKey<boolean>;
	private canScriptAsExecuteKey: IContextKey<boolean>;
	private canScriptAsAlterKey: IContextKey<boolean>;

	constructor(
		private nodeContextValue: INodeContextValue,
		@IContextKeyService private contextKeyService: IContextKeyService,
		@IConnectionManagementService private connectionManagementService: IConnectionManagementService,
		@ICapabilitiesService private capabilitiesService: ICapabilitiesService
	) {
		super();
		this.bindContextKeys();

		// Set additional node context keys
		if (this.nodeContextValue.node) {
			const node = this.nodeContextValue.node;
			if (node.payload) {
				this.setNodeProvider();
				this.setIsCloud();
				if (node.type) {
					this.setIsDatabaseOrServer();
					this.nodeTypeKey.set(node.type);
				} else if (node.contextValue && node.providerHandle === mssqlProviderName) {
					this.setIsDatabaseOrServer();
					this.setScriptingContextKeys();
					this.nodeTypeKey.set(node.contextValue);
				}
			}
			if (node.label) {
				this.nodeLabelKey.set(node.label.label);
			}
		}
	}

	private bindContextKeys(): void {
		this.isCloudKey = MssqlNodeContext.IsCloud.bindTo(this.contextKeyService);
		this.nodeTypeKey = MssqlNodeContext.NodeType.bindTo(this.contextKeyService);
		this.nodeLabelKey = MssqlNodeContext.NodeLabel.bindTo(this.contextKeyService);
		this.isDatabaseOrServerKey = MssqlNodeContext.IsDatabaseOrServer.bindTo(this.contextKeyService);
		this.canScriptAsSelectKey = MssqlNodeContext.CanScriptAsSelect.bindTo(this.contextKeyService);
		this.canEditDataKey = MssqlNodeContext.CanEditData.bindTo(this.contextKeyService);
		this.canScriptAsCreateOrDeleteKey = MssqlNodeContext.CanScriptAsCreateOrDelete.bindTo(this.contextKeyService);
		this.canScriptAsExecuteKey = MssqlNodeContext.CanScriptAsExecute.bindTo(this.contextKeyService);
		this.canScriptAsAlterKey = MssqlNodeContext.CanScriptAsAlter.bindTo(this.contextKeyService);
		this.nodeProviderKey = MssqlNodeContext.NodeProvider.bindTo(this.contextKeyService);
	}

	/**
	 * Helper function to get the node provider
	 */
	private setNodeProvider(): void {
		if (this.nodeContextValue.node.payload.providerName) {
			this.nodeProviderKey.set(this.nodeContextValue.node.payload.providerName);
		} else if (this.nodeContextValue.node.childProvider) {
			this.nodeProviderKey.set(this.nodeContextValue.node.childProvider);
		}
	}

	/**
	 * Helper function to tell whether a connected node is cloud or not
	 */
	private setIsCloud(): void {
		const profile = new ConnectionProfile(this.capabilitiesService,
			this.nodeContextValue.node.payload);
		const connection = this.connectionManagementService.findExistingConnection(profile);
		if (connection) {
			const serverInfo = this.connectionManagementService.getServerInfo(connection.id);
			if (serverInfo.isCloud) {
				this.isCloudKey.set(true);
			}
		}
	}

	/**
	 * Helper function to tell whether a connected node is a database or a
	 * server or not. Added this key because this is easier to write than
	 * writing an OR statement in ContextKeyExpr
	 */
	private setIsDatabaseOrServer(): void {
		const isDatabaseOrServer = (this.nodeContextValue.node.contextValue === NodeType.Server ||
			this.nodeContextValue.node.contextValue === NodeType.Database ||
			this.nodeContextValue.node.type === ExtensionNodeType.Server ||
			this.nodeContextValue.node.type === ExtensionNodeType.Database);
		this.isDatabaseOrServerKey.set(isDatabaseOrServer);
	}

	/**
	 * Helper function to get the correct context from node for showing
	 * scripting context menu actions
	 */
	private setScriptingContextKeys(): void {
		const nodeType = this.nodeContextValue.node.contextValue;
		if (MssqlNodeContext.canCreateOrDelete.has(nodeType)) {
			this.canScriptAsCreateOrDeleteKey.set(true);
		}
		if (MssqlNodeContext.canEditData.has(nodeType)) {
			this.canEditDataKey.set(true);
		}
		if (MssqlNodeContext.canAlter.has(nodeType)) {
			this.canScriptAsAlterKey.set(true);
		}
		if (MssqlNodeContext.canExecute.has(nodeType)) {
			this.canScriptAsExecuteKey.set(true);
		}
		if (MssqlNodeContext.canSelect.has(nodeType)) {
			this.canScriptAsSelectKey.set(true);
		}
	}
}
