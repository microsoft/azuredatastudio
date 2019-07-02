/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import { INodeContextValue } from 'sql/workbench/parts/dataExplorer/common/nodeContext';
import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { Disposable } from 'vs/base/common/lifecycle';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { NodeType } from 'sql/workbench/parts/objectExplorer/common/nodeType';

export class NodeContextUtils extends Disposable {

	static IsMssqlProvided = new RawContextKey<boolean>('isMssqlProvided', false);
	static IsDatabaseOrServer = new RawContextKey<boolean>('isDatabaseOrServer', false);
	static IsWindows = new RawContextKey<boolean>('isWindows', os.platform() === 'win32');
	static IsCloud = new RawContextKey<boolean>('isCloud', false);
	static NodeType = new RawContextKey<string>('nodeType', undefined);
	static NodeLabel = new RawContextKey<string>('nodeLabel', undefined);

	private isMssqlProvidedKey: IContextKey<boolean>;
	private isCloudKey: IContextKey<boolean>;
	private nodeTypeKey: IContextKey<string>;
	private nodeLabelKey: IContextKey<string>;
	private isDatabaseOrServerKey: IContextKey<boolean>;

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
				this.isProvidedByMssql();
				this.isCloud();
				if (node.contextValue && node.providerHandle === mssqlProviderName) {
					this.isDatabaseOrServer();
					this.nodeTypeKey.set(node.contextValue);
				} else if (node.type) {
					this.isDatabaseOrServer();
					this.nodeTypeKey.set(node.type);
				}
			}
			if (node.label) {
				this.nodeLabelKey.set(node.label.label);
			}
		}
	}

	private bindContextKeys(): void {
		this.isMssqlProvidedKey = NodeContextUtils.IsMssqlProvided.bindTo(this.contextKeyService);
		this.isCloudKey = NodeContextUtils.IsCloud.bindTo(this.contextKeyService);
		this.nodeTypeKey = NodeContextUtils.NodeType.bindTo(this.contextKeyService);
		this.nodeLabelKey = NodeContextUtils.NodeLabel.bindTo(this.contextKeyService);
		this.isDatabaseOrServerKey = NodeContextUtils.IsDatabaseOrServer.bindTo(this.contextKeyService);
	}

	/**
	 * Helper function to tell whether node provider is MSSQL
	 */
	private isProvidedByMssql(): void {
		if (this.nodeContextValue.node.payload.providerName === 'MSSQL') {
			this.isMssqlProvidedKey.set(true);
		}
	}

	/**
	 * Helper function to tell whether a connected node is cloud or not
	 */
	private isCloud(): void {
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
	private isDatabaseOrServer(): void {
		const isDatabaseOrServer = (this.nodeContextValue.node.contextValue === NodeType.Server ||
			this.nodeContextValue.node.contextValue === NodeType.Database ||
			this.nodeContextValue.node.type === NodeType.Server ||
			this.nodeContextValue.node.type === NodeType.Database);
		this.isDatabaseOrServerKey.set(isDatabaseOrServer);
	}
}
