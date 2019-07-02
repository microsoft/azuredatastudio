/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import { INodeContextValue } from 'sql/workbench/parts/dataExplorer/common/nodeContext';
import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { Disposable } from 'vs/base/common/lifecycle';
import { NodeType } from 'sql/workbench/parts/objectExplorer/common/nodeType';
import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICapabilitiesService } from 'sql/platform/capabilities/common/capabilitiesService';

export class NodeContextUtils extends Disposable {

	static IsDatabaseOrServer = new RawContextKey<boolean>('isDatabaseOrServer', false);
	static IsMssqlProvided = new RawContextKey<boolean>('isMssqlProvided', false);
	static isDatabasesFolder = new RawContextKey<boolean>('isDatabasesFolder', false);
	static IsServer = new RawContextKey<boolean>('isServer', false);
	static IsWindows = new RawContextKey<boolean>('isWindows', os.platform() === 'win32');
	static IsCloud = new RawContextKey<boolean>('isCloud', false);

	private isDatabaseOrServerKey: IContextKey<boolean>;
	private isMssqlProvidedKey: IContextKey<boolean>;
	private isDatabaseFolderKey: IContextKey<boolean>;
	private isServerKey: IContextKey<boolean>;
	private isCloudKey: IContextKey<boolean>;

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
				this.isDatabasesFolder();
				this.isProvidedByMssql();
				this.isCloud();
			}
			if (node.type) {
				this.isServer();
			}
			if (node.contextValue) {
				this.isDatabaseOrServer();
			}
		}
	}

	private bindContextKeys(): void {
		this.isDatabaseOrServerKey = NodeContextUtils.IsDatabaseOrServer.bindTo(this.contextKeyService);
		this.isMssqlProvidedKey = NodeContextUtils.IsMssqlProvided.bindTo(this.contextKeyService);
		this.isDatabaseFolderKey = NodeContextUtils.isDatabasesFolder.bindTo(this.contextKeyService);
		this.isServerKey = NodeContextUtils.IsServer.bindTo(this.contextKeyService);
		this.isCloudKey = NodeContextUtils.IsCloud.bindTo(this.contextKeyService);
	}

	/**
	 * Helper function to tell whether node is a database or server or not
	 */
	private isDatabaseOrServer(): void {
		if (this.nodeContextValue.node.type) {
			if (this.nodeContextValue.node.type === NodeType.Database
				|| this.nodeContextValue.node.type === NodeType.Server) {
				this.isDatabaseOrServerKey.set(true);
				return;
			}
		} else if (this.nodeContextValue.node.contextValue === NodeType.Database ||
			this.nodeContextValue.node.contextValue === NodeType.Server) {
			this.isDatabaseOrServerKey.set(true);
		}
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
	 * Helper function to tell whether a node is a databases folder
	 */
	private isDatabasesFolder(): void {
		if (this.nodeContextValue.node.payload.providerName === 'MSSQL') {
			if (this.nodeContextValue.node.contextValue === NodeType.Folder &&
				this.nodeContextValue.node.label.label === 'Databases') {
				this.isDatabaseFolderKey.set(true);
			}
		}
	}

	/**
	 * Helper function to tell whether a node is a server or not
	 */
	private isServer(): void {
		if (this.nodeContextValue.node.type === NodeType.Server ||
			this.nodeContextValue.node.contextValue === NodeType.Server) {
			this.isServerKey.set(true);
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
}
