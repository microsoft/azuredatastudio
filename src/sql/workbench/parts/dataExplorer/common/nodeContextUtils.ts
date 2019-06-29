/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INodeContextValue } from 'sql/workbench/parts/dataExplorer/common/nodeContext';
import { RawContextKey, IContextKeyService, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { Disposable } from 'vs/base/common/lifecycle';
import { NodeType } from 'sql/workbench/parts/objectExplorer/common/nodeType';

export class NodeContextUtils extends Disposable {

	static IsDatabaseOrServer = new RawContextKey<boolean>('isDatabaseOrServer', false);
	static IsMssqlProvided = new RawContextKey<boolean>('isMssqlProvided', false);
	static isDatabasesFolder = new RawContextKey<boolean>('isDatabasesFolder', false);
	static IsServer = new RawContextKey<boolean>('isServer', false);

	private isDatabaseOrServerKey: IContextKey<boolean>;
	private isMssqlProvidedKey: IContextKey<boolean>;
	private isDatabaseFolderKey: IContextKey<boolean>;
	private isServerKey: IContextKey<boolean>;

	constructor(
		private nodeContextValue: INodeContextValue,
		@IContextKeyService private contextKeyService: IContextKeyService
	) {
		super();
		this.bindContextKeys();
		// Set additional node context keys
		this.isDatabaseOrServer();
		this.isProvidedByMssql();
		this.isDatabasesFolder();
		this.isServer();
	}

	private bindContextKeys(): void {
		this.isDatabaseOrServerKey = NodeContextUtils.IsDatabaseOrServer.bindTo(this.contextKeyService);
		this.isMssqlProvidedKey = NodeContextUtils.IsMssqlProvided.bindTo(this.contextKeyService);
		this.isDatabaseFolderKey = NodeContextUtils.isDatabasesFolder.bindTo(this.contextKeyService);
		this.isServerKey = NodeContextUtils.IsServer.bindTo(this.contextKeyService);
	}

	/**
	 * Helper function to tell whether node is a database or server or not
	 */
	private isDatabaseOrServer(): void {
		if (this.nodeContextValue.node) {
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
	}

	/**
	 * Helper function to tell whether node provider is MSSQL
	 */
	private isProvidedByMssql(): void {
		if (this.nodeContextValue.node && this.nodeContextValue.node.payload) {
			if (this.nodeContextValue.node.payload.providerName === 'MSSQL') {
				this.isMssqlProvidedKey.set(true);
			}
		}
	}

	/**
	 * Helper function to tell whether a node is a databases folder
	 */
	private isDatabasesFolder(): void {
		if (this.nodeContextValue.node && this.nodeContextValue.node.payload) {
			if (this.nodeContextValue.node.payload.providerName === 'MSSQL') {
				if (this.nodeContextValue.node.contextValue === NodeType.Folder &&
					this.nodeContextValue.node.label.label === 'Databases') {
					this.isDatabaseFolderKey.set(true);
				}
			}
		}
	}

	/**
	 * Helper function to tell whether a node is a server or not
	 */
	private isServer(): void {
		if (this.nodeContextValue.node) {
			if (this.nodeContextValue.node.type) {
				if (this.nodeContextValue.node.type === NodeType.Server ||
					this.nodeContextValue.node.contextValue === NodeType.Server) {
					this.isServerKey.set(true);
				}
			}
		}
	}
}
