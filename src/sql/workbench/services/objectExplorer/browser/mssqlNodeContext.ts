/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { Disposable } from 'vs/base/common/lifecycle';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { NodeType } from 'sql/workbench/services/objectExplorer/common/nodeType';
import { DatabaseEngineEdition } from 'sql/workbench/api/common/sqlExtHostTypes';
import { isWindows } from 'vs/base/common/platform';
import { ITreeItem } from 'sql/workbench/common/views';

export interface INodeContextValue {
	node: ITreeItem;
	viewId: string;
}

export class MssqlNodeContext extends Disposable {

	static readonly canSelect = new Set([NodeType.Table, NodeType.View]);
	static readonly canEditData = new Set([NodeType.Table]);
	static readonly canCreateOrDelete = new Set([NodeType.AggregateFunction, NodeType.PartitionFunction, NodeType.ScalarValuedFunction,
	NodeType.Schema, NodeType.StoredProcedure, NodeType.Table, NodeType.TableValuedFunction,
	NodeType.User, NodeType.UserDefinedTableType, NodeType.View, NodeType.Trigger, NodeType.DatabaseTrigger,
	NodeType.Index, NodeType.User, NodeType.DatabaseRole, NodeType.ApplicationRole, NodeType.Key]);
	static readonly canExecute = new Set([NodeType.StoredProcedure, NodeType.Function]);
	static readonly canAlter = new Set([NodeType.AggregateFunction, NodeType.PartitionFunction, NodeType.ScalarValuedFunction,
	NodeType.StoredProcedure, NodeType.TableValuedFunction, NodeType.View, NodeType.Function]);

	// General node context keys
	static NodeProvider = new RawContextKey<string>('nodeProvider', undefined);
	static IsDatabaseOrServer = new RawContextKey<boolean>('isDatabaseOrServer', false);
	static IsWindows = new RawContextKey<boolean>('isWindows', isWindows);
	static IsCloud = new RawContextKey<boolean>('isCloud', false);
	static NodeType = new RawContextKey<string>('nodeType', undefined);
	static NodeLabel = new RawContextKey<string>('nodeLabel', undefined);
	static EngineEdition = new RawContextKey<number>('engineEdition', DatabaseEngineEdition.Unknown);
	static CanOpenInAzurePortal = new RawContextKey<boolean>('canOpenInAzurePortal', false);

	// Scripting context keys
	static CanScriptAsSelect = new RawContextKey<boolean>('canScriptAsSelect', false);
	static CanEditData = new RawContextKey<boolean>('canEditData', false);
	static CanScriptAsCreateOrDelete = new RawContextKey<boolean>('canScriptAsCreateOeDelete', false);
	static CanScriptAsExecute = new RawContextKey<boolean>('canScriptAsExecute', false);
	static CanScriptAsAlter = new RawContextKey<boolean>('canScriptAsAlter', false);
	static IsQueryProvider = new RawContextKey<boolean>('isQueryProvider', false);

	private nodeProviderKey!: IContextKey<string>;
	private isCloudKey!: IContextKey<boolean>;
	private nodeTypeKey!: IContextKey<string>;
	private nodeLabelKey!: IContextKey<string>;
	private isDatabaseOrServerKey!: IContextKey<boolean>;
	private engineEditionKey!: IContextKey<number>;
	private canOpenInAzurePortal!: IContextKey<boolean>;

	private canScriptAsSelectKey!: IContextKey<boolean>;
	private canEditDataKey!: IContextKey<boolean>;
	private canScriptAsCreateOrDeleteKey!: IContextKey<boolean>;
	private canScriptAsExecuteKey!: IContextKey<boolean>;
	private canScriptAsAlterKey!: IContextKey<boolean>;
	private isQueryProviderKey!: IContextKey<boolean>;


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
				this.setEngineEdition();
				this.setCanOpenInPortal();
				if (node.type) {
					this.setIsDatabaseOrServer();
					this.nodeTypeKey.set(node.type);
				} else if (node.contextValue && node.providerHandle === mssqlProviderName) {
					this.setIsDatabaseOrServer();
					this.setScriptingContextKeys();
					this.nodeTypeKey.set(node.contextValue);
				}
				this.setQueryEnabledKey();
			}
			if (node.label) {
				this.nodeLabelKey.set(node.label.label);
			}
		}
	}

	private bindContextKeys(): void {
		this.isCloudKey = MssqlNodeContext.IsCloud.bindTo(this.contextKeyService);
		this.engineEditionKey = MssqlNodeContext.EngineEdition.bindTo(this.contextKeyService);
		this.nodeTypeKey = MssqlNodeContext.NodeType.bindTo(this.contextKeyService);
		this.nodeLabelKey = MssqlNodeContext.NodeLabel.bindTo(this.contextKeyService);
		this.isDatabaseOrServerKey = MssqlNodeContext.IsDatabaseOrServer.bindTo(this.contextKeyService);
		this.canScriptAsSelectKey = MssqlNodeContext.CanScriptAsSelect.bindTo(this.contextKeyService);
		this.canEditDataKey = MssqlNodeContext.CanEditData.bindTo(this.contextKeyService);
		this.canScriptAsCreateOrDeleteKey = MssqlNodeContext.CanScriptAsCreateOrDelete.bindTo(this.contextKeyService);
		this.canScriptAsExecuteKey = MssqlNodeContext.CanScriptAsExecute.bindTo(this.contextKeyService);
		this.canScriptAsAlterKey = MssqlNodeContext.CanScriptAsAlter.bindTo(this.contextKeyService);
		this.nodeProviderKey = MssqlNodeContext.NodeProvider.bindTo(this.contextKeyService);
		this.canOpenInAzurePortal = MssqlNodeContext.CanOpenInAzurePortal.bindTo(this.contextKeyService);
		this.isQueryProviderKey = MssqlNodeContext.IsQueryProvider.bindTo(this.contextKeyService);
	}

	/**
	 * Helper function to get the node provider
	 */
	private setNodeProvider(): void {
		if (this?.nodeContextValue?.node?.payload?.providerName) {
			this.nodeProviderKey.set(this.nodeContextValue.node.payload.providerName);
		} else if (this.nodeContextValue?.node?.childProvider) {
			this.nodeProviderKey.set(this.nodeContextValue.node.childProvider);
		}
	}

	/**
	 * Helper function to tell whether a connected node is cloud or not
	 */
	private setIsCloud(): void {
		let serverInfo = this.getServerInfo();
		if (serverInfo && serverInfo.isCloud) {
			this.isCloudKey.set(true);
		}
	}

	private setCanOpenInPortal(): void {
		const connectionProfile = this.nodeContextValue.node.payload;
		if (connectionProfile &&
			connectionProfile.azureResourceId &&
			connectionProfile.azureTenantId &&
			connectionProfile.azurePortalEndpoint) {
			this.canOpenInAzurePortal.set(true);
		}
	}

	/**
	 * Helper function to set engine edition
	 */
	private setEngineEdition(): void {

		let serverInfo = this.getServerInfo();
		if (serverInfo && serverInfo.engineEditionId) {
			this.engineEditionKey.set(serverInfo.engineEditionId);
		}
	}

	/**
	 * Helper function fetching the server info
	 */
	private getServerInfo(): azdata.ServerInfo | undefined {
		const profile = new ConnectionProfile(this.capabilitiesService,
			this.nodeContextValue.node.payload);
		const connection = this.connectionManagementService.findExistingConnection(profile);
		if (connection) {
			return this.connectionManagementService.getServerInfo(connection.id);
		}
		return undefined;
	}

	/**
	 * Helper function to tell whether a connected node is a database or a
	 * server or not. Added this key because this is easier to write than
	 * writing an OR statement in ContextKeyExpr
	 */
	private setIsDatabaseOrServer(): void {
		const isDatabaseOrServer = (this.nodeContextValue.node.contextValue === NodeType.Server ||
			this.nodeContextValue.node.contextValue === NodeType.Database ||
			this.nodeContextValue.node.type === NodeType.Server ||
			this.nodeContextValue.node.type === NodeType.Database);
		this.isDatabaseOrServerKey.set(isDatabaseOrServer);
	}

	/**
	 * Helper function to get the correct context from node for showing
	 * scripting context menu actions
	 */
	private setScriptingContextKeys(): void {
		const nodeType = this.nodeContextValue.node.contextValue;
		if (!nodeType) {
			return;
		}
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

	/**
	 * Set whether the current node's provider is also a query provider.
	 */
	private setQueryEnabledKey(): void {
		const provider = this.nodeContextValue?.node?.payload?.providerName || this.nodeContextValue.node.childProvider;
		const capabilities = provider ? this.capabilitiesService.getCapabilities(provider) : undefined;
		this.isQueryProviderKey.set(capabilities?.connection.isQueryProvider);
	}
}
