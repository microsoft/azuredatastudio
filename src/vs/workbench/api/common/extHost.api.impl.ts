/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from 'vs/base/common/cancellation';
import * as errors from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import Severity from 'vs/base/common/severity';
import { URI } from 'vs/base/common/uri';
import { TextEditorCursorStyle } from 'vs/editor/common/config/editorOptions';
import { OverviewRulerLane } from 'vs/editor/common/model';
import * as languageConfiguration from 'vs/editor/common/languages/languageConfiguration';
import { score } from 'vs/editor/common/languageSelector';
import * as files from 'vs/platform/files/common/files';
import { ExtHostContext, MainContext, CandidatePortSource, ExtHostLogLevelServiceShape } from 'vs/workbench/api/common/extHost.protocol';
import { UIKind } from 'vs/workbench/services/extensions/common/extensionHostProtocol';
import { ExtHostApiCommands } from 'vs/workbench/api/common/extHostApiCommands';
import { ExtHostClipboard } from 'vs/workbench/api/common/extHostClipboard';
import { IExtHostCommands } from 'vs/workbench/api/common/extHostCommands';
import { createExtHostComments } from 'vs/workbench/api/common/extHostComments';
import { ExtHostConfigProvider, IExtHostConfiguration } from 'vs/workbench/api/common/extHostConfiguration';
import { ExtHostDiagnostics } from 'vs/workbench/api/common/extHostDiagnostics';
import { ExtHostDialogs } from 'vs/workbench/api/common/extHostDialogs';
import { ExtHostDocumentContentProvider } from 'vs/workbench/api/common/extHostDocumentContentProviders';
import { ExtHostDocumentSaveParticipant } from 'vs/workbench/api/common/extHostDocumentSaveParticipant';
import { ExtHostDocuments } from 'vs/workbench/api/common/extHostDocuments';
import { IExtHostDocumentsAndEditors } from 'vs/workbench/api/common/extHostDocumentsAndEditors';
import { Extension, IExtHostExtensionService } from 'vs/workbench/api/common/extHostExtensionService';
import { ExtHostFileSystem } from 'vs/workbench/api/common/extHostFileSystem';
import { ExtHostFileSystemEventService } from 'vs/workbench/api/common/extHostFileSystemEventService';
import { ExtHostLanguageFeatures } from 'vs/workbench/api/common/extHostLanguageFeatures';
import { ExtHostLanguages } from 'vs/workbench/api/common/extHostLanguages';
import { ExtHostMessageService } from 'vs/workbench/api/common/extHostMessageService';
import { IExtHostOutputService } from 'vs/workbench/api/common/extHostOutput';
import { ExtHostProgress } from 'vs/workbench/api/common/extHostProgress';
import { createExtHostQuickOpen } from 'vs/workbench/api/common/extHostQuickOpen';
import { ExtHostSCM } from 'vs/workbench/api/common/extHostSCM';
import { ExtHostStatusBar } from 'vs/workbench/api/common/extHostStatusBar';
import { IExtHostStorage } from 'vs/workbench/api/common/extHostStorage';
import { IExtHostTerminalService } from 'vs/workbench/api/common/extHostTerminalService';
import { ExtHostEditors } from 'vs/workbench/api/common/extHostTextEditors';
import { ExtHostTreeViews } from 'vs/workbench/api/common/extHostTreeViews';
import * as typeConverters from 'vs/workbench/api/common/extHostTypeConverters';
import * as extHostTypes from 'vs/workbench/api/common/extHostTypes';
import { ExtHostUrls } from 'vs/workbench/api/common/extHostUrls';
import { ExtHostWebviews } from 'vs/workbench/api/common/extHostWebview';
import { IExtHostWindow } from 'vs/workbench/api/common/extHostWindow';
import { IExtHostWorkspace } from 'vs/workbench/api/common/extHostWorkspace';
import { ProxyIdentifier } from 'vs/workbench/services/extensions/common/proxyIdentifier';
import { ExtensionDescriptionRegistry } from 'vs/workbench/services/extensions/common/extensionDescriptionRegistry';
import type * as vscode from 'vscode';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { values } from 'vs/base/common/collections'; // {{SQL CARBON EDIT}}
import { ExtHostEditorInsets } from 'vs/workbench/api/common/extHostCodeInsets';
import { ExtHostLabelService } from 'vs/workbench/api/common/extHostLabelService';
import { getRemoteName } from 'vs/platform/remote/common/remoteHosts';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IExtHostDecorations } from 'vs/workbench/api/common/extHostDecorations';
import { IExtHostTask } from 'vs/workbench/api/common/extHostTask';
// import { IExtHostDebugService } from 'vs/workbench/api/common/extHostDebugService'; {{SQL CARBON EDIT}} - Unused import
import { IExtHostSearch } from 'vs/workbench/api/common/extHostSearch';
import { ILoggerService, ILogService } from 'vs/platform/log/common/log';
import { IURITransformerService } from 'vs/workbench/api/common/extHostUriTransformerService';
import { IExtHostRpcService } from 'vs/workbench/api/common/extHostRpcService';
import { IExtHostInitDataService } from 'vs/workbench/api/common/extHostInitDataService';
import { ExtHostNotebookController } from 'vs/workbench/api/common/extHostNotebook';
import { ExtHostTheming } from 'vs/workbench/api/common/extHostTheming';
import { IExtHostTunnelService } from 'vs/workbench/api/common/extHostTunnelService';
import { IExtHostApiDeprecationService } from 'vs/workbench/api/common/extHostApiDeprecationService';
import { ExtHostAuthentication } from 'vs/workbench/api/common/extHostAuthentication';
import { ExtHostTimeline } from 'vs/workbench/api/common/extHostTimeline';
import { IExtensionStoragePaths } from 'vs/workbench/api/common/extHostStoragePaths';
import { IExtHostConsumerFileSystem } from 'vs/workbench/api/common/extHostFileSystemConsumer';
import { ExtHostWebviewViews } from 'vs/workbench/api/common/extHostWebviewView';
import { ExtHostCustomEditors } from 'vs/workbench/api/common/extHostCustomEditors';
import { ExtHostWebviewPanels } from 'vs/workbench/api/common/extHostWebviewPanels';
import { ExtHostBulkEdits } from 'vs/workbench/api/common/extHostBulkEdits';
import { IExtHostFileSystemInfo } from 'vs/workbench/api/common/extHostFileSystemInfo';
import { ExtHostTesting } from 'vs/workbench/api/common/extHostTesting';
import { ExtHostUriOpeners } from 'vs/workbench/api/common/extHostUriOpener';
import { IExtHostSecretState } from 'vs/workbench/api/common/exHostSecretState';
import { IExtHostEditorTabs } from 'vs/workbench/api/common/extHostEditorTabs';
import { IExtHostTelemetry } from 'vs/workbench/api/common/extHostTelemetry';
import { ExtHostNotebookKernels } from 'vs/workbench/api/common/extHostNotebookKernels';
import { TextSearchCompleteMessageType } from 'vs/workbench/services/search/common/searchExtTypes';
import { ExtHostNotebookRenderers } from 'vs/workbench/api/common/extHostNotebookRenderers';
import { Schemas } from 'vs/base/common/network';
import { matchesScheme } from 'vs/platform/opener/common/opener';
import { ExtHostNotebookEditors } from 'vs/workbench/api/common/extHostNotebookEditors';
import { ExtHostNotebookDocuments } from 'vs/workbench/api/common/extHostNotebookDocuments';
// import { ExtHostInteractive } from 'vs/workbench/api/common/extHostInteractive'; {{SQL CARBON EDIT}} - Unused import
import { combinedDisposable } from 'vs/base/common/lifecycle';
import { checkProposedApiEnabled, ExtensionIdentifierSet, isProposedApiEnabled } from 'vs/workbench/services/extensions/common/extensions';
import { DebugConfigurationProviderTriggerKind } from 'vs/workbench/contrib/debug/common/debug';
import { equalsIgnoreCase } from 'vs/base/common/strings';
import { CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES, CONFIG_WORKBENCH_USEVSCODENOTEBOOKS } from 'sql/workbench/common/constants'; // {{SQL CARBON EDIT}}

export interface IExtensionRegistries {
	mine: ExtensionDescriptionRegistry;
	all: ExtensionDescriptionRegistry;
}

export interface IExtensionApiFactory {
	(extension: IExtensionDescription, extensionInfo: IExtensionRegistries, configProvider: ExtHostConfigProvider): typeof vscode;
}

/**
 * This method instantiates and returns the extension API surface
 */
export function createApiFactoryAndRegisterActors(accessor: ServicesAccessor): IExtensionApiFactory {

	// services
	const initData = accessor.get(IExtHostInitDataService);
	const extHostFileSystemInfo = accessor.get(IExtHostFileSystemInfo);
	const extHostConsumerFileSystem = accessor.get(IExtHostConsumerFileSystem);
	const extensionService = accessor.get(IExtHostExtensionService);
	const extHostWorkspace = accessor.get(IExtHostWorkspace);
	const extHostTelemetry = accessor.get(IExtHostTelemetry);
	const extHostConfiguration = accessor.get(IExtHostConfiguration);
	const uriTransformer = accessor.get(IURITransformerService);
	const rpcProtocol = accessor.get(IExtHostRpcService);
	const extHostStorage = accessor.get(IExtHostStorage);
	const extensionStoragePaths = accessor.get(IExtensionStoragePaths);
	const extHostLoggerService = accessor.get(ILoggerService);
	const extHostLogService = accessor.get(ILogService);
	const extHostTunnelService = accessor.get(IExtHostTunnelService);
	const extHostApiDeprecation = accessor.get(IExtHostApiDeprecationService);
	const extHostWindow = accessor.get(IExtHostWindow);
	const extHostSecretState = accessor.get(IExtHostSecretState);
	const extHostEditorTabs = accessor.get(IExtHostEditorTabs);

	// register addressable instances
	rpcProtocol.set(ExtHostContext.ExtHostFileSystemInfo, extHostFileSystemInfo);
	rpcProtocol.set(ExtHostContext.ExtHostLogLevelServiceShape, <ExtHostLogLevelServiceShape><any>extHostLoggerService);
	rpcProtocol.set(ExtHostContext.ExtHostWorkspace, extHostWorkspace);
	rpcProtocol.set(ExtHostContext.ExtHostConfiguration, extHostConfiguration);
	rpcProtocol.set(ExtHostContext.ExtHostExtensionService, extensionService);
	rpcProtocol.set(ExtHostContext.ExtHostStorage, extHostStorage);
	rpcProtocol.set(ExtHostContext.ExtHostTunnelService, extHostTunnelService);
	rpcProtocol.set(ExtHostContext.ExtHostWindow, extHostWindow);
	rpcProtocol.set(ExtHostContext.ExtHostSecretState, extHostSecretState);
	rpcProtocol.set(ExtHostContext.ExtHostTelemetry, extHostTelemetry);
	rpcProtocol.set(ExtHostContext.ExtHostEditorTabs, extHostEditorTabs);

	// automatically create and register addressable instances
	const extHostDecorations = rpcProtocol.set(ExtHostContext.ExtHostDecorations, accessor.get(IExtHostDecorations));
	const extHostDocumentsAndEditors = rpcProtocol.set(ExtHostContext.ExtHostDocumentsAndEditors, accessor.get(IExtHostDocumentsAndEditors));
	const extHostCommands = rpcProtocol.set(ExtHostContext.ExtHostCommands, accessor.get(IExtHostCommands));
	const extHostTerminalService = rpcProtocol.set(ExtHostContext.ExtHostTerminalService, accessor.get(IExtHostTerminalService));
	// const extHostDebugService = rpcProtocol.set(ExtHostContext.ExtHostDebugService, accessor.get(IExtHostDebugService)); {{SQL CARBON EDIT}} remove debug service
	const extHostSearch = rpcProtocol.set(ExtHostContext.ExtHostSearch, accessor.get(IExtHostSearch));
	const extHostTask = rpcProtocol.set(ExtHostContext.ExtHostTask, accessor.get(IExtHostTask));
	const extHostOutputService = rpcProtocol.set(ExtHostContext.ExtHostOutputService, accessor.get(IExtHostOutputService));

	// manually create and register addressable instances
	const extHostUrls = rpcProtocol.set(ExtHostContext.ExtHostUrls, new ExtHostUrls(rpcProtocol));
	const extHostDocuments = rpcProtocol.set(ExtHostContext.ExtHostDocuments, new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors));
	const extHostDocumentContentProviders = rpcProtocol.set(ExtHostContext.ExtHostDocumentContentProviders, new ExtHostDocumentContentProvider(rpcProtocol, extHostDocumentsAndEditors, extHostLogService));
	const extHostDocumentSaveParticipant = rpcProtocol.set(ExtHostContext.ExtHostDocumentSaveParticipant, new ExtHostDocumentSaveParticipant(extHostLogService, extHostDocuments, rpcProtocol.getProxy(MainContext.MainThreadBulkEdits)));
	const extHostNotebook = rpcProtocol.set(ExtHostContext.ExtHostNotebook, new ExtHostNotebookController(rpcProtocol, extHostCommands, extHostDocumentsAndEditors, extHostDocuments, extensionStoragePaths));
	const extHostNotebookDocuments = rpcProtocol.set(ExtHostContext.ExtHostNotebookDocuments, new ExtHostNotebookDocuments(extHostNotebook));
	const extHostNotebookEditors = rpcProtocol.set(ExtHostContext.ExtHostNotebookEditors, new ExtHostNotebookEditors(extHostLogService, extHostNotebook));
	const extHostNotebookKernels = rpcProtocol.set(ExtHostContext.ExtHostNotebookKernels, new ExtHostNotebookKernels(rpcProtocol, initData, extHostNotebook, extHostCommands, extHostLogService));
	const extHostNotebookRenderers = rpcProtocol.set(ExtHostContext.ExtHostNotebookRenderers, new ExtHostNotebookRenderers(rpcProtocol, extHostNotebook));
	const extHostEditors = rpcProtocol.set(ExtHostContext.ExtHostEditors, new ExtHostEditors(rpcProtocol, extHostDocumentsAndEditors));
	const extHostTreeViews = rpcProtocol.set(ExtHostContext.ExtHostTreeViews, new ExtHostTreeViews(rpcProtocol.getProxy(MainContext.MainThreadTreeViews), extHostCommands, extHostLogService));
	const extHostEditorInsets = rpcProtocol.set(ExtHostContext.ExtHostEditorInsets, new ExtHostEditorInsets(rpcProtocol.getProxy(MainContext.MainThreadEditorInsets), extHostEditors, initData.remote));
	const extHostDiagnostics = rpcProtocol.set(ExtHostContext.ExtHostDiagnostics, new ExtHostDiagnostics(rpcProtocol, extHostLogService, extHostFileSystemInfo));
	const extHostLanguages = rpcProtocol.set(ExtHostContext.ExtHostLanguages, new ExtHostLanguages(rpcProtocol, extHostDocuments, extHostCommands.converter, uriTransformer));
	const extHostLanguageFeatures = rpcProtocol.set(ExtHostContext.ExtHostLanguageFeatures, new ExtHostLanguageFeatures(rpcProtocol, uriTransformer, extHostDocuments, extHostCommands, extHostDiagnostics, extHostLogService, extHostApiDeprecation));
	const extHostFileSystem = rpcProtocol.set(ExtHostContext.ExtHostFileSystem, new ExtHostFileSystem(rpcProtocol, extHostLanguageFeatures));
	const extHostFileSystemEvent = rpcProtocol.set(ExtHostContext.ExtHostFileSystemEventService, new ExtHostFileSystemEventService(rpcProtocol, extHostLogService, extHostDocumentsAndEditors));
	const extHostQuickOpen = rpcProtocol.set(ExtHostContext.ExtHostQuickOpen, createExtHostQuickOpen(rpcProtocol, extHostWorkspace, extHostCommands));
	const extHostSCM = rpcProtocol.set(ExtHostContext.ExtHostSCM, new ExtHostSCM(rpcProtocol, extHostCommands, extHostLogService));
	const extHostComment = rpcProtocol.set(ExtHostContext.ExtHostComments, createExtHostComments(rpcProtocol, extHostCommands, extHostDocuments));
	const extHostProgress = rpcProtocol.set(ExtHostContext.ExtHostProgress, new ExtHostProgress(rpcProtocol.getProxy(MainContext.MainThreadProgress)));
	const extHostLabelService = rpcProtocol.set(ExtHostContext.ExtHosLabelService, new ExtHostLabelService(rpcProtocol));
	const extHostTheming = rpcProtocol.set(ExtHostContext.ExtHostTheming, new ExtHostTheming(rpcProtocol));
	const extHostAuthentication = rpcProtocol.set(ExtHostContext.ExtHostAuthentication, new ExtHostAuthentication(rpcProtocol));
	const extHostTimeline = rpcProtocol.set(ExtHostContext.ExtHostTimeline, new ExtHostTimeline(rpcProtocol, extHostCommands));
	const extHostWebviews = rpcProtocol.set(ExtHostContext.ExtHostWebviews, new ExtHostWebviews(rpcProtocol, initData.remote, extHostWorkspace, extHostLogService, extHostApiDeprecation));
	const extHostWebviewPanels = rpcProtocol.set(ExtHostContext.ExtHostWebviewPanels, new ExtHostWebviewPanels(rpcProtocol, extHostWebviews, extHostWorkspace));
	const extHostCustomEditors = rpcProtocol.set(ExtHostContext.ExtHostCustomEditors, new ExtHostCustomEditors(rpcProtocol, extHostDocuments, extensionStoragePaths, extHostWebviews, extHostWebviewPanels));
	const extHostWebviewViews = rpcProtocol.set(ExtHostContext.ExtHostWebviewViews, new ExtHostWebviewViews(rpcProtocol, extHostWebviews));
	const extHostTesting = rpcProtocol.set(ExtHostContext.ExtHostTesting, new ExtHostTesting(rpcProtocol, extHostCommands));
	const extHostUriOpeners = rpcProtocol.set(ExtHostContext.ExtHostUriOpeners, new ExtHostUriOpeners(rpcProtocol));
	// rpcProtocol.set(ExtHostContext.ExtHostInteractive, new ExtHostInteractive(rpcProtocol, extHostNotebook, extHostDocumentsAndEditors, extHostCommands, extHostLogService)); {{SQL CARBON EDIT}} Disable interactive stuff until we need it

	// Check that no named customers are missing
	// {{SQL CARBON EDIT}} filter out the services we don't expose
	const filteredProxies: Set<ProxyIdentifier<any>> = new Set([
		ExtHostContext.ExtHostDebugService,
		ExtHostContext.ExtHostInteractive
	]);
	const expected: ProxyIdentifier<any>[] = values(ExtHostContext).filter(v => !filteredProxies.has(v));

	rpcProtocol.assertRegistered(expected);

	// Other instances
	const extHostBulkEdits = new ExtHostBulkEdits(rpcProtocol, extHostDocumentsAndEditors);
	const extHostClipboard = new ExtHostClipboard(rpcProtocol);
	const extHostMessageService = new ExtHostMessageService(rpcProtocol, extHostLogService);
	const extHostDialogs = new ExtHostDialogs(rpcProtocol);
	const extHostStatusBar = new ExtHostStatusBar(rpcProtocol, extHostCommands.converter);

	// Register API-ish commands
	ExtHostApiCommands.register(extHostCommands);

	return function (extension: IExtensionDescription, extensionInfo: IExtensionRegistries, configProvider: ExtHostConfigProvider): typeof vscode {
		// {{SQL CARBON EDIT}}
		const checkVSCodeNotebooksEnabled = (extension: IExtensionDescription) => {
			const usePreviewFeatures = configProvider.getConfiguration(CONFIG_WORKBENCH_ENABLEPREVIEWFEATURES);
			const useVSCodeNotebooks = configProvider.getConfiguration(CONFIG_WORKBENCH_USEVSCODENOTEBOOKS);
			const notebooksEnabled = usePreviewFeatures && useVSCodeNotebooks;
			if (!notebooksEnabled) {
				throw new Error(`Notebook extension '${extension.identifier.value}' is not supported. VS Code notebook functionality is currently disabled.`);
			}
		}

		// Check document selectors for being overly generic. Technically this isn't a problem but
		// in practice many extensions say they support `fooLang` but need fs-access to do so. Those
		// extension should specify then the `file`-scheme, e.g. `{ scheme: 'fooLang', language: 'fooLang' }`
		// We only inform once, it is not a warning because we just want to raise awareness and because
		// we cannot say if the extension is doing it right or wrong...
		const checkSelector = (function () {
			let done = !extension.isUnderDevelopment;
			function informOnce() {
				if (!done) {
					extHostLogService.info(`Extension '${extension.identifier.value}' uses a document selector without scheme. Learn more about this: https://go.microsoft.com/fwlink/?linkid=872305`);
					done = true;
				}
			}
			return function perform(selector: vscode.DocumentSelector): vscode.DocumentSelector {
				if (Array.isArray(selector)) {
					selector.forEach(perform);
				} else if (typeof selector === 'string') {
					informOnce();
				} else {
					const filter = selector as vscode.DocumentFilter; // TODO: microsoft/TypeScript#42768
					if (typeof filter.scheme === 'undefined') {
						informOnce();
					}
					if (typeof filter.exclusive === 'boolean') {
						checkProposedApiEnabled(extension, 'documentFiltersExclusive');
					}
				}
				return selector;
			};
		})();

		const authentication: typeof vscode.authentication = {
			getSession(providerId: string, scopes: readonly string[], options?: vscode.AuthenticationGetSessionOptions) {
				return extHostAuthentication.getSession(extension, providerId, scopes, options as any);
			},
			// TODO: remove this after GHPR and Codespaces move off of it
			async hasSession(providerId: string, scopes: readonly string[]) {
				checkProposedApiEnabled(extension, 'authSession');
				return !!(await extHostAuthentication.getSession(extension, providerId, scopes, { silent: true } as any));
			},
			get onDidChangeSessions(): Event<vscode.AuthenticationSessionsChangeEvent> {
				return extHostAuthentication.onDidChangeSessions;
			},
			registerAuthenticationProvider(id: string, label: string, provider: vscode.AuthenticationProvider, options?: vscode.AuthenticationProviderOptions): vscode.Disposable {
				return extHostAuthentication.registerAuthenticationProvider(id, label, provider, options);
			}
		};

		// namespace: commands
		const commands: typeof vscode.commands = {
			registerCommand(id: string, command: <T>(...args: any[]) => T | Thenable<T>, thisArgs?: any): vscode.Disposable {
				return extHostCommands.registerCommand(true, id, command, thisArgs, undefined, extension);
			},
			registerTextEditorCommand(id: string, callback: (textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit, ...args: any[]) => void, thisArg?: any): vscode.Disposable {
				return extHostCommands.registerCommand(true, id, (...args: any[]): any => {
					const activeTextEditor = extHostEditors.getActiveTextEditor();
					if (!activeTextEditor) {
						extHostLogService.warn('Cannot execute ' + id + ' because there is no active text editor.');
						return undefined;
					}

					return activeTextEditor.edit((edit: vscode.TextEditorEdit) => {
						callback.apply(thisArg, [activeTextEditor, edit, ...args]);

					}).then((result) => {
						if (!result) {
							extHostLogService.warn('Edits from command ' + id + ' were not applied.');
						}
					}, (err) => {
						extHostLogService.warn('An error occurred while running command ' + id, err);
					});
				}, undefined, undefined, extension);
			},
			registerDiffInformationCommand: (id: string, callback: (diff: vscode.LineChange[], ...args: any[]) => any, thisArg?: any): vscode.Disposable => {
				checkProposedApiEnabled(extension, 'diffCommand');
				return extHostCommands.registerCommand(true, id, async (...args: any[]): Promise<any> => {
					const activeTextEditor = extHostDocumentsAndEditors.activeEditor(true);
					if (!activeTextEditor) {
						extHostLogService.warn('Cannot execute ' + id + ' because there is no active text editor.');
						return undefined;
					}

					const diff = await extHostEditors.getDiffInformation(activeTextEditor.id);
					callback.apply(thisArg, [diff, ...args]);
				}, undefined, undefined, extension);
			},
			executeCommand<T>(id: string, ...args: any[]): Thenable<T> {
				return extHostCommands.executeCommand<T>(id, ...args);
			},
			getCommands(filterInternal: boolean = false): Thenable<string[]> {
				return extHostCommands.getCommands(filterInternal);
			}
		};

		// namespace: env
		const env: typeof vscode.env = {
			get machineId() { return initData.telemetryInfo.machineId; },
			get sessionId() { return initData.telemetryInfo.sessionId; },
			get language() { return initData.environment.appLanguage; },
			get appName() { return initData.environment.appName; },
			get appRoot() { return initData.environment.appRoot?.fsPath ?? ''; },
			get appHost() { return initData.environment.appHost; },
			get uriScheme() { return initData.environment.appUriScheme; },
			get clipboard(): vscode.Clipboard { return extHostClipboard.value; },
			get shell() {
				return extHostTerminalService.getDefaultShell(false);
			},
			get isTelemetryEnabled() {
				return extHostTelemetry.getTelemetryConfiguration();
			},
			get onDidChangeTelemetryEnabled(): Event<boolean> {
				return extHostTelemetry.onDidChangeTelemetryEnabled;
			},
			get telemetryConfiguration(): vscode.TelemetryConfiguration {
				checkProposedApiEnabled(extension, 'telemetry');
				return extHostTelemetry.getTelemetryDetails();
			},
			get onDidChangeTelemetryConfiguration(): Event<vscode.TelemetryConfiguration> {
				checkProposedApiEnabled(extension, 'telemetry');
				return extHostTelemetry.onDidChangeTelemetryConfiguration;
			},
			get isNewAppInstall() {
				const installAge = Date.now() - new Date(initData.telemetryInfo.firstSessionDate).getTime();
				return isNaN(installAge) ? false : installAge < 1000 * 60 * 60 * 24; // install age is less than a day
			},
			openExternal(uri: URI, options?: { allowContributedOpeners?: boolean | string }) {
				return extHostWindow.openUri(uri, {
					allowTunneling: !!initData.remote.authority,
					allowContributedOpeners: options?.allowContributedOpeners,
				});
			},
			async asExternalUri(uri: URI) {
				if (uri.scheme === initData.environment.appUriScheme) {
					return extHostUrls.createAppUri(uri);
				}

				try {
					return await extHostWindow.asExternalUri(uri, { allowTunneling: !!initData.remote.authority });
				} catch (err) {
					if (matchesScheme(uri, Schemas.http) || matchesScheme(uri, Schemas.https)) {
						return uri;
					}

					throw err;
				}
			},
			get remoteName() {
				return getRemoteName(initData.remote.authority);
			},
			get remoteAuthority() {
				checkProposedApiEnabled(extension, 'resolvers');
				return initData.remote.authority;
			},
			get uiKind() {
				return initData.uiKind;
			}
		};
		if (!initData.environment.extensionTestsLocationURI) {
			// allow to patch env-function when running tests
			Object.freeze(env);
		}

		// namespace: tests
		const tests: typeof vscode.tests = {
			createTestController(provider, label, refreshHandler?: (token: vscode.CancellationToken) => Thenable<void> | void) {
				return extHostTesting.createTestController(provider, label, refreshHandler);
			},
			createTestObserver() {
				checkProposedApiEnabled(extension, 'testObserver');
				return extHostTesting.createTestObserver();
			},
			runTests(provider) {
				checkProposedApiEnabled(extension, 'testObserver');
				return extHostTesting.runTests(provider);
			},
			get onDidChangeTestResults() {
				checkProposedApiEnabled(extension, 'testObserver');
				return extHostTesting.onResultsChanged;
			},
			get testResults() {
				checkProposedApiEnabled(extension, 'testObserver');
				return extHostTesting.results;
			},
		};

		// namespace: extensions
		const extensionKind = initData.remote.isRemote
			? extHostTypes.ExtensionKind.Workspace
			: extHostTypes.ExtensionKind.UI;

		const extensions: typeof vscode.extensions = {
			getExtension(extensionId: string, includeFromDifferentExtensionHosts?: boolean): vscode.Extension<any> | undefined {
				if (equalsIgnoreCase(extensionId, 'ms-vscode.references-view')) {
					extHostApiDeprecation.report(`The extension 'ms-vscode.references-view' has been renamed.`, extension, `Use 'vscode.references-view' instead.`);
					extensionId = 'vscode.references-view';
				}

				if (!isProposedApiEnabled(extension, 'extensionsAny')) {
					includeFromDifferentExtensionHosts = false;
				}
				const mine = extensionInfo.mine.getExtensionDescription(extensionId);
				if (mine) {
					return new Extension(extensionService, extension.identifier, mine, extensionKind, false);
				}
				if (includeFromDifferentExtensionHosts) {
					const foreign = extensionInfo.all.getExtensionDescription(extensionId);
					if (foreign) {
						return new Extension(extensionService, extension.identifier, foreign, extensionKind /* TODO@alexdima THIS IS WRONG */, true);
					}
				}
				return undefined;
			},
			get all(): vscode.Extension<any>[] {
				const result: vscode.Extension<any>[] = [];
				for (const desc of extensionInfo.mine.getAllExtensionDescriptions()) {
					result.push(new Extension(extensionService, extension.identifier, desc, extensionKind, false));
				}
				return result;
			},
			get allAcrossExtensionHosts(): vscode.Extension<any>[] {
				checkProposedApiEnabled(extension, 'extensionsAny');
				const local = new ExtensionIdentifierSet(extensionInfo.mine.getAllExtensionDescriptions().map(desc => desc.identifier));
				const result: vscode.Extension<any>[] = [];
				for (const desc of extensionInfo.all.getAllExtensionDescriptions()) {
					const isFromDifferentExtensionHost = !local.has(desc.identifier);
					result.push(new Extension(extensionService, extension.identifier, desc, extensionKind /* TODO@alexdima THIS IS WRONG */, isFromDifferentExtensionHost));
				}
				return result;
			},
			get onDidChange() {
				if (isProposedApiEnabled(extension, 'extensionsAny')) {
					return Event.any(extensionInfo.mine.onDidChange, extensionInfo.all.onDidChange);
				}
				return extensionInfo.mine.onDidChange;
			}
		};

		// namespace: languages
		const languages: typeof vscode.languages = {
			createDiagnosticCollection(name?: string): vscode.DiagnosticCollection {
				return extHostDiagnostics.createDiagnosticCollection(extension.identifier, name);
			},
			get onDidChangeDiagnostics() {
				return extHostDiagnostics.onDidChangeDiagnostics;
			},
			getDiagnostics: (resource?: vscode.Uri) => {
				return <any>extHostDiagnostics.getDiagnostics(resource);
			},
			getLanguages(): Thenable<string[]> {
				return extHostLanguages.getLanguages();
			},
			setTextDocumentLanguage(document: vscode.TextDocument, languageId: string): Thenable<vscode.TextDocument> {
				return extHostLanguages.changeLanguage(document.uri, languageId);
			},
			match(selector: vscode.DocumentSelector, document: vscode.TextDocument): number {
				const notebook = extHostDocuments.getDocumentData(document.uri)?.notebook;
				return score(typeConverters.LanguageSelector.from(selector), document.uri, document.languageId, true, notebook?.uri, notebook?.notebookType);
			},
			registerCodeActionsProvider(selector: vscode.DocumentSelector, provider: vscode.CodeActionProvider, metadata?: vscode.CodeActionProviderMetadata): vscode.Disposable {
				return extHostLanguageFeatures.registerCodeActionProvider(extension, checkSelector(selector), provider, metadata);
			},
			registerDocumentPasteEditProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentPasteEditProvider, metadata: vscode.DocumentPasteProviderMetadata): vscode.Disposable {
				checkProposedApiEnabled(extension, 'documentPaste');
				return extHostLanguageFeatures.registerDocumentPasteEditProvider(extension, checkSelector(selector), provider, metadata);
			},
			registerCodeLensProvider(selector: vscode.DocumentSelector, provider: vscode.CodeLensProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerCodeLensProvider(extension, checkSelector(selector), provider);
			},
			registerDefinitionProvider(selector: vscode.DocumentSelector, provider: vscode.DefinitionProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerDefinitionProvider(extension, checkSelector(selector), provider);
			},
			registerDeclarationProvider(selector: vscode.DocumentSelector, provider: vscode.DeclarationProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerDeclarationProvider(extension, checkSelector(selector), provider);
			},
			registerImplementationProvider(selector: vscode.DocumentSelector, provider: vscode.ImplementationProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerImplementationProvider(extension, checkSelector(selector), provider);
			},
			registerTypeDefinitionProvider(selector: vscode.DocumentSelector, provider: vscode.TypeDefinitionProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerTypeDefinitionProvider(extension, checkSelector(selector), provider);
			},
			registerHoverProvider(selector: vscode.DocumentSelector, provider: vscode.HoverProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerHoverProvider(extension, checkSelector(selector), provider, extension.identifier);
			},
			registerEvaluatableExpressionProvider(selector: vscode.DocumentSelector, provider: vscode.EvaluatableExpressionProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerEvaluatableExpressionProvider(extension, checkSelector(selector), provider, extension.identifier);
			},
			registerInlineValuesProvider(selector: vscode.DocumentSelector, provider: vscode.InlineValuesProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerInlineValuesProvider(extension, checkSelector(selector), provider, extension.identifier);
			},
			registerDocumentHighlightProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentHighlightProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerDocumentHighlightProvider(extension, checkSelector(selector), provider);
			},
			registerLinkedEditingRangeProvider(selector: vscode.DocumentSelector, provider: vscode.LinkedEditingRangeProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerLinkedEditingRangeProvider(extension, checkSelector(selector), provider);
			},
			registerReferenceProvider(selector: vscode.DocumentSelector, provider: vscode.ReferenceProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerReferenceProvider(extension, checkSelector(selector), provider);
			},
			registerRenameProvider(selector: vscode.DocumentSelector, provider: vscode.RenameProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerRenameProvider(extension, checkSelector(selector), provider);
			},
			registerDocumentSymbolProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentSymbolProvider, metadata?: vscode.DocumentSymbolProviderMetadata): vscode.Disposable {
				return extHostLanguageFeatures.registerDocumentSymbolProvider(extension, checkSelector(selector), provider, metadata);
			},
			registerWorkspaceSymbolProvider(provider: vscode.WorkspaceSymbolProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerWorkspaceSymbolProvider(extension, provider);
			},
			registerDocumentFormattingEditProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentFormattingEditProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerDocumentFormattingEditProvider(extension, checkSelector(selector), provider);
			},
			registerDocumentRangeFormattingEditProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentRangeFormattingEditProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerDocumentRangeFormattingEditProvider(extension, checkSelector(selector), provider);
			},
			registerOnTypeFormattingEditProvider(selector: vscode.DocumentSelector, provider: vscode.OnTypeFormattingEditProvider, firstTriggerCharacter: string, ...moreTriggerCharacters: string[]): vscode.Disposable {
				return extHostLanguageFeatures.registerOnTypeFormattingEditProvider(extension, checkSelector(selector), provider, [firstTriggerCharacter].concat(moreTriggerCharacters));
			},
			registerDocumentSemanticTokensProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentSemanticTokensProvider, legend: vscode.SemanticTokensLegend): vscode.Disposable {
				return extHostLanguageFeatures.registerDocumentSemanticTokensProvider(extension, checkSelector(selector), provider, legend);
			},
			registerDocumentRangeSemanticTokensProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentRangeSemanticTokensProvider, legend: vscode.SemanticTokensLegend): vscode.Disposable {
				return extHostLanguageFeatures.registerDocumentRangeSemanticTokensProvider(extension, checkSelector(selector), provider, legend);
			},
			registerSignatureHelpProvider(selector: vscode.DocumentSelector, provider: vscode.SignatureHelpProvider, firstItem?: string | vscode.SignatureHelpProviderMetadata, ...remaining: string[]): vscode.Disposable {
				if (typeof firstItem === 'object') {
					return extHostLanguageFeatures.registerSignatureHelpProvider(extension, checkSelector(selector), provider, firstItem);
				}
				return extHostLanguageFeatures.registerSignatureHelpProvider(extension, checkSelector(selector), provider, typeof firstItem === 'undefined' ? [] : [firstItem, ...remaining]);
			},
			registerCompletionItemProvider(selector: vscode.DocumentSelector, provider: vscode.CompletionItemProvider, ...triggerCharacters: string[]): vscode.Disposable {
				return extHostLanguageFeatures.registerCompletionItemProvider(extension, checkSelector(selector), provider, triggerCharacters);
			},
			registerInlineCompletionItemProvider(selector: vscode.DocumentSelector, provider: vscode.InlineCompletionItemProvider): vscode.Disposable {
				if (provider.handleDidShowCompletionItem) {
					checkProposedApiEnabled(extension, 'inlineCompletionsAdditions');
				}
				return extHostLanguageFeatures.registerInlineCompletionsProvider(extension, checkSelector(selector), provider);
			},
			registerInlineCompletionItemProviderNew(selector: vscode.DocumentSelector, provider: vscode.InlineCompletionItemProviderNew): vscode.Disposable {
				checkProposedApiEnabled(extension, 'inlineCompletionsNew');
				if (provider.handleDidShowCompletionItem && !isProposedApiEnabled(extension, 'inlineCompletionsAdditions')) {
					throw new Error(`When the method "handleDidShowCompletionItem" is implemented on a provider, the usage of the proposed api 'inlineCompletionsAdditions' must be declared!`);
				}
				return extHostLanguageFeatures.registerInlineCompletionsProviderNew(extension, checkSelector(selector), provider);
			},
			registerDocumentLinkProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentLinkProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerDocumentLinkProvider(extension, checkSelector(selector), provider);
			},
			registerColorProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentColorProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerColorProvider(extension, checkSelector(selector), provider);
			},
			registerFoldingRangeProvider(selector: vscode.DocumentSelector, provider: vscode.FoldingRangeProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerFoldingRangeProvider(extension, checkSelector(selector), provider);
			},
			registerSelectionRangeProvider(selector: vscode.DocumentSelector, provider: vscode.SelectionRangeProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerSelectionRangeProvider(extension, selector, provider);
			},
			registerCallHierarchyProvider(selector: vscode.DocumentSelector, provider: vscode.CallHierarchyProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerCallHierarchyProvider(extension, selector, provider);
			},
			registerTypeHierarchyProvider(selector: vscode.DocumentSelector, provider: vscode.TypeHierarchyProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerTypeHierarchyProvider(extension, selector, provider);
			},
			setLanguageConfiguration: (language: string, configuration: vscode.LanguageConfiguration): vscode.Disposable => {
				return extHostLanguageFeatures.setLanguageConfiguration(extension, language, configuration);
			},
			getTokenInformationAtPosition(doc: vscode.TextDocument, pos: vscode.Position) {
				checkProposedApiEnabled(extension, 'tokenInformation');
				return extHostLanguages.tokenAtPosition(doc, pos);
			},
			registerInlayHintsProvider(selector: vscode.DocumentSelector, provider: vscode.InlayHintsProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerInlayHintsProvider(extension, selector, provider);
			},
			createLanguageStatusItem(id: string, selector: vscode.DocumentSelector): vscode.LanguageStatusItem {
				return extHostLanguages.createLanguageStatusItem(extension, id, selector);
			},
			registerDocumentDropEditProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentDropEditProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerDocumentOnDropEditProvider(extension, selector, provider);
			}
		};

		// namespace: window
		const window: typeof vscode.window = {
			get activeTextEditor() {
				return extHostEditors.getActiveTextEditor();
			},
			get visibleTextEditors() {
				return extHostEditors.getVisibleTextEditors();
			},
			get activeTerminal() {
				return extHostTerminalService.activeTerminal;
			},
			get terminals() {
				return extHostTerminalService.terminals;
			},
			async showTextDocument(documentOrUri: vscode.TextDocument | vscode.Uri, columnOrOptions?: vscode.ViewColumn | vscode.TextDocumentShowOptions, preserveFocus?: boolean): Promise<vscode.TextEditor> {
				const document = await (URI.isUri(documentOrUri)
					? Promise.resolve(workspace.openTextDocument(documentOrUri))
					: Promise.resolve(<vscode.TextDocument>documentOrUri));

				return extHostEditors.showTextDocument(document, columnOrOptions, preserveFocus);
			},
			createTextEditorDecorationType(options: vscode.DecorationRenderOptions): vscode.TextEditorDecorationType {
				return extHostEditors.createTextEditorDecorationType(extension, options);
			},
			onDidChangeActiveTextEditor(listener, thisArg?, disposables?) {
				return extHostEditors.onDidChangeActiveTextEditor(listener, thisArg, disposables);
			},
			onDidChangeVisibleTextEditors(listener, thisArg, disposables) {
				return extHostEditors.onDidChangeVisibleTextEditors(listener, thisArg, disposables);
			},
			onDidChangeTextEditorSelection(listener: (e: vscode.TextEditorSelectionChangeEvent) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
				return extHostEditors.onDidChangeTextEditorSelection(listener, thisArgs, disposables);
			},
			onDidChangeTextEditorOptions(listener: (e: vscode.TextEditorOptionsChangeEvent) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
				return extHostEditors.onDidChangeTextEditorOptions(listener, thisArgs, disposables);
			},
			onDidChangeTextEditorVisibleRanges(listener: (e: vscode.TextEditorVisibleRangesChangeEvent) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) {
				return extHostEditors.onDidChangeTextEditorVisibleRanges(listener, thisArgs, disposables);
			},
			onDidChangeTextEditorViewColumn(listener, thisArg?, disposables?) {
				return extHostEditors.onDidChangeTextEditorViewColumn(listener, thisArg, disposables);
			},
			onDidCloseTerminal(listener, thisArg?, disposables?) {
				return extHostTerminalService.onDidCloseTerminal(listener, thisArg, disposables);
			},
			onDidOpenTerminal(listener, thisArg?, disposables?) {
				return extHostTerminalService.onDidOpenTerminal(listener, thisArg, disposables);
			},
			onDidChangeActiveTerminal(listener, thisArg?, disposables?) {
				return extHostTerminalService.onDidChangeActiveTerminal(listener, thisArg, disposables);
			},
			onDidChangeTerminalDimensions(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'terminalDimensions');
				return extHostTerminalService.onDidChangeTerminalDimensions(listener, thisArg, disposables);
			},
			onDidChangeTerminalState(listener, thisArg?, disposables?) {
				return extHostTerminalService.onDidChangeTerminalState(listener, thisArg, disposables);
			},
			onDidWriteTerminalData(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension, 'terminalDataWriteEvent');
				return extHostTerminalService.onDidWriteTerminalData(listener, thisArg, disposables);
			},
			get state() {
				return extHostWindow.state;
			},
			onDidChangeWindowState(listener, thisArg?, disposables?) {
				return extHostWindow.onDidChangeWindowState(listener, thisArg, disposables);
			},
			showInformationMessage(message: string, ...rest: Array<vscode.MessageOptions | string | vscode.MessageItem>) {
				return <Thenable<any>>extHostMessageService.showMessage(extension, Severity.Info, message, rest[0], <Array<string | vscode.MessageItem>>rest.slice(1));
			},
			showWarningMessage(message: string, ...rest: Array<vscode.MessageOptions | string | vscode.MessageItem>) {
				return <Thenable<any>>extHostMessageService.showMessage(extension, Severity.Warning, message, rest[0], <Array<string | vscode.MessageItem>>rest.slice(1));
			},
			showErrorMessage(message: string, ...rest: Array<vscode.MessageOptions | string | vscode.MessageItem>) {
				return <Thenable<any>>extHostMessageService.showMessage(extension, Severity.Error, message, rest[0], <Array<string | vscode.MessageItem>>rest.slice(1));
			},
			showQuickPick(items: any, options?: vscode.QuickPickOptions, token?: vscode.CancellationToken): any {
				return extHostQuickOpen.showQuickPick(items, options, token);
			},
			showWorkspaceFolderPick(options?: vscode.WorkspaceFolderPickOptions) {
				return extHostQuickOpen.showWorkspaceFolderPick(options);
			},
			showInputBox(options?: vscode.InputBoxOptions, token?: vscode.CancellationToken) {
				return extHostQuickOpen.showInput(options, token);
			},
			showOpenDialog(options) {
				return extHostDialogs.showOpenDialog(options);
			},
			showSaveDialog(options) {
				return extHostDialogs.showSaveDialog(options);
			},
			createStatusBarItem(alignmentOrId?: vscode.StatusBarAlignment | string, priorityOrAlignment?: number | vscode.StatusBarAlignment, priorityArg?: number): vscode.StatusBarItem {
				let id: string | undefined;
				let alignment: number | undefined;
				let priority: number | undefined;

				if (typeof alignmentOrId === 'string') {
					id = alignmentOrId;
					alignment = priorityOrAlignment;
					priority = priorityArg;
				} else {
					alignment = alignmentOrId;
					priority = priorityOrAlignment;
				}

				return extHostStatusBar.createStatusBarEntry(extension, id, alignment, priority);
			},
			setStatusBarMessage(text: string, timeoutOrThenable?: number | Thenable<any>): vscode.Disposable {
				return extHostStatusBar.setStatusBarMessage(text, timeoutOrThenable);
			},
			withScmProgress<R>(task: (progress: vscode.Progress<number>) => Thenable<R>) {
				extHostApiDeprecation.report('window.withScmProgress', extension,
					`Use 'withProgress' instead.`);

				return extHostProgress.withProgress(extension, { location: extHostTypes.ProgressLocation.SourceControl }, (progress, token) => task({ report(n: number) { /*noop*/ } }));
			},
			withProgress<R>(options: vscode.ProgressOptions, task: (progress: vscode.Progress<{ message?: string; worked?: number }>, token: vscode.CancellationToken) => Thenable<R>) {
				return extHostProgress.withProgress(extension, options, task);
			},
			createOutputChannel(name: string, languageId?: string): vscode.OutputChannel {
				return extHostOutputService.createOutputChannel(name, languageId, extension);
			},
			createWebviewPanel(viewType: string, title: string, showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean }, options?: vscode.WebviewPanelOptions & vscode.WebviewOptions): vscode.WebviewPanel {
				return extHostWebviewPanels.createWebviewPanel(extension, viewType, title, showOptions, options);
			},
			createWebviewTextEditorInset(editor: vscode.TextEditor, line: number, height: number, options?: vscode.WebviewOptions): vscode.WebviewEditorInset {
				checkProposedApiEnabled(extension, 'editorInsets');
				return extHostEditorInsets.createWebviewEditorInset(editor, line, height, options, extension);
			},
			createTerminal(nameOrOptions?: vscode.TerminalOptions | vscode.ExtensionTerminalOptions | string, shellPath?: string, shellArgs?: readonly string[] | string): vscode.Terminal {
				if (typeof nameOrOptions === 'object') {
					if ('pty' in nameOrOptions) {
						return extHostTerminalService.createExtensionTerminal(nameOrOptions);
					}
					return extHostTerminalService.createTerminalFromOptions(nameOrOptions);
				}
				return extHostTerminalService.createTerminal(nameOrOptions, shellPath, shellArgs);
			},
			registerTerminalLinkProvider(provider: vscode.TerminalLinkProvider): vscode.Disposable {
				return extHostTerminalService.registerLinkProvider(provider);
			},
			registerTerminalProfileProvider(id: string, provider: vscode.TerminalProfileProvider): vscode.Disposable {
				return extHostTerminalService.registerProfileProvider(extension, id, provider);
			},
			registerTreeDataProvider(viewId: string, treeDataProvider: vscode.TreeDataProvider<any>): vscode.Disposable {
				return extHostTreeViews.registerTreeDataProvider(viewId, treeDataProvider, extension);
			},
			createTreeView(viewId: string, options: { treeDataProvider: vscode.TreeDataProvider<any> }): vscode.TreeView<any> {
				return extHostTreeViews.createTreeView(viewId, options, extension);
			},
			registerWebviewPanelSerializer: (viewType: string, serializer: vscode.WebviewPanelSerializer) => {
				return extHostWebviewPanels.registerWebviewPanelSerializer(extension, viewType, serializer);
			},
			registerCustomEditorProvider: (viewType: string, provider: vscode.CustomTextEditorProvider | vscode.CustomReadonlyEditorProvider, options: { webviewOptions?: vscode.WebviewPanelOptions; supportsMultipleEditorsPerDocument?: boolean } = {}) => {
				return extHostCustomEditors.registerCustomEditorProvider(extension, viewType, provider, options);
			},
			registerFileDecorationProvider(provider: vscode.FileDecorationProvider) {
				return extHostDecorations.registerFileDecorationProvider(provider, extension.identifier);
			},
			registerUriHandler(handler: vscode.UriHandler) {
				return extHostUrls.registerUriHandler(extension.identifier, handler);
			},
			createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
				return extHostQuickOpen.createQuickPick(extension);
			},
			createInputBox(): vscode.InputBox {
				return extHostQuickOpen.createInputBox(extension);
			},
			get activeColorTheme(): vscode.ColorTheme {
				return extHostTheming.activeColorTheme;
			},
			onDidChangeActiveColorTheme(listener, thisArg?, disposables?) {
				return extHostTheming.onDidChangeActiveColorTheme(listener, thisArg, disposables);
			},
			registerWebviewViewProvider(viewId: string, provider: vscode.WebviewViewProvider, options?: {
				webviewOptions?: {
					retainContextWhenHidden?: boolean;
				};
			}) {
				return extHostWebviewViews.registerWebviewViewProvider(extension, viewId, provider, options?.webviewOptions);
			},
			get activeNotebookEditor(): vscode.NotebookEditor | undefined {
				checkProposedApiEnabled(extension, 'notebookEditor');
				return extHostNotebook.activeNotebookEditor;
			},
			onDidChangeActiveNotebookEditor(listener, thisArgs?, disposables?) {
				checkProposedApiEnabled(extension, 'notebookEditor');
				return extHostNotebook.onDidChangeActiveNotebookEditor(listener, thisArgs, disposables);
			},
			get visibleNotebookEditors() {
				checkProposedApiEnabled(extension, 'notebookEditor');
				return extHostNotebook.visibleNotebookEditors;
			},
			get onDidChangeVisibleNotebookEditors() {
				checkProposedApiEnabled(extension, 'notebookEditor');
				return extHostNotebook.onDidChangeVisibleNotebookEditors;
			},
			onDidChangeNotebookEditorSelection(listener, thisArgs?, disposables?) {
				checkProposedApiEnabled(extension, 'notebookEditor');
				return extHostNotebookEditors.onDidChangeNotebookEditorSelection(listener, thisArgs, disposables);
			},
			onDidChangeNotebookEditorVisibleRanges(listener, thisArgs?, disposables?) {
				checkProposedApiEnabled(extension, 'notebookEditor');
				return extHostNotebookEditors.onDidChangeNotebookEditorVisibleRanges(listener, thisArgs, disposables);
			},
			showNotebookDocument(uriOrDocument, options?) {
				checkProposedApiEnabled(extension, 'notebookEditor');
				checkVSCodeNotebooksEnabled(extension); // {{SQL CARBON EDIT}}
				return extHostNotebook.showNotebookDocument(uriOrDocument, options);
			},
			registerExternalUriOpener(id: string, opener: vscode.ExternalUriOpener, metadata: vscode.ExternalUriOpenerMetadata) {
				checkProposedApiEnabled(extension, 'externalUriOpener');
				return extHostUriOpeners.registerExternalUriOpener(extension.identifier, id, opener, metadata);
			},
			get tabGroups(): vscode.TabGroups {
				return extHostEditorTabs.tabGroups;
			},
		};

		// namespace: workspace

		const workspace: typeof vscode.workspace = {
			get rootPath() {
				extHostApiDeprecation.report('workspace.rootPath', extension,
					`Please use 'workspace.workspaceFolders' instead. More details: https://aka.ms/vscode-eliminating-rootpath`);

				return extHostWorkspace.getPath();
			},
			set rootPath(value) {
				throw errors.readonly();
			},
			getWorkspaceFolder(resource) {
				return extHostWorkspace.getWorkspaceFolder(resource);
			},
			get workspaceFolders() {
				return extHostWorkspace.getWorkspaceFolders();
			},
			get name() {
				return extHostWorkspace.name;
			},
			set name(value) {
				throw errors.readonly();
			},
			get workspaceFile() {
				return extHostWorkspace.workspaceFile;
			},
			set workspaceFile(value) {
				throw errors.readonly();
			},
			updateWorkspaceFolders: (index, deleteCount, ...workspaceFoldersToAdd) => {
				return extHostWorkspace.updateWorkspaceFolders(extension, index, deleteCount || 0, ...workspaceFoldersToAdd);
			},
			onDidChangeWorkspaceFolders: function (listener, thisArgs?, disposables?) {
				return extHostWorkspace.onDidChangeWorkspace(listener, thisArgs, disposables);
			},
			asRelativePath: (pathOrUri, includeWorkspace?) => {
				return extHostWorkspace.getRelativePath(pathOrUri, includeWorkspace);
			},
			findFiles: (include, exclude, maxResults?, token?) => {
				// Note, undefined/null have different meanings on "exclude"
				return extHostWorkspace.findFiles(include, exclude, maxResults, extension.identifier, token);
			},
			findTextInFiles: (query: vscode.TextSearchQuery, optionsOrCallback: vscode.FindTextInFilesOptions | ((result: vscode.TextSearchResult) => void), callbackOrToken?: vscode.CancellationToken | ((result: vscode.TextSearchResult) => void), token?: vscode.CancellationToken) => {
				checkProposedApiEnabled(extension, 'findTextInFiles');
				let options: vscode.FindTextInFilesOptions;
				let callback: (result: vscode.TextSearchResult) => void;

				if (typeof optionsOrCallback === 'object') {
					options = optionsOrCallback;
					callback = callbackOrToken as (result: vscode.TextSearchResult) => void;
				} else {
					options = {};
					callback = optionsOrCallback;
					token = callbackOrToken as vscode.CancellationToken;
				}

				return extHostWorkspace.findTextInFiles(query, options || {}, callback, extension.identifier, token);
			},
			saveAll: (includeUntitled?) => {
				return extHostWorkspace.saveAll(includeUntitled);
			},
			applyEdit(edit: vscode.WorkspaceEdit): Thenable<boolean> {
				return extHostBulkEdits.applyWorkspaceEdit(edit, extension);
			},
			createFileSystemWatcher: (pattern, ignoreCreate, ignoreChange, ignoreDelete): vscode.FileSystemWatcher => {
				return extHostFileSystemEvent.createFileSystemWatcher(extHostWorkspace, extension, pattern, ignoreCreate, ignoreChange, ignoreDelete);
			},
			get textDocuments() {
				return extHostDocuments.getAllDocumentData().map(data => data.document);
			},
			set textDocuments(value) {
				throw errors.readonly();
			},
			openTextDocument(uriOrFileNameOrOptions?: vscode.Uri | string | { language?: string; content?: string }) {
				let uriPromise: Thenable<URI>;

				const options = uriOrFileNameOrOptions as { language?: string; content?: string };
				if (typeof uriOrFileNameOrOptions === 'string') {
					uriPromise = Promise.resolve(URI.file(uriOrFileNameOrOptions));
				} else if (URI.isUri(uriOrFileNameOrOptions)) {
					uriPromise = Promise.resolve(uriOrFileNameOrOptions);
				} else if (!options || typeof options === 'object') {
					uriPromise = extHostDocuments.createDocumentData(options);
				} else {
					throw new Error('illegal argument - uriOrFileNameOrOptions');
				}

				return uriPromise.then(uri => {
					return extHostDocuments.ensureDocumentData(uri).then(documentData => {
						return documentData.document;
					});
				});
			},
			onDidOpenTextDocument: (listener, thisArgs?, disposables?) => {
				return extHostDocuments.onDidAddDocument(listener, thisArgs, disposables);
			},
			onDidCloseTextDocument: (listener, thisArgs?, disposables?) => {
				return extHostDocuments.onDidRemoveDocument(listener, thisArgs, disposables);
			},
			onDidChangeTextDocument: (listener, thisArgs?, disposables?) => {
				return extHostDocuments.onDidChangeDocument(listener, thisArgs, disposables);
			},
			onDidSaveTextDocument: (listener, thisArgs?, disposables?) => {
				return extHostDocuments.onDidSaveDocument(listener, thisArgs, disposables);
			},
			onWillSaveTextDocument: (listener, thisArgs?, disposables?) => {
				return extHostDocumentSaveParticipant.getOnWillSaveTextDocumentEvent(extension)(listener, thisArgs, disposables);
			},
			get notebookDocuments(): vscode.NotebookDocument[] {
				return extHostNotebook.notebookDocuments.map(d => d.apiNotebook);
			},
			async openNotebookDocument(uriOrType?: URI | string, content?: vscode.NotebookData) {
				checkVSCodeNotebooksEnabled(extension); // {{SQL CARBON EDIT}}
				let uri: URI;
				if (URI.isUri(uriOrType)) {
					uri = uriOrType;
					await extHostNotebook.openNotebookDocument(uriOrType);
				} else if (typeof uriOrType === 'string') {
					uri = URI.revive(await extHostNotebook.createNotebookDocument({ viewType: uriOrType, content }));
				} else {
					throw new Error('Invalid arguments');
				}
				return extHostNotebook.getNotebookDocument(uri).apiNotebook;
			},
			onDidSaveNotebookDocument(listener, thisArg, disposables) {
				return extHostNotebookDocuments.onDidSaveNotebookDocument(listener, thisArg, disposables);
			},
			onDidChangeNotebookDocument(listener, thisArg, disposables) {
				return extHostNotebookDocuments.onDidChangeNotebookDocument(listener, thisArg, disposables);
			},
			get onDidOpenNotebookDocument(): Event<vscode.NotebookDocument> {
				return extHostNotebook.onDidOpenNotebookDocument;
			},
			get onDidCloseNotebookDocument(): Event<vscode.NotebookDocument> {
				return extHostNotebook.onDidCloseNotebookDocument;
			},
			registerNotebookSerializer(viewType: string, serializer: vscode.NotebookSerializer, options?: vscode.NotebookDocumentContentOptions, registration?: vscode.NotebookRegistrationData) {
				return extHostNotebook.registerNotebookSerializer(extension, viewType, serializer, options, isProposedApiEnabled(extension, 'notebookLiveShare') ? registration : undefined);
			},
			registerNotebookContentProvider: (viewType: string, provider: vscode.NotebookContentProvider, options?: vscode.NotebookDocumentContentOptions, registration?: vscode.NotebookRegistrationData) => {
				checkProposedApiEnabled(extension, 'notebookContentProvider');
				return extHostNotebook.registerNotebookContentProvider(extension, viewType, provider, options, isProposedApiEnabled(extension, 'notebookLiveShare') ? registration : undefined);
			},
			onDidChangeConfiguration: (listener: (_: any) => any, thisArgs?: any, disposables?: extHostTypes.Disposable[]) => {
				return configProvider.onDidChangeConfiguration(listener, thisArgs, disposables);
			},
			getConfiguration(section?: string, scope?: vscode.ConfigurationScope | null): vscode.WorkspaceConfiguration {
				scope = arguments.length === 1 ? undefined : scope;
				return configProvider.getConfiguration(section, scope, extension);
			},
			registerTextDocumentContentProvider(scheme: string, provider: vscode.TextDocumentContentProvider) {
				return extHostDocumentContentProviders.registerTextDocumentContentProvider(scheme, provider);
			},
			registerTaskProvider: (type: string, provider: vscode.TaskProvider) => {
				extHostApiDeprecation.report('window.registerTaskProvider', extension,
					`Use the corresponding function on the 'tasks' namespace instead`);

				return extHostTask.registerTaskProvider(extension, type, provider);
			},
			registerFileSystemProvider(scheme, provider, options) {
				return combinedDisposable(
					extHostFileSystem.registerFileSystemProvider(extension, scheme, provider, options),
					extHostConsumerFileSystem.addFileSystemProvider(scheme, provider)
				);
			},
			get fs() {
				return extHostConsumerFileSystem.value;
			},
			registerFileSearchProvider: (scheme: string, provider: vscode.FileSearchProvider) => {
				checkProposedApiEnabled(extension, 'fileSearchProvider');
				return extHostSearch.registerFileSearchProvider(scheme, provider);
			},
			registerTextSearchProvider: (scheme: string, provider: vscode.TextSearchProvider) => {
				checkProposedApiEnabled(extension, 'textSearchProvider');
				return extHostSearch.registerTextSearchProvider(scheme, provider);
			},
			registerRemoteAuthorityResolver: (authorityPrefix: string, resolver: vscode.RemoteAuthorityResolver) => {
				checkProposedApiEnabled(extension, 'resolvers');
				return extensionService.registerRemoteAuthorityResolver(authorityPrefix, resolver);
			},
			registerResourceLabelFormatter: (formatter: vscode.ResourceLabelFormatter) => {
				checkProposedApiEnabled(extension, 'resolvers');
				return extHostLabelService.$registerResourceLabelFormatter(formatter);
			},
			onDidCreateFiles: (listener, thisArg, disposables) => {
				return extHostFileSystemEvent.onDidCreateFile(listener, thisArg, disposables);
			},
			onDidDeleteFiles: (listener, thisArg, disposables) => {
				return extHostFileSystemEvent.onDidDeleteFile(listener, thisArg, disposables);
			},
			onDidRenameFiles: (listener, thisArg, disposables) => {
				return extHostFileSystemEvent.onDidRenameFile(listener, thisArg, disposables);
			},
			onWillCreateFiles: (listener: (e: vscode.FileWillCreateEvent) => any, thisArg?: any, disposables?: vscode.Disposable[]) => {
				return extHostFileSystemEvent.getOnWillCreateFileEvent(extension)(listener, thisArg, disposables);
			},
			onWillDeleteFiles: (listener: (e: vscode.FileWillDeleteEvent) => any, thisArg?: any, disposables?: vscode.Disposable[]) => {
				return extHostFileSystemEvent.getOnWillDeleteFileEvent(extension)(listener, thisArg, disposables);
			},
			onWillRenameFiles: (listener: (e: vscode.FileWillRenameEvent) => any, thisArg?: any, disposables?: vscode.Disposable[]) => {
				return extHostFileSystemEvent.getOnWillRenameFileEvent(extension)(listener, thisArg, disposables);
			},
			openTunnel: (forward: vscode.TunnelOptions) => {
				checkProposedApiEnabled(extension, 'resolvers');
				return extHostTunnelService.openTunnel(extension, forward).then(value => {
					if (!value) {
						throw new Error('cannot open tunnel');
					}
					return value;
				});
			},
			get tunnels() {
				checkProposedApiEnabled(extension, 'resolvers');
				return extHostTunnelService.getTunnels();
			},
			onDidChangeTunnels: (listener, thisArg?, disposables?) => {
				checkProposedApiEnabled(extension, 'resolvers');
				return extHostTunnelService.onDidChangeTunnels(listener, thisArg, disposables);
			},
			registerPortAttributesProvider: (portSelector: { pid?: number; portRange?: [number, number]; commandMatcher?: RegExp }, provider: vscode.PortAttributesProvider) => {
				checkProposedApiEnabled(extension, 'portsAttributes');
				return extHostTunnelService.registerPortsAttributesProvider(portSelector, provider);
			},
			registerTimelineProvider: (scheme: string | string[], provider: vscode.TimelineProvider) => {
				checkProposedApiEnabled(extension, 'timeline');
				return extHostTimeline.registerTimelineProvider(scheme, provider, extension.identifier, extHostCommands.converter);
			},
			get isTrusted() {
				return extHostWorkspace.trusted;
			},
			requestWorkspaceTrust: (options?: vscode.WorkspaceTrustRequestOptions) => {
				checkProposedApiEnabled(extension, 'workspaceTrust');
				return extHostWorkspace.requestWorkspaceTrust(options);
			},
			onDidGrantWorkspaceTrust: (listener, thisArgs?, disposables?) => {
				return extHostWorkspace.onDidGrantWorkspaceTrust(listener, thisArgs, disposables);
			}
		};

		// namespace: scm
		const scm: typeof vscode.scm = {
			get inputBox() {
				extHostApiDeprecation.report('scm.inputBox', extension,
					`Use 'SourceControl.inputBox' instead`);

				return extHostSCM.getLastInputBox(extension)!; // Strict null override - Deprecated api
			},
			createSourceControl(id: string, label: string, rootUri?: vscode.Uri) {
				return extHostSCM.createSourceControl(extension, id, label, rootUri);
			}
		};

		// namespace: comments
		const comments: typeof vscode.comments = {
			createCommentController(id: string, label: string) {
				return extHostComment.createCommentController(extension, id, label);
			}
		};

		// namespace: debug
		const debug: typeof vscode.debug = {
			get activeDebugSession() {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.activeDebugSession; {{SQL CARBON EDIT}} Removed
			},
			get activeDebugConsole() {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.activeDebugConsole; {{SQL CARBON EDIT}} Removed
			},
			get breakpoints() {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.breakpoints; {{SQL CARBON EDIT}} Removed
			},
			onDidStartDebugSession(listener, thisArg?, disposables?) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.onDidStartDebugSession(listener, thisArg, disposables); {{SQL CARBON EDIT}} Removed
			},
			onDidTerminateDebugSession(listener, thisArg?, disposables?) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.onDidTerminateDebugSession(listener, thisArg, disposables); {{SQL CARBON EDIT}} Removed
			},
			onDidChangeActiveDebugSession(listener, thisArg?, disposables?) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.onDidChangeActiveDebugSession(listener, thisArg, disposables); {{SQL CARBON EDIT}} Removed
			},
			onDidReceiveDebugSessionCustomEvent(listener, thisArg?, disposables?) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.onDidReceiveDebugSessionCustomEvent(listener, thisArg, disposables); {{SQL CARBON EDIT}} Removed
			},
			onDidChangeBreakpoints(listener, thisArgs?, disposables?) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.onDidChangeBreakpoints(listener, thisArgs, disposables); {{SQL CARBON EDIT}} Removed
			},
			registerDebugConfigurationProvider(debugType: string, provider: vscode.DebugConfigurationProvider, triggerKind?: vscode.DebugConfigurationProviderTriggerKind) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				//return extHostDebugService.registerDebugConfigurationProvider(debugType, provider, triggerKind || extHostTypes.DebugConfigurationProviderTriggerKind.Initial);
			},
			registerDebugAdapterDescriptorFactory(debugType: string, factory: vscode.DebugAdapterDescriptorFactory) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.registerDebugAdapterDescriptorFactory(extension, debugType, factory); {{SQL CARBON EDIT}} Removed
			},
			registerDebugAdapterTrackerFactory(debugType: string, factory: vscode.DebugAdapterTrackerFactory) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.registerDebugAdapterTrackerFactory(debugType, factory); {{SQL CARBON EDIT}} Removed
			},
			startDebugging(folder: vscode.WorkspaceFolder | undefined, nameOrConfig: string | vscode.DebugConfiguration, parentSessionOrOptions?: vscode.DebugSession | vscode.DebugSessionOptions) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				/* {{SQL CARBON EDIT}} Removed
				if (!parentSessionOrOptions || (typeof parentSessionOrOptions === 'object' && 'configuration' in parentSessionOrOptions)) {
					return extHostDebugService.startDebugging(folder, nameOrConfig, { parentSession: parentSessionOrOptions });
				}
				return extHostDebugService.startDebugging(folder, nameOrConfig, parentSessionOrOptions || {});
				*/
			},
			stopDebugging(session?: vscode.DebugSession) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.stopDebugging(session); {{SQL CARBON EDIT}} Removed
			},
			addBreakpoints(breakpoints: readonly vscode.Breakpoint[]) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.addBreakpoints(breakpoints); {{SQL CARBON EDIT}} Removed
			},
			removeBreakpoints(breakpoints: readonly vscode.Breakpoint[]) {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.removeBreakpoints(breakpoints); {{SQL CARBON EDIT}} Removed
			},
			asDebugSourceUri(source: vscode.DebugProtocolSource, session?: vscode.DebugSession): vscode.Uri {
				extHostLogService.warn('Debug API is disabled in Azure Data Studio');
				return undefined!;
				// return extHostDebugService.asDebugSourceUri(source, session); {{SQL CARBON EDIT}} Removed
			}
		};

		const tasks: typeof vscode.tasks = {
			registerTaskProvider: (type: string, provider: vscode.TaskProvider) => {
				return extHostTask.registerTaskProvider(extension, type, provider);
			},
			fetchTasks: (filter?: vscode.TaskFilter): Thenable<vscode.Task[]> => {
				return extHostTask.fetchTasks(filter);
			},
			executeTask: (task: vscode.Task): Thenable<vscode.TaskExecution> => {
				return extHostTask.executeTask(extension, task);
			},
			get taskExecutions(): vscode.TaskExecution[] {
				return extHostTask.taskExecutions;
			},
			onDidStartTask: (listeners, thisArgs?, disposables?) => {
				return extHostTask.onDidStartTask(listeners, thisArgs, disposables);
			},
			onDidEndTask: (listeners, thisArgs?, disposables?) => {
				return extHostTask.onDidEndTask(listeners, thisArgs, disposables);
			},
			onDidStartTaskProcess: (listeners, thisArgs?, disposables?) => {
				return extHostTask.onDidStartTaskProcess(listeners, thisArgs, disposables);
			},
			onDidEndTaskProcess: (listeners, thisArgs?, disposables?) => {
				return extHostTask.onDidEndTaskProcess(listeners, thisArgs, disposables);
			}
		};

		// namespace: notebook
		const notebooks: typeof vscode.notebooks = {
			createNotebookController(id: string, notebookType: string, label: string, handler?, rendererScripts?: vscode.NotebookRendererScript[]) {
				return extHostNotebookKernels.createNotebookController(extension, id, notebookType, label, handler, isProposedApiEnabled(extension, 'notebookMessaging') ? rendererScripts : undefined);
			},
			registerNotebookCellStatusBarItemProvider: (notebookType: string, provider: vscode.NotebookCellStatusBarItemProvider) => {
				return extHostNotebook.registerNotebookCellStatusBarItemProvider(extension, notebookType, provider);
			},
			createRendererMessaging(rendererId) {
				return extHostNotebookRenderers.createRendererMessaging(extension, rendererId);
			},
			onDidChangeNotebookCellExecutionState(listener, thisArgs?, disposables?) {
				checkProposedApiEnabled(extension, 'notebookCellExecutionState');
				return extHostNotebookKernels.onDidChangeNotebookCellExecutionState(listener, thisArgs, disposables);
			}
		};

		return <typeof vscode>{
			// {{SQL CARBON EDIT}} - Expose the VS Code version here for extensions that rely on it
			version: initData.vscodeVersion,
			// namespaces
			authentication,
			commands,
			comments,
			debug,
			env,
			extensions,
			languages,
			notebooks,
			scm,
			tasks,
			tests,
			window,
			workspace,
			// types
			Breakpoint: extHostTypes.Breakpoint,
			CallHierarchyIncomingCall: extHostTypes.CallHierarchyIncomingCall,
			CallHierarchyItem: extHostTypes.CallHierarchyItem,
			CallHierarchyOutgoingCall: extHostTypes.CallHierarchyOutgoingCall,
			CancellationError: errors.CancellationError,
			CancellationTokenSource: CancellationTokenSource,
			CandidatePortSource: CandidatePortSource,
			CodeAction: extHostTypes.CodeAction,
			CodeActionKind: extHostTypes.CodeActionKind,
			CodeActionTriggerKind: extHostTypes.CodeActionTriggerKind,
			CodeLens: extHostTypes.CodeLens,
			Color: extHostTypes.Color,
			ColorInformation: extHostTypes.ColorInformation,
			ColorPresentation: extHostTypes.ColorPresentation,
			ColorThemeKind: extHostTypes.ColorThemeKind,
			CommentMode: extHostTypes.CommentMode,
			CommentThreadCollapsibleState: extHostTypes.CommentThreadCollapsibleState,
			CommentThreadState: extHostTypes.CommentThreadState,
			CompletionItem: extHostTypes.CompletionItem,
			CompletionItemKind: extHostTypes.CompletionItemKind,
			CompletionItemTag: extHostTypes.CompletionItemTag,
			CompletionList: extHostTypes.CompletionList,
			CompletionTriggerKind: extHostTypes.CompletionTriggerKind,
			ConfigurationTarget: extHostTypes.ConfigurationTarget,
			CustomExecution: extHostTypes.CustomExecution,
			DebugAdapterExecutable: extHostTypes.DebugAdapterExecutable,
			DebugAdapterInlineImplementation: extHostTypes.DebugAdapterInlineImplementation,
			DebugAdapterNamedPipeServer: extHostTypes.DebugAdapterNamedPipeServer,
			DebugAdapterServer: extHostTypes.DebugAdapterServer,
			DebugConfigurationProviderTriggerKind: DebugConfigurationProviderTriggerKind,
			DebugConsoleMode: extHostTypes.DebugConsoleMode,
			DecorationRangeBehavior: extHostTypes.DecorationRangeBehavior,
			Diagnostic: extHostTypes.Diagnostic,
			DiagnosticRelatedInformation: extHostTypes.DiagnosticRelatedInformation,
			DiagnosticSeverity: extHostTypes.DiagnosticSeverity,
			DiagnosticTag: extHostTypes.DiagnosticTag,
			Disposable: extHostTypes.Disposable,
			DocumentHighlight: extHostTypes.DocumentHighlight,
			DocumentHighlightKind: extHostTypes.DocumentHighlightKind,
			DocumentLink: extHostTypes.DocumentLink,
			DocumentSymbol: extHostTypes.DocumentSymbol,
			EndOfLine: extHostTypes.EndOfLine,
			EnvironmentVariableMutatorType: extHostTypes.EnvironmentVariableMutatorType,
			EvaluatableExpression: extHostTypes.EvaluatableExpression,
			InlineValueText: extHostTypes.InlineValueText,
			InlineValueVariableLookup: extHostTypes.InlineValueVariableLookup,
			InlineValueEvaluatableExpression: extHostTypes.InlineValueEvaluatableExpression,
			InlineCompletionTriggerKind: extHostTypes.InlineCompletionTriggerKind,
			InlineCompletionTriggerKindNew: extHostTypes.InlineCompletionTriggerKindNew,
			EventEmitter: Emitter,
			ExtensionKind: extHostTypes.ExtensionKind,
			ExtensionMode: extHostTypes.ExtensionMode,
			ExternalUriOpenerPriority: extHostTypes.ExternalUriOpenerPriority,
			FileChangeType: extHostTypes.FileChangeType,
			FileDecoration: extHostTypes.FileDecoration,
			FileSystemError: extHostTypes.FileSystemError,
			FileType: files.FileType,
			FilePermission: files.FilePermission,
			FoldingRange: extHostTypes.FoldingRange,
			FoldingRangeKind: extHostTypes.FoldingRangeKind,
			FunctionBreakpoint: extHostTypes.FunctionBreakpoint,
			InlineCompletionItem: extHostTypes.InlineSuggestion,
			InlineCompletionItemNew: extHostTypes.InlineSuggestionNew,
			InlineCompletionList: extHostTypes.InlineSuggestionList,
			InlineCompletionListNew: extHostTypes.InlineSuggestionsNew,
			Hover: extHostTypes.Hover,
			IndentAction: languageConfiguration.IndentAction,
			Location: extHostTypes.Location,
			MarkdownString: extHostTypes.MarkdownString,
			OverviewRulerLane: OverviewRulerLane,
			ParameterInformation: extHostTypes.ParameterInformation,
			PortAutoForwardAction: extHostTypes.PortAutoForwardAction,
			Position: extHostTypes.Position,
			ProcessExecution: extHostTypes.ProcessExecution,
			ProgressLocation: extHostTypes.ProgressLocation,
			QuickInputButtons: extHostTypes.QuickInputButtons,
			Range: extHostTypes.Range,
			RelativePattern: extHostTypes.RelativePattern,
			Selection: extHostTypes.Selection,
			SelectionRange: extHostTypes.SelectionRange,
			SemanticTokens: extHostTypes.SemanticTokens,
			SemanticTokensBuilder: extHostTypes.SemanticTokensBuilder,
			SemanticTokensEdit: extHostTypes.SemanticTokensEdit,
			SemanticTokensEdits: extHostTypes.SemanticTokensEdits,
			SemanticTokensLegend: extHostTypes.SemanticTokensLegend,
			ShellExecution: extHostTypes.ShellExecution,
			ShellQuoting: extHostTypes.ShellQuoting,
			SignatureHelp: extHostTypes.SignatureHelp,
			SignatureHelpTriggerKind: extHostTypes.SignatureHelpTriggerKind,
			SignatureInformation: extHostTypes.SignatureInformation,
			SnippetString: extHostTypes.SnippetString,
			SourceBreakpoint: extHostTypes.SourceBreakpoint,
			StandardTokenType: extHostTypes.StandardTokenType,
			StatusBarAlignment: extHostTypes.StatusBarAlignment,
			SymbolInformation: extHostTypes.SymbolInformation,
			SymbolKind: extHostTypes.SymbolKind,
			SymbolTag: extHostTypes.SymbolTag,
			Task: extHostTypes.Task,
			TaskGroup: extHostTypes.TaskGroup,
			TaskPanelKind: extHostTypes.TaskPanelKind,
			TaskRevealKind: extHostTypes.TaskRevealKind,
			TaskScope: extHostTypes.TaskScope,
			TerminalLink: extHostTypes.TerminalLink,
			TerminalLocation: extHostTypes.TerminalLocation,
			TerminalProfile: extHostTypes.TerminalProfile,
			TextDocumentSaveReason: extHostTypes.TextDocumentSaveReason,
			TextEdit: extHostTypes.TextEdit,
			TextEditorCursorStyle: TextEditorCursorStyle,
			TextEditorLineNumbersStyle: extHostTypes.TextEditorLineNumbersStyle,
			TextEditorRevealType: extHostTypes.TextEditorRevealType,
			TextEditorSelectionChangeKind: extHostTypes.TextEditorSelectionChangeKind,
			TextDocumentChangeReason: extHostTypes.TextDocumentChangeReason,
			ThemeColor: extHostTypes.ThemeColor,
			ThemeIcon: extHostTypes.ThemeIcon,
			TreeItem: extHostTypes.TreeItem,
			TreeItemCollapsibleState: extHostTypes.TreeItemCollapsibleState,
			TypeHierarchyItem: extHostTypes.TypeHierarchyItem,
			UIKind: UIKind,
			Uri: URI,
			ViewColumn: extHostTypes.ViewColumn,
			WorkspaceEdit: extHostTypes.WorkspaceEdit,
			// proposed api types
			DocumentDropEdit: extHostTypes.DocumentDropEdit,
			DocumentPasteEdit: extHostTypes.DocumentPasteEdit,
			InlayHint: extHostTypes.InlayHint,
			InlayHintLabelPart: extHostTypes.InlayHintLabelPart,
			InlayHintKind: extHostTypes.InlayHintKind,
			RemoteAuthorityResolverError: extHostTypes.RemoteAuthorityResolverError,
			ResolvedAuthority: extHostTypes.ResolvedAuthority,
			SourceControlInputBoxValidationType: extHostTypes.SourceControlInputBoxValidationType,
			ExtensionRuntime: extHostTypes.ExtensionRuntime,
			TimelineItem: extHostTypes.TimelineItem,
			NotebookRange: extHostTypes.NotebookRange,
			NotebookCellKind: extHostTypes.NotebookCellKind,
			NotebookCellExecutionState: extHostTypes.NotebookCellExecutionState,
			NotebookCellData: extHostTypes.NotebookCellData,
			NotebookData: extHostTypes.NotebookData,
			NotebookRendererScript: extHostTypes.NotebookRendererScript,
			NotebookCellStatusBarAlignment: extHostTypes.NotebookCellStatusBarAlignment,
			NotebookEditorRevealType: extHostTypes.NotebookEditorRevealType,
			NotebookCellOutput: extHostTypes.NotebookCellOutput,
			NotebookCellOutputItem: extHostTypes.NotebookCellOutputItem,
			NotebookCellStatusBarItem: extHostTypes.NotebookCellStatusBarItem,
			NotebookControllerAffinity: extHostTypes.NotebookControllerAffinity,
			NotebookEdit: extHostTypes.NotebookEdit,
			PortAttributes: extHostTypes.PortAttributes,
			LinkedEditingRanges: extHostTypes.LinkedEditingRanges,
			TestResultState: extHostTypes.TestResultState,
			TestRunRequest: extHostTypes.TestRunRequest,
			TestMessage: extHostTypes.TestMessage,
			TestTag: extHostTypes.TestTag,
			TestRunProfileKind: extHostTypes.TestRunProfileKind,
			TextSearchCompleteMessageType: TextSearchCompleteMessageType,
			DataTransfer: extHostTypes.DataTransfer,
			DataTransferItem: extHostTypes.DataTransferItem,
			CoveredCount: extHostTypes.CoveredCount,
			FileCoverage: extHostTypes.FileCoverage,
			StatementCoverage: extHostTypes.StatementCoverage,
			BranchCoverage: extHostTypes.BranchCoverage,
			FunctionCoverage: extHostTypes.FunctionCoverage,
			WorkspaceTrustState: extHostTypes.WorkspaceTrustState,
			LanguageStatusSeverity: extHostTypes.LanguageStatusSeverity,
			QuickPickItemKind: extHostTypes.QuickPickItemKind,
			InputBoxValidationSeverity: extHostTypes.InputBoxValidationSeverity,
			TabInputText: extHostTypes.TextTabInput,
			TabInputTextDiff: extHostTypes.TextDiffTabInput,
			TabInputTextMerge: extHostTypes.TextMergeTabInput,
			TabInputCustom: extHostTypes.CustomEditorTabInput,
			TabInputNotebook: extHostTypes.NotebookEditorTabInput,
			TabInputNotebookDiff: extHostTypes.NotebookDiffEditorTabInput,
			TabInputWebview: extHostTypes.WebviewEditorTabInput,
			TabInputTerminal: extHostTypes.TerminalEditorTabInput,
			TabInputInteractiveWindow: extHostTypes.InteractiveWindowInput,
			TerminalExitReason: extHostTypes.TerminalExitReason
		};
	};
}
