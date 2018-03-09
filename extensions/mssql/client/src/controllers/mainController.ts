/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import * as vscode from 'vscode';
import * as sqlops from 'sqlops';
import { Constants } from '../models/constants';
import { Serialization } from '../serialize/serialization';
import { CredentialStore } from '../credentialstore/credentialstore';
import { AzureResourceProvider } from '../resourceProvider/resourceProvider';
import { IExtensionConstants, Telemetry, Constants as SharedConstants, SqlToolsServiceClient, VscodeWrapper, Utils, PlatformInformation } from 'extensions-modules';
import { SqlOpsDataClient } from 'dataprotocol-client';
import * as path from 'path';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	private _context: vscode.ExtensionContext;
	private _vscodeWrapper: VscodeWrapper;
	private _initialized: boolean = false;
	private _serialization: Serialization;
	private _credentialStore: CredentialStore;
	private static _extensionConstants: IExtensionConstants = new Constants();
	private _client: SqlToolsServiceClient;
	/**
	 * The main controller constructor
	 * @constructor
	 */
	constructor(context: vscode.ExtensionContext,
		vscodeWrapper?: VscodeWrapper) {
		this._context = context;
		this._vscodeWrapper = vscodeWrapper || new VscodeWrapper(MainController._extensionConstants);
		SqlToolsServiceClient.constants = MainController._extensionConstants;
		this._client = SqlToolsServiceClient.getInstance(path.join(__dirname, '../config.json'));
		this._credentialStore = new CredentialStore(this._client);
		this._serialization = new Serialization(this._client);
	}

	/**
	 * Disposes the controller
	 */
	dispose(): void {
		this.deactivate();
	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
		Utils.logDebug(SharedConstants.extensionDeactivated, MainController._extensionConstants.extensionConfigSectionName);
	}

	/**
	 * Initializes the extension
	 */
	public activate(): Promise<boolean> {
		return this.initialize();
	}

	/**
	 * Returns a flag indicating if the extension is initialized
	 */
	public isInitialized(): boolean {
		return this._initialized;
	}

	private createClient(executableFiles: string[]): Promise<SqlOpsDataClient> {
		return PlatformInformation.getCurrent(SqlToolsServiceClient.constants.getRuntimeId, SqlToolsServiceClient.constants.extensionName).then(platformInfo => {
			return SqlToolsServiceClient.getInstance(path.join(__dirname, '../config.json')).createClient(this._context, platformInfo.runtimeId, undefined, executableFiles);
		});
	}

	private createCredentialClient(): Promise<SqlOpsDataClient> {
		return this.createClient(['MicrosoftSqlToolsCredentials.exe', 'MicrosoftSqlToolsCredentials']);
	}

	private createResourceProviderClient(): Promise<SqlOpsDataClient> {
		return this.createClient(['SqlToolsResourceProviderService.exe', 'SqlToolsResourceProviderService']);
	}

	/**
	 * Initializes the extension
	 */
	public initialize(): Promise<boolean> {

		// initialize language service client
		return new Promise<boolean>((resolve, reject) => {
			const self = this;
			SqlToolsServiceClient.getInstance(path.join(__dirname, '../config.json')).initialize(self._context).then(serverResult => {

				// Initialize telemetry
				Telemetry.initialize(self._context, new Constants());

				// telemetry for activation
				Telemetry.sendTelemetryEvent('ExtensionActivated', {},
					{ serviceInstalled: serverResult.installedBeforeInitializing ? 1 : 0 }
				);

				self.createResourceProviderClient().then(rpClient => {
					let resourceProvider = new AzureResourceProvider(self._client, rpClient);
					sqlops.resources.registerResourceProvider({
						displayName: 'Azure SQL Resource Provider', // TODO Localize
						id: 'Microsoft.Azure.SQL.ResourceProvider',
						settings: {

						}
					}, resourceProvider);
					Utils.logDebug('resourceProvider registered', MainController._extensionConstants.extensionConfigSectionName);
				}, error => {
					Utils.logDebug('Cannot find ResourceProvider executables. error: ' + error, MainController._extensionConstants.extensionConfigSectionName);
				});

				self.createCredentialClient().then(credentialClient => {
					self._credentialStore.languageClient = credentialClient;
					credentialClient.onReady().then(() => {
						let credentialProvider: sqlops.CredentialProvider = {
							handle: 0,
							saveCredential(credentialId: string, password: string): Thenable<boolean> {
								return self._credentialStore.saveCredential(credentialId, password);
							},
							readCredential(credentialId: string): Thenable<sqlops.Credential> {
								return self._credentialStore.readCredential(credentialId);
							},
							deleteCredential(credentialId: string): Thenable<boolean> {
								return self._credentialStore.deleteCredential(credentialId);
							}
						};
						sqlops.credentials.registerProvider(credentialProvider);
						Utils.logDebug('credentialProvider registered', MainController._extensionConstants.extensionConfigSectionName);
					});
				}, error => {
					Utils.logDebug('Cannot find credentials executables. error: ' + error, MainController._extensionConstants.extensionConfigSectionName);
				});

				Utils.logDebug(SharedConstants.extensionActivated, MainController._extensionConstants.extensionConfigSectionName);
				self._initialized = true;
				// setInterval(() => {
				// 	sqlops.objectexplorer.getActiveConnections().then(connectionNodes => {
				// 		connectionNodes.forEach(connectionNode => {
				// 			// data.objectexplorer.getNode(connectionNode.connectionId, 'mairvine-pc/Server Objects/Endpoints/Dedicated Admin Connection').then(node => {
				// 			// 	return node.select();
				// 			// });
				// 			sqlops.objectexplorer.getNode(connectionNode.connectionId, 'mairvine-pc/Server Objects/Endpoints').then(node => {
				// 			// data.objectexplorer.getNode(connectionNode.connectionId, 'mairvine-pc/Server Objects/Endpoints/Dedicated Admin Connection').then(node => {
				// 				if (!node) {
				// 					console.log('could not find node');
				// 				} else {
				// 					console.log('found endpoint node');
				// 					node.getParent().then(parent => {
				// 						if (parent) {
				// 							console.log('found parent for endpoint node with path ' + parent.nodePath);

				// 						} else {
				// 							console.log('no parent for endpoint node');
				// 						}
				// 					});
				// 					return node.isExpanded().then(expanded => {
				// 						if (expanded) {
				// 							return node.collapse();
				// 						} else {
				// 							return node.expand().then(() => console.log('successful expand'), err => console.log('expand failed: ' + err));
				// 						}
				// 					});
				// 				}
				// 			}, err => console.log('error getting node: ' + err)).then(() => {
				// 				// connectionNode.isExpanded().then(result => {
				// 				// 	if (result) {
				// 				// 		connectionNode.collapse();
				// 				// 		return;
				// 				// 	}
				// 				// 	this.expandChildren([connectionNode]);
				// 				// 	connectionNode.select();
				// 				// });
				// 			});
				// 			connectionNode.getParent().then(connectionParent => {
				// 				if (!connectionParent) {
				// 					console.log('no parent for connection');
				// 				} else {
				// 					console.log('connection has a parent!');
				// 				}
				// 			});
				// 		});
				// 	});
				// }, 10000);

				// vscode.commands.registerCommand('mssql.objectexplorer.interact', async () => {
				// 	let activeConnections = await sqlops.objectexplorer.getActiveConnectionNodes();
				// 	let connectionChoice = await vscode.window.showQuickPick(activeConnections.map(connection => connection.label + '.' + connection.connectionId));
				// 	let connection = activeConnections.find(activeConnection => activeConnection.label + '.' + activeConnection.connectionId === connectionChoice);
				// 	let type = await vscode.window.showInputBox({ prompt: 'type' });
				// 	if (type === '') {
				// 		type = undefined;
				// 	}
				// 	let schema = await vscode.window.showInputBox({ prompt: 'schema' });
				// 	if (schema === '') {
				// 		schema = undefined;
				// 	}
				// 	let name = await vscode.window.showInputBox({ prompt: 'name' });
				// 	if (name === '') {
				// 		name = undefined;
				// 	}
				// 	let database = await vscode.window.showInputBox({ prompt: 'database' });
				// 	if (database === '') {
				// 		database = undefined;
				// 	}
				// 	let parentObjectNames = [];
				// 	while (true) {
				// 		let parentObjectName = await vscode.window.showInputBox({ prompt: 'parent name' });
				// 		if (!parentObjectName || parentObjectName === '') {
				// 			break;
				// 		}
				// 		parentObjectNames.push(parentObjectName);
				// 	}
				// 	let foundNodes = await sqlops.objectexplorer.findNodes(connection.connectionId, type, schema, name, database, parentObjectNames);
				// 	if (foundNodes.length === 0) {
				// 		console.log('No matching nodes');
				// 	} else {
				// 		let selection = foundNodes[0];
				// 		if (foundNodes.length > 1) {
				// 			let selectedName = await vscode.window.showQuickPick(foundNodes.map(foundNode => foundNode.label + ' - ' + foundNode.nodePath));
				// 			selection = foundNodes.find(foundNode => foundNode.label + ' - ' + foundNode.nodePath === selectedName);
				// 		}
				// 		await this.interactWithOENode(selection);
				// 	}
				// });

				vscode.commands.registerCommand('mssql.objectexplorer.interact', () => {
					sqlops.objectexplorer.getActiveConnectionNodes().then(activeConnections => {
						vscode.window.showQuickPick(activeConnections.map(connection => connection.label)).then(selection => {
							let selectedNode = activeConnections.find(connection => connection.label === selection);
							this.interactWithOENode(selectedNode);
						});
					});
				});

				resolve(true);
			}).catch(err => {
				Telemetry.sendTelemetryEventForException(err, 'initialize', MainController._extensionConstants.extensionConfigSectionName);
				reject(err);
			});
		});
	}

	private async interactWithOENode(selectedNode: sqlops.objectexplorer.ObjectExplorerNode): Promise<void> {
		let choices = ['Expand', 'Collapse', 'Select', 'Select (multi)', 'Deselect', 'Deselect (multi)'];
		if (selectedNode.isLeaf) {
			choices[0] += ' (is leaf)';
			choices[1] += ' (is leaf)';
		} else {
			let expanded = await selectedNode.isExpanded();
			if (expanded) {
				choices[0] += ' (is expanded)';
			} else {
				choices[1] += ' (is collapsed)';
			}
		}
		let parent = await selectedNode.getParent();
		if (parent) {
			choices.push('Get Parent');
		}
		let children = await selectedNode.getChildren();
		children.forEach(child => choices.push(child.label));
		choices.push(selectedNode.nodeType);
		let choice = await vscode.window.showQuickPick(choices);
		let nextNode: sqlops.objectexplorer.ObjectExplorerNode = undefined;
		if (choice === choices[0]) {
			selectedNode.setExpandedState(vscode.TreeItemCollapsibleState.Expanded);
		} else if (choice === choices[1]) {
			selectedNode.setExpandedState(vscode.TreeItemCollapsibleState.Collapsed);
		} else if (choice === choices[2]) {
			selectedNode.setSelected(true);
		} else if (choice === choices[3]) {
			selectedNode.setSelected(true, false);
		} else if (choice === choices[4]) {
			selectedNode.setSelected(false);
		} else if (choice === choices[5]) {
			selectedNode.setSelected(false, true);
		} else if (choice === 'Get Parent') {
			nextNode = parent;
		} else {
			let childNode = children.find(child => child.label === choice);
			nextNode = childNode;
		}
		if (nextNode) {
			let updatedNode = await sqlops.objectexplorer.getNode(nextNode.connectionId, nextNode.nodePath);
			this.interactWithOENode(updatedNode);
		}
	}

	// private expandChildren(children: sqlops.objectexplorer.ObjectExplorerNode[], moreLevel: boolean = true) {
	// 	children.forEach(child => {
	// 		child.getChildren().then(oldChildren => {
	// 			console.log('found ' + oldChildren.length + ' old children for node ' + child.nodePath);
	// 		}).then(() => {
	// 			if (moreLevel) {
	// 				child.setExpandedState(vscode.TreeItemCollapsibleState.Expanded).then(() => {
	// 					child.getChildren().then(newChildren => {
	// 						console.log('found ' + newChildren.length + ' children for node ' + child.nodePath);
	// 						if (moreLevel) {
	// 							this.expandChildren(newChildren, false);
	// 						}
	// 					});
	// 				});
	// 			}
	// 		});
	// 	});
	// }
}
