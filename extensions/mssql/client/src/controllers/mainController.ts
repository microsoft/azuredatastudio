/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import vscode = require('vscode');
import data = require('data');
import { Constants } from '../models/constants';
import { Serialization } from '../serialize/serialization';
import { AzureResourceProvider } from '../resourceProvider/resourceProvider';
import { CredentialStore } from '../credentialstore/credentialstore';
import { IExtensionConstants, Telemetry, Constants as SharedConstants, SqlToolsServiceClient, VscodeWrapper, Utils, PlatformInformation } from 'extensions-modules';
import { LanguageClient } from 'dataprotocol-client';
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

	private createClient(executableFiles: string[]): Promise<LanguageClient> {
		return PlatformInformation.getCurrent(SqlToolsServiceClient.constants.getRuntimeId, SqlToolsServiceClient.constants.extensionName).then(platformInfo => {
			return SqlToolsServiceClient.getInstance(path.join(__dirname, '../config.json')).createClient(this._context, platformInfo.runtimeId, undefined, executableFiles);
		});
	}

	private createCredentialClient(): Promise<LanguageClient> {
		return this.createClient(['MicrosoftSqlToolsCredentials.exe', 'MicrosoftSqlToolsCredentials']);
	}

	private createResourceProviderClient(): Promise<LanguageClient> {
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
					data.resources.registerResourceProvider({
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
					(<LanguageClient>credentialClient).onReady().then(() => {
						let credentialProvider: data.CredentialProvider = {
							handle: 0,
							saveCredential(credentialId: string, password: string): Thenable<boolean> {
								return self._credentialStore.saveCredential(credentialId, password);
							},
							readCredential(credentialId: string): Thenable<data.Credential> {
								return self._credentialStore.readCredential(credentialId);
							},
							deleteCredential(credentialId: string): Thenable<boolean> {
								return self._credentialStore.deleteCredential(credentialId);
							}
						};
						data.credentials.registerProvider(credentialProvider);
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
