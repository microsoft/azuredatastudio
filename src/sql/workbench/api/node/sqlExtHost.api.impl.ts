/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as extHostApi from 'vs/workbench/api/node/extHost.api.impl';
import { TrieMap } from 'sql/base/common/map';
import { TPromise } from 'vs/base/common/winjs.base';
import { IInitData } from 'vs/workbench/api/node/extHost.protocol';
import { ExtHostExtensionService } from 'vs/workbench/api/node/extHostExtensionService';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { realpath } from 'fs';
import * as extHostTypes from 'vs/workbench/api/node/extHostTypes';

import * as data from 'data';
import * as vscode from 'vscode';
import { SqlExtHostContext } from 'sql/workbench/api/node/sqlExtHost.protocol';
import { ExtHostAccountManagement } from 'sql/workbench/api/node/extHostAccountManagement';
import { ExtHostCredentialManagement } from 'sql/workbench/api/node/extHostCredentialManagement';
import { ExtHostDataProtocol } from 'sql/workbench/api/node/extHostDataProtocol';
import { ExtHostSerializationProvider } from 'sql/workbench/api/node/extHostSerializationProvider';
import { ExtHostResourceProvider } from 'sql/workbench/api/node/extHostResourceProvider';
import { ExtHostThreadService } from 'vs/workbench/services/thread/node/extHostThreadService';
import * as sqlExtHostTypes from 'sql/workbench/api/common/sqlExtHostTypes';
import { ExtHostWorkspace } from 'vs/workbench/api/node/extHostWorkspace';
import { ExtHostConfiguration } from 'vs/workbench/api/node/extHostConfiguration';
import { ExtHostModalDialogs } from 'sql/workbench/api/node/extHostModalDialog';
import { ILogService } from 'vs/platform/log/common/log';
import { IExtensionApiFactory } from 'vs/workbench/api/node/extHost.api.impl';
import { ExtHostConnectionManagement } from 'sql/workbench/api/node/extHostConnectionManagement';

export interface ISqlExtensionApiFactory {
	vsCodeFactory(extension: IExtensionDescription): typeof vscode;
	dataFactory(extension: IExtensionDescription): typeof data;
}

/**
 * This method instantiates and returns the extension API surface
 */
export function createApiFactory(
	initData: IInitData,
	threadService: ExtHostThreadService,
	extHostWorkspace: ExtHostWorkspace,
	extHostConfiguration: ExtHostConfiguration,
	extensionService: ExtHostExtensionService,
	logService: ILogService
): ISqlExtensionApiFactory {
	let vsCodeFactory = extHostApi.createApiFactory(initData, threadService, extHostWorkspace, extHostConfiguration, extensionService, logService);

	// Addressable instances
	const extHostAccountManagement = threadService.set(SqlExtHostContext.ExtHostAccountManagement, new ExtHostAccountManagement(threadService));
	const extHostConnectionManagement = threadService.set(SqlExtHostContext.ExtHostConnectionManagement, new ExtHostConnectionManagement(threadService));
	const extHostCredentialManagement = threadService.set(SqlExtHostContext.ExtHostCredentialManagement, new ExtHostCredentialManagement(threadService));
	const extHostDataProvider = threadService.set(SqlExtHostContext.ExtHostDataProtocol, new ExtHostDataProtocol(threadService));
	const extHostSerializationProvider = threadService.set(SqlExtHostContext.ExtHostSerializationProvider, new ExtHostSerializationProvider(threadService));
	const extHostResourceProvider = threadService.set(SqlExtHostContext.ExtHostResourceProvider, new ExtHostResourceProvider(threadService));
	const extHostModalDialogs = threadService.set(SqlExtHostContext.ExtHostModalDialogs, new ExtHostModalDialogs(threadService));

	return {
		vsCodeFactory: vsCodeFactory,
		dataFactory: function (extension: IExtensionDescription): typeof data {
			// namespace: accounts
			const accounts: typeof data.accounts = {
				registerAccountProvider(providerMetadata: data.AccountProviderMetadata, provider: data.AccountProvider): vscode.Disposable {
					return extHostAccountManagement.$registerAccountProvider(providerMetadata, provider);
				},
				beginAutoOAuthDeviceCode(providerId: string, title: string, message: string, userCode: string, uri: string): Thenable<void> {
					return extHostAccountManagement.$beginAutoOAuthDeviceCode(providerId, title, message, userCode, uri);
				},
				endAutoOAuthDeviceCode(): void {
					return extHostAccountManagement.$endAutoOAuthDeviceCode();
				},
				accountUpdated(updatedAccount: data.Account): void {
					return extHostAccountManagement.$accountUpdated(updatedAccount);
				}
			};

			// namespace: connection
			const connection: typeof data.connection = {
				getActiveConnections(): Thenable<data.connection.Connection[]> {
					return extHostConnectionManagement.$getActiveConnections();
				},
				getCurrentConnection(): Thenable<data.connection.Connection> {
					return extHostConnectionManagement.$getCurrentConnection();
				},
				getCredentials(connectionId: string): Thenable<{ [name: string]: string }> {
					return extHostConnectionManagement.$getCredentials(connectionId);
				}
			};

			// namespace: credentials
			const credentials: typeof data.credentials = {
				registerProvider(provider: data.CredentialProvider): vscode.Disposable {
					return extHostCredentialManagement.$registerCredentialProvider(provider);
				},
				getProvider(namespaceId: string): Thenable<data.CredentialProvider> {
					return extHostCredentialManagement.$getCredentialProvider(namespaceId);
				}
			};

			// namespace: serialization
			const serialization: typeof data.serialization = {
				registerProvider(provider: data.SerializationProvider): vscode.Disposable {
					return extHostSerializationProvider.$registerSerializationProvider(provider);
				},
			};

			// namespace: serialization
			const resources: typeof data.resources = {
				registerResourceProvider(providerMetadata: data.ResourceProviderMetadata, provider: data.ResourceProvider): vscode.Disposable {
					return extHostResourceProvider.$registerResourceProvider(providerMetadata, provider);
				}
			};

			let registerConnectionProvider = (provider: data.ConnectionProvider): vscode.Disposable => {
				// Connection callbacks
				provider.registerOnConnectionComplete((connSummary: data.ConnectionInfoSummary) => {
					extHostDataProvider.$onConnectComplete(provider.handle, connSummary);
				});

				provider.registerOnIntelliSenseCacheComplete((connectionUri: string) => {
					extHostDataProvider.$onIntelliSenseCacheComplete(provider.handle, connectionUri);
				});

				provider.registerOnConnectionChanged((changedConnInfo: data.ChangedConnectionInfo) => {
					extHostDataProvider.$onConnectionChanged(provider.handle, changedConnInfo);
				});

				return extHostDataProvider.$registerConnectionProvider(provider);
			};

			let registerQueryProvider = (provider: data.QueryProvider): vscode.Disposable => {
				provider.registerOnQueryComplete((result: data.QueryExecuteCompleteNotificationResult) => {
					extHostDataProvider.$onQueryComplete(provider.handle, result);
				});

				provider.registerOnBatchStart((batchInfo: data.QueryExecuteBatchNotificationParams) => {
					extHostDataProvider.$onBatchStart(provider.handle, batchInfo);
				});

				provider.registerOnBatchComplete((batchInfo: data.QueryExecuteBatchNotificationParams) => {
					extHostDataProvider.$onBatchComplete(provider.handle, batchInfo);
				});

				provider.registerOnResultSetComplete((resultSetInfo: data.QueryExecuteResultSetCompleteNotificationParams) => {
					extHostDataProvider.$onResultSetComplete(provider.handle, resultSetInfo);
				});

				provider.registerOnMessage((message: data.QueryExecuteMessageParams) => {
					extHostDataProvider.$onQueryMessage(provider.handle, message);
				});

				provider.registerOnEditSessionReady((ownerUri: string, success: boolean, message: string) => {
					extHostDataProvider.$onEditSessionReady(provider.handle, ownerUri, success, message);
				});

				return extHostDataProvider.$registerQueryProvider(provider);
			};

			let registerObjectExplorerProvider = (provider: data.ObjectExplorerProvider): vscode.Disposable => {
				provider.registerOnSessionCreated((response: data.ObjectExplorerSession) => {
					extHostDataProvider.$onObjectExplorerSessionCreated(provider.handle, response);
				});

				provider.registerOnExpandCompleted((response: data.ObjectExplorerExpandInfo) => {
					extHostDataProvider.$onObjectExplorerNodeExpanded(provider.handle, response);
				});

				return extHostDataProvider.$registerObjectExplorerProvider(provider);
			};

			let registerTaskServicesProvider = (provider: data.TaskServicesProvider): vscode.Disposable => {
				provider.registerOnTaskCreated((response: data.TaskInfo) => {
					extHostDataProvider.$onTaskCreated(provider.handle, response);
				});

				provider.registerOnTaskStatusChanged((response: data.TaskProgressInfo) => {
					extHostDataProvider.$onTaskStatusChanged(provider.handle, response);
				});

				return extHostDataProvider.$registerTaskServicesProvider(provider);
			};

			let registerFileBrowserProvider = (provider: data.FileBrowserProvider): vscode.Disposable => {
				provider.registerOnFileBrowserOpened((response: data.FileBrowserOpenedParams) => {
					extHostDataProvider.$onFileBrowserOpened(provider.handle, response);
				});

				provider.registerOnFolderNodeExpanded((response: data.FileBrowserExpandedParams) => {
					extHostDataProvider.$onFolderNodeExpanded(provider.handle, response);
				});

				provider.registerOnFilePathsValidated((response: data.FileBrowserValidatedParams) => {
					extHostDataProvider.$onFilePathsValidated(provider.handle, response);
				});

				return extHostDataProvider.$registerFileBrowserProvider(provider);
			};

			let registerScriptingProvider = (provider: data.ScriptingProvider): vscode.Disposable => {
				provider.registerOnScriptingComplete((response: data.ScriptingCompleteResult) => {
					extHostDataProvider.$onScriptingComplete(provider.handle, response);
				});

				return extHostDataProvider.$registerScriptingProvider(provider);
			};

			let registerProfilerProvider = (provider: data.ProfilerProvider): vscode.Disposable => {
				provider.registerOnSessionEventsAvailable((response: data.ProfilerSessionEvents) => {
					extHostDataProvider.$onSessionEventsAvailable(provider.handle, response);
				});

				return extHostDataProvider.$registerProfilerProvider(provider);
			};

			let registerBackupProvider = (provider: data.BackupProvider): vscode.Disposable => {
				return extHostDataProvider.$registerBackupProvider(provider);
			};

			let registerRestoreProvider = (provider: data.RestoreProvider): vscode.Disposable => {
				return extHostDataProvider.$registerRestoreProvider(provider);
			};

			let registerMetadataProvider = (provider: data.MetadataProvider): vscode.Disposable => {
				return extHostDataProvider.$registerMetadataProvider(provider);
			};

			let registerCapabilitiesServiceProvider = (provider: data.CapabilitiesProvider): vscode.Disposable => {
				return extHostDataProvider.$registerCapabilitiesServiceProvider(provider);
			};

			let registerAdminServicesProvider = (provider: data.AdminServicesProvider): vscode.Disposable => {
				return extHostDataProvider.$registerAdminServicesProvider(provider);
			};

			// namespace: dataprotocol
			const dataprotocol: typeof data.dataprotocol = {
				registerBackupProvider,
				registerConnectionProvider,
				registerFileBrowserProvider,
				registerMetadataProvider,
				registerObjectExplorerProvider,
				registerProfilerProvider,
				registerRestoreProvider,
				registerScriptingProvider,
				registerTaskServicesProvider,
				registerQueryProvider,
				registerAdminServicesProvider,
				registerCapabilitiesServiceProvider,
				onDidChangeLanguageFlavor(listener: (e: data.DidChangeLanguageFlavorParams) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
					return extHostDataProvider.onDidChangeLanguageFlavor(listener, thisArgs, disposables);
				}
			};

			const window = {
				createDialog(name: string) {
					return extHostModalDialogs.createDialog(name);
				}
			};

			return {
				accounts,
				connection,
				credentials,
				resources,
				serialization,
				dataprotocol,
				ServiceOptionType: sqlExtHostTypes.ServiceOptionType,
				ConnectionOptionSpecialType: sqlExtHostTypes.ConnectionOptionSpecialType,
				EditRowState: sqlExtHostTypes.EditRowState,
				MetadataType: sqlExtHostTypes.MetadataType,
				TaskStatus: sqlExtHostTypes.TaskStatus,
				TaskExecutionMode: sqlExtHostTypes.TaskExecutionMode,
				ScriptOperation: sqlExtHostTypes.ScriptOperation,
				window
			};
		}
	};
}

export function initializeExtensionApi(extensionService: ExtHostExtensionService, apiFactory: ISqlExtensionApiFactory): TPromise<void> {
	return createExtensionPathIndex(extensionService).then(trie => defineAPI(apiFactory, trie));
}

function createExtensionPathIndex(extensionService: ExtHostExtensionService): TPromise<TrieMap<IExtensionDescription>> {

	// create trie to enable fast 'filename -> extension id' look up
	const trie = new TrieMap<IExtensionDescription>(TrieMap.PathSplitter);
	const extensions = extensionService.getAllExtensionDescriptions().map(ext => {
		if (!ext.main) {
			return undefined;
		}
		return new TPromise((resolve, reject) => {
			realpath(ext.extensionFolderPath, (err, path) => {
				if (err) {
					reject(err);
				} else {
					trie.insert(path, ext);
					resolve(void 0);
				}
			});
		});
	});

	return TPromise.join(extensions).then(() => trie);
}

function defineAPI(factory: ISqlExtensionApiFactory, extensionPaths: TrieMap<IExtensionDescription>): void {
	type ApiImpl = typeof vscode | typeof data;

	// each extension is meant to get its own api implementation
	const extApiImpl = new Map<string, typeof vscode>();
	const dataExtApiImpl = new Map<string, typeof data>();
	let defaultApiImpl: typeof vscode;
	let defaultDataApiImpl: typeof data;

	// The module factory looks for an entry in the API map for an extension. If found, it reuses this.
	// If not, it loads it & saves it in the map
	let getModuleFactory = function (apiMap: Map<string, any>,
		createApi: (extensionDescription: IExtensionDescription) => ApiImpl,
		defaultImpl: ApiImpl,
		setDefaultApiImpl: (defaultImpl: ApiImpl) => void,
		parent: any): ApiImpl {
		// get extension id from filename and api for extension
		const ext = extensionPaths.findSubstr(parent.filename);
		if (ext) {
			let apiImpl = apiMap.get(ext.id);
			if (!apiImpl) {
				apiImpl = createApi(ext);
				apiMap.set(ext.id, apiImpl);
			}
			return apiImpl;
		}

		// fall back to a default implementation
		if (!defaultImpl) {
			defaultImpl = createApi(nullExtensionDescription);
			setDefaultApiImpl(defaultImpl);
		}
		return defaultImpl;
	};

	const node_module = <any>require.__$__nodeRequire('module');
	const original = node_module._load;

	// TODO look into de-duplicating this code
	node_module._load = function load(request, parent, isMain) {
		if (request === 'vscode') {
			return getModuleFactory(extApiImpl, (ext) => factory.vsCodeFactory(ext),
				defaultApiImpl,
				(impl) => defaultApiImpl = <typeof vscode>impl,
				parent);
		} else if (request === 'data') {
			return getModuleFactory(dataExtApiImpl,
				(ext) => factory.dataFactory(ext),
				defaultDataApiImpl,
				(impl) => defaultDataApiImpl = <typeof data>impl,
				parent);
		} else {
			// Allow standard node_module load to occur
			return original.apply(this, arguments);
		}
	};
}


const nullExtensionDescription: IExtensionDescription = {
	id: 'nullExtensionDescription',
	name: 'Null Extension Description',
	publisher: 'vscode',
	activationEvents: undefined,
	contributes: undefined,
	enableProposedApi: false,
	engines: undefined,
	extensionDependencies: undefined,
	extensionFolderPath: undefined,
	isBuiltin: false,
	main: undefined,
	version: undefined
};
