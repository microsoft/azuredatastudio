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
import { SqlOpsDataClient } from 'dataprotocol-client';
import * as path from 'path';

/**
 * The main controller class that initializes the extension
 */
export default class MainController implements vscode.Disposable {
	private _context: vscode.ExtensionContext;
	private _initialized: boolean = false;
	private _serialization: Serialization;
	private _credentialStore: CredentialStore;
	private _client: SqlOpsDataClient;
	/**
	 * The main controller constructor
	 * @constructor
	 */
	constructor(context: vscode.ExtensionContext) {
		this._context = context;
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
				resolve(true);
			}).catch(err => {
				Telemetry.sendTelemetryEventForException(err, 'initialize', MainController._extensionConstants.extensionConfigSectionName);
				reject(err);
			});
		});
	}
}
