/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import * as errors from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import * as path from 'vs/base/common/path';
import Severity from 'vs/base/common/severity';
import { URI } from 'vs/base/common/uri';
import { TextEditorCursorStyle } from 'vs/editor/common/config/editorOptions';
import { OverviewRulerLane } from 'vs/editor/common/model';
import * as languageConfiguration from 'vs/editor/common/modes/languageConfiguration';
import { score } from 'vs/editor/common/modes/languageSelector';
import * as files from 'vs/platform/files/common/files';
import { ExtHostContext, MainContext, ExtHostLogServiceShape, UIKind } from 'vs/workbench/api/common/extHost.protocol';
import { ExtHostApiCommands } from 'vs/workbench/api/common/extHostApiCommands';
import { ExtHostClipboard } from 'vs/workbench/api/common/extHostClipboard';
import { IExtHostCommands } from 'vs/workbench/api/common/extHostCommands';
import { ExtHostComments } from 'vs/workbench/api/common/extHostComments';
import { ExtHostConfigProvider, IExtHostConfiguration } from 'vs/workbench/api/common/extHostConfiguration';
import { ExtHostDiagnostics } from 'vs/workbench/api/common/extHostDiagnostics';
import { ExtHostDialogs } from 'vs/workbench/api/common/extHostDialogs';
import { ExtHostDocumentContentProvider } from 'vs/workbench/api/common/extHostDocumentContentProviders';
import { ExtHostDocumentSaveParticipant } from 'vs/workbench/api/common/extHostDocumentSaveParticipant';
import { ExtHostDocuments } from 'vs/workbench/api/common/extHostDocuments';
import { IExtHostDocumentsAndEditors } from 'vs/workbench/api/common/extHostDocumentsAndEditors';
import { IExtHostExtensionService } from 'vs/workbench/api/common/extHostExtensionService';
import { ExtHostFileSystem } from 'vs/workbench/api/common/extHostFileSystem';
import { ExtHostFileSystemEventService } from 'vs/workbench/api/common/extHostFileSystemEventService';
import { ExtHostLanguageFeatures } from 'vs/workbench/api/common/extHostLanguageFeatures';
import { ExtHostLanguages } from 'vs/workbench/api/common/extHostLanguages';
import { ExtHostMessageService } from 'vs/workbench/api/common/extHostMessageService';
import { IExtHostOutputService } from 'vs/workbench/api/common/extHostOutput';
import { ExtHostProgress } from 'vs/workbench/api/common/extHostProgress';
import { ExtHostQuickOpen } from 'vs/workbench/api/common/extHostQuickOpen';
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
import { ExtHostWindow } from 'vs/workbench/api/common/extHostWindow';
import { IExtHostWorkspace } from 'vs/workbench/api/common/extHostWorkspace';
import { throwProposedApiError, checkProposedApiEnabled } from 'vs/workbench/services/extensions/common/extensions';
import { ProxyIdentifier } from 'vs/workbench/services/extensions/common/proxyIdentifier';
import { ExtensionDescriptionRegistry } from 'vs/workbench/services/extensions/common/extensionDescriptionRegistry';
import * as vscode from 'vscode';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { originalFSPath, joinPath } from 'vs/base/common/resources';
import { values } from 'vs/base/common/collections';
import { ExtHostEditorInsets } from 'vs/workbench/api/common/extHostCodeInsets';
import { ExtHostLabelService } from 'vs/workbench/api/common/extHostLabelService';
import { getRemoteName } from 'vs/platform/remote/common/remoteHosts';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { IExtHostDecorations } from 'vs/workbench/api/common/extHostDecorations';
// import { IExtHostTask } from 'vs/workbench/api/common/extHostTask';
// import { IExtHostDebugService } from 'vs/workbench/api/common/extHostDebugService';
import { IExtHostSearch } from 'vs/workbench/api/common/extHostSearch';
import { ILogService } from 'vs/platform/log/common/log';
import { IURITransformerService } from 'vs/workbench/api/common/extHostUriTransformerService';
import { IExtHostRpcService } from 'vs/workbench/api/common/extHostRpcService';
import { IExtHostInitDataService } from 'vs/workbench/api/common/extHostInitDataService';
import { find } from 'vs/base/common/arrays';
import { ExtHostTheming } from 'vs/workbench/api/common/extHostTheming';
import { IExtHostTunnelService } from 'vs/workbench/api/common/extHostTunnelService';
import { IExtHostApiDeprecationService } from 'vs/workbench/api/common/extHostApiDeprecationService';
import { ExtHostAuthentication } from 'vs/workbench/api/common/extHostAuthentication';
import { ExtHostTimeline } from 'vs/workbench/api/common/extHostTimeline';

export interface IExtensionApiFactory {
	(extension: IExtensionDescription, registry: ExtensionDescriptionRegistry, configProvider: ExtHostConfigProvider): typeof vscode;
}

/**
 * This method instantiates and returns the extension API surface
 */
export function createApiFactoryAndRegisterActors(accessor: ServicesAccessor): IExtensionApiFactory {

	// services
	const initData = accessor.get(IExtHostInitDataService);
	const extensionService = accessor.get(IExtHostExtensionService);
	const extHostWorkspace = accessor.get(IExtHostWorkspace);
	const extHostConfiguration = accessor.get(IExtHostConfiguration);
	const uriTransformer = accessor.get(IURITransformerService);
	const rpcProtocol = accessor.get(IExtHostRpcService);
	const extHostStorage = accessor.get(IExtHostStorage);
	const extHostLogService = accessor.get(ILogService);
	const extHostTunnelService = accessor.get(IExtHostTunnelService);
	const extHostApiDeprecation = accessor.get(IExtHostApiDeprecationService);

	// register addressable instances
	rpcProtocol.set(ExtHostContext.ExtHostLogService, <ExtHostLogServiceShape><any>extHostLogService);
	rpcProtocol.set(ExtHostContext.ExtHostWorkspace, extHostWorkspace);
	rpcProtocol.set(ExtHostContext.ExtHostConfiguration, extHostConfiguration);
	rpcProtocol.set(ExtHostContext.ExtHostExtensionService, extensionService);
	rpcProtocol.set(ExtHostContext.ExtHostStorage, extHostStorage);
	rpcProtocol.set(ExtHostContext.ExtHostTunnelService, extHostTunnelService);

	// automatically create and register addressable instances
	const extHostDecorations = rpcProtocol.set(ExtHostContext.ExtHostDecorations, accessor.get(IExtHostDecorations));
	const extHostDocumentsAndEditors = rpcProtocol.set(ExtHostContext.ExtHostDocumentsAndEditors, accessor.get(IExtHostDocumentsAndEditors));
	const extHostCommands = rpcProtocol.set(ExtHostContext.ExtHostCommands, accessor.get(IExtHostCommands));
	const extHostTerminalService = rpcProtocol.set(ExtHostContext.ExtHostTerminalService, accessor.get(IExtHostTerminalService));
	// const extHostDebugService = rpcProtocol.set(ExtHostContext.ExtHostDebugService, accessor.get(IExtHostDebugService)); {{SQL CARBON EDIT}} remove debug service
	const extHostSearch = rpcProtocol.set(ExtHostContext.ExtHostSearch, accessor.get(IExtHostSearch));
	// const extHostTask = rpcProtocol.set(ExtHostContext.ExtHostTask, accessor.get(IExtHostTask)); {{SQL CARBON EDIT}} remove tasks service
	const extHostOutputService = rpcProtocol.set(ExtHostContext.ExtHostOutputService, accessor.get(IExtHostOutputService));

	// manually create and register addressable instances
	const extHostWebviews = rpcProtocol.set(ExtHostContext.ExtHostWebviews, new ExtHostWebviews(rpcProtocol, initData.environment, extHostWorkspace, extHostLogService));
	const extHostUrls = rpcProtocol.set(ExtHostContext.ExtHostUrls, new ExtHostUrls(rpcProtocol));
	const extHostDocuments = rpcProtocol.set(ExtHostContext.ExtHostDocuments, new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors));
	const extHostDocumentContentProviders = rpcProtocol.set(ExtHostContext.ExtHostDocumentContentProviders, new ExtHostDocumentContentProvider(rpcProtocol, extHostDocumentsAndEditors, extHostLogService));
	const extHostDocumentSaveParticipant = rpcProtocol.set(ExtHostContext.ExtHostDocumentSaveParticipant, new ExtHostDocumentSaveParticipant(extHostLogService, extHostDocuments, rpcProtocol.getProxy(MainContext.MainThreadTextEditors)));
	const extHostEditors = rpcProtocol.set(ExtHostContext.ExtHostEditors, new ExtHostEditors(rpcProtocol, extHostDocumentsAndEditors));
	const extHostTreeViews = rpcProtocol.set(ExtHostContext.ExtHostTreeViews, new ExtHostTreeViews(rpcProtocol.getProxy(MainContext.MainThreadTreeViews), extHostCommands, extHostLogService));
	const extHostEditorInsets = rpcProtocol.set(ExtHostContext.ExtHostEditorInsets, new ExtHostEditorInsets(rpcProtocol.getProxy(MainContext.MainThreadEditorInsets), extHostEditors, initData.environment));
	const extHostDiagnostics = rpcProtocol.set(ExtHostContext.ExtHostDiagnostics, new ExtHostDiagnostics(rpcProtocol, extHostLogService));
	const extHostLanguageFeatures = rpcProtocol.set(ExtHostContext.ExtHostLanguageFeatures, new ExtHostLanguageFeatures(rpcProtocol, uriTransformer, extHostDocuments, extHostCommands, extHostDiagnostics, extHostLogService, extHostApiDeprecation));
	const extHostFileSystem = rpcProtocol.set(ExtHostContext.ExtHostFileSystem, new ExtHostFileSystem(rpcProtocol, extHostLanguageFeatures));
	const extHostFileSystemEvent = rpcProtocol.set(ExtHostContext.ExtHostFileSystemEventService, new ExtHostFileSystemEventService(rpcProtocol, extHostLogService, extHostDocumentsAndEditors));
	const extHostQuickOpen = rpcProtocol.set(ExtHostContext.ExtHostQuickOpen, new ExtHostQuickOpen(rpcProtocol, extHostWorkspace, extHostCommands));
	const extHostSCM = rpcProtocol.set(ExtHostContext.ExtHostSCM, new ExtHostSCM(rpcProtocol, extHostCommands, extHostLogService));
	const extHostComment = rpcProtocol.set(ExtHostContext.ExtHostComments, new ExtHostComments(rpcProtocol, extHostCommands, extHostDocuments));
	const extHostWindow = rpcProtocol.set(ExtHostContext.ExtHostWindow, new ExtHostWindow(rpcProtocol));
	const extHostProgress = rpcProtocol.set(ExtHostContext.ExtHostProgress, new ExtHostProgress(rpcProtocol.getProxy(MainContext.MainThreadProgress)));
	const extHostLabelService = rpcProtocol.set(ExtHostContext.ExtHostLabelService, new ExtHostLabelService(rpcProtocol));
	const extHostTheming = rpcProtocol.set(ExtHostContext.ExtHostTheming, new ExtHostTheming(rpcProtocol));
	const extHostAuthentication = rpcProtocol.set(ExtHostContext.ExtHostAuthentication, new ExtHostAuthentication(rpcProtocol));
	const extHostTimeline = rpcProtocol.set(ExtHostContext.ExtHostTimeline, new ExtHostTimeline(rpcProtocol));

	// Check that no named customers are missing
	// {{SQL CARBON EDIT}} filter out the services we don't expose
	const filtered: ProxyIdentifier<any>[] = [ExtHostContext.ExtHostDebugService, ExtHostContext.ExtHostTask];
	const expected: ProxyIdentifier<any>[] = values(ExtHostContext).filter(v => !find(filtered, x => x === v));
	rpcProtocol.assertRegistered(expected);

	// Other instances
	const extHostClipboard = new ExtHostClipboard(rpcProtocol);
	const extHostMessageService = new ExtHostMessageService(rpcProtocol, extHostLogService);
	const extHostDialogs = new ExtHostDialogs(rpcProtocol);
	const extHostStatusBar = new ExtHostStatusBar(rpcProtocol);
	const extHostLanguages = new ExtHostLanguages(rpcProtocol, extHostDocuments);

	// Register API-ish commands
	ExtHostApiCommands.register(extHostCommands);

	return function (extension: IExtensionDescription, extensionRegistry: ExtensionDescriptionRegistry, configProvider: ExtHostConfigProvider): typeof vscode {

		// Check document selectors for being overly generic. Technically this isn't a problem but
		// in practice many extensions say they support `fooLang` but need fs-access to do so. Those
		// extension should specify then the `file`-scheme, e.g. `{ scheme: 'fooLang', language: 'fooLang' }`
		// We only inform once, it is not a warning because we just want to raise awareness and because
		// we cannot say if the extension is doing it right or wrong...
		const checkSelector = (function () {
			let done = (!extension.isUnderDevelopment);
			function informOnce(selector: vscode.DocumentSelector) {
				if (!done) {
					extHostLogService.info(`Extension '${extension.identifier.value}' uses a document selector without scheme. Learn more about this: https://go.microsoft.com/fwlink/?linkid=872305`);
					done = true;
				}
			}
			return function perform(selector: vscode.DocumentSelector): vscode.DocumentSelector {
				if (Array.isArray(selector)) {
					selector.forEach(perform);
				} else if (typeof selector === 'string') {
					informOnce(selector);
				} else {
					if (typeof selector.scheme === 'undefined') {
						informOnce(selector);
					}
					if (!extension.enableProposedApi && typeof selector.exclusive === 'boolean') {
						throwProposedApiError(extension);
					}
				}
				return selector;
			};
		})();

		const authentication: typeof vscode.authentication = {
			registerAuthenticationProvider(provider: vscode.AuthenticationProvider): vscode.Disposable {
				return extHostAuthentication.registerAuthenticationProvider(provider);
			},
			get providers() {
				return extHostAuthentication.providers(extension);
			},
			get onDidChangeAuthenticationProviders(): Event<vscode.AuthenticationProvidersChangeEvent> {
				return extHostAuthentication.onDidChangeAuthenticationProviders;
			}
		};

		// namespace: commands
		const commands: typeof vscode.commands = {
			registerCommand(id: string, command: <T>(...args: any[]) => T | Thenable<T>, thisArgs?: any): vscode.Disposable {
				return extHostCommands.registerCommand(true, id, command, thisArgs);
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
				});
			},
			registerDiffInformationCommand: (id: string, callback: (diff: vscode.LineChange[], ...args: any[]) => any, thisArg?: any): vscode.Disposable => {
				checkProposedApiEnabled(extension);
				return extHostCommands.registerCommand(true, id, async (...args: any[]): Promise<any> => {
					const activeTextEditor = extHostEditors.getActiveTextEditor();
					if (!activeTextEditor) {
						extHostLogService.warn('Cannot execute ' + id + ' because there is no active text editor.');
						return undefined;
					}

					const diff = await extHostEditors.getDiffInformation(activeTextEditor.id);
					callback.apply(thisArg, [diff, ...args]);
				});
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
			get appRoot() { return initData.environment.appRoot!.fsPath; },
			get uriScheme() { return initData.environment.appUriScheme; },
			get logLevel() {
				checkProposedApiEnabled(extension);
				return typeConverters.LogLevel.to(extHostLogService.getLevel());
			},
			get onDidChangeLogLevel() {
				checkProposedApiEnabled(extension);
				return Event.map(extHostLogService.onDidChangeLogLevel, l => typeConverters.LogLevel.to(l));
			},
			get clipboard(): vscode.Clipboard {
				return extHostClipboard;
			},
			get shell() {
				return extHostTerminalService.getDefaultShell(false, configProvider);
			},
			openExternal(uri: URI) {
				return extHostWindow.openUri(uri, { allowTunneling: !!initData.remote.authority });
			},
			asExternalUri(uri: URI) {
				if (uri.scheme === initData.environment.appUriScheme) {
					return extHostUrls.createAppUri(uri);
				}

				return extHostWindow.asExternalUri(uri, { allowTunneling: !!initData.remote.authority });
			},
			get remoteName() {
				return getRemoteName(initData.remote.authority);
			},
			get uiKind() {
				return initData.uiKind;
			}
		};
		if (!initData.environment.extensionTestsLocationURI) {
			// allow to patch env-function when running tests
			Object.freeze(env);
		}

		const extensionKind = initData.remote.isRemote
			? extHostTypes.ExtensionKind.Workspace
			: extHostTypes.ExtensionKind.UI;

		// namespace: extensions
		const extensions: typeof vscode.extensions = {
			getExtension(extensionId: string): Extension<any> | undefined {
				const desc = extensionRegistry.getExtensionDescription(extensionId);
				if (desc) {
					return new Extension(extensionService, extension.identifier, desc, extensionKind);
				}
				return undefined;
			},
			get all(): Extension<any>[] {
				return extensionRegistry.getAllExtensionDescriptions().map((desc) => new Extension(extensionService, extension.identifier, desc, extensionKind));
			},
			get onDidChange() {
				return extensionRegistry.onDidChange;
			}
		};

		// namespace: languages
		const languages: typeof vscode.languages = {
			createDiagnosticCollection(name?: string): vscode.DiagnosticCollection {
				return extHostDiagnostics.createDiagnosticCollection(name);
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
				return score(typeConverters.LanguageSelector.from(selector), document.uri, document.languageId, true);
			},
			registerCodeActionsProvider(selector: vscode.DocumentSelector, provider: vscode.CodeActionProvider, metadata?: vscode.CodeActionProviderMetadata): vscode.Disposable {
				return extHostLanguageFeatures.registerCodeActionProvider(extension, checkSelector(selector), provider, metadata);
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
			registerDocumentHighlightProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentHighlightProvider): vscode.Disposable {
				return extHostLanguageFeatures.registerDocumentHighlightProvider(extension, checkSelector(selector), provider);
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
				checkProposedApiEnabled(extension);
				return extHostLanguageFeatures.registerDocumentSemanticTokensProvider(extension, checkSelector(selector), provider, legend);
			},
			registerDocumentRangeSemanticTokensProvider(selector: vscode.DocumentSelector, provider: vscode.DocumentRangeSemanticTokensProvider, legend: vscode.SemanticTokensLegend): vscode.Disposable {
				checkProposedApiEnabled(extension);
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
			setLanguageConfiguration: (language: string, configuration: vscode.LanguageConfiguration): vscode.Disposable => {
				return extHostLanguageFeatures.setLanguageConfiguration(extension, language, configuration);
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
			showTextDocument(documentOrUri: vscode.TextDocument | vscode.Uri, columnOrOptions?: vscode.ViewColumn | vscode.TextDocumentShowOptions, preserveFocus?: boolean): Thenable<vscode.TextEditor> {
				let documentPromise: Promise<vscode.TextDocument>;
				if (URI.isUri(documentOrUri)) {
					documentPromise = Promise.resolve(workspace.openTextDocument(documentOrUri));
				} else {
					documentPromise = Promise.resolve(<vscode.TextDocument>documentOrUri);
				}
				return documentPromise.then(document => {
					return extHostEditors.showTextDocument(document, columnOrOptions, preserveFocus);
				});
			},
			createTextEditorDecorationType(options: vscode.DecorationRenderOptions): vscode.TextEditorDecorationType {
				return extHostEditors.createTextEditorDecorationType(options);
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
				checkProposedApiEnabled(extension);
				return extHostTerminalService.onDidChangeTerminalDimensions(listener, thisArg, disposables);
			},
			onDidWriteTerminalData(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension);
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
				return extHostQuickOpen.showQuickPick(items, !!extension.enableProposedApi, options, token);
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
			createStatusBarItem(alignmentOrOptions?: vscode.StatusBarAlignment | vscode.window.StatusBarItemOptions, priority?: number): vscode.StatusBarItem {
				let id: string;
				let name: string;
				let alignment: number | undefined;

				if (alignmentOrOptions && typeof alignmentOrOptions !== 'number') {
					id = alignmentOrOptions.id;
					name = alignmentOrOptions.name;
					alignment = alignmentOrOptions.alignment;
					priority = alignmentOrOptions.priority;
				} else {
					id = extension.identifier.value;
					name = nls.localize('extensionLabel', "{0} (Extension)", extension.displayName || extension.name);
					alignment = alignmentOrOptions as number; // {{SQL CARBON EDIT}} strict-null-check
					priority = priority;
				}

				return extHostStatusBar.createStatusBarEntry(id, name, alignment, priority);
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
			createOutputChannel(name: string): vscode.OutputChannel {
				return extHostOutputService.createOutputChannel(name);
			},
			createWebviewPanel(viewType: string, title: string, showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn, preserveFocus?: boolean }, options?: vscode.WebviewPanelOptions & vscode.WebviewOptions): vscode.WebviewPanel {
				return extHostWebviews.createWebviewPanel(extension, viewType, title, showOptions, options);
			},
			createWebviewTextEditorInset(editor: vscode.TextEditor, line: number, height: number, options?: vscode.WebviewOptions): vscode.WebviewEditorInset {
				checkProposedApiEnabled(extension);
				return extHostEditorInsets.createWebviewEditorInset(editor, line, height, options, extension);
			},
			createTerminal(nameOrOptions?: vscode.TerminalOptions | vscode.ExtensionTerminalOptions | string, shellPath?: string, shellArgs?: string[] | string): vscode.Terminal {
				if (typeof nameOrOptions === 'object') {
					if ('pty' in nameOrOptions) {
						return extHostTerminalService.createExtensionTerminal(nameOrOptions);
					}
					return extHostTerminalService.createTerminalFromOptions(nameOrOptions);
				}
				return extHostTerminalService.createTerminal(nameOrOptions, shellPath, shellArgs);
			},
			registerTreeDataProvider(viewId: string, treeDataProvider: vscode.TreeDataProvider<any>): vscode.Disposable {
				return extHostTreeViews.registerTreeDataProvider(viewId, treeDataProvider, extension);
			},
			createTreeView(viewId: string, options: { treeDataProvider: vscode.TreeDataProvider<any> }): vscode.TreeView<any> {
				return extHostTreeViews.createTreeView(viewId, options, extension);
			},
			registerWebviewPanelSerializer: (viewType: string, serializer: vscode.WebviewPanelSerializer) => {
				return extHostWebviews.registerWebviewPanelSerializer(extension, viewType, serializer);
			},
			registerWebviewCustomEditorProvider: (viewType: string, provider: vscode.WebviewCustomEditorProvider, options?: vscode.WebviewPanelOptions) => {
				checkProposedApiEnabled(extension);
				return extHostWebviews.registerWebviewCustomEditorProvider(extension, viewType, provider, options);
			},
			registerDecorationProvider(provider: vscode.DecorationProvider) {
				checkProposedApiEnabled(extension);
				return extHostDecorations.registerDecorationProvider(provider, extension.identifier);
			},
			registerUriHandler(handler: vscode.UriHandler) {
				return extHostUrls.registerUriHandler(extension.identifier, handler);
			},
			createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
				return extHostQuickOpen.createQuickPick(extension.identifier, !!extension.enableProposedApi);
			},
			createInputBox(): vscode.InputBox {
				return extHostQuickOpen.createInputBox(extension.identifier);
			},
			get activeColorTheme(): vscode.ColorTheme {
				checkProposedApiEnabled(extension);
				return extHostTheming.activeColorTheme;
			},
			onDidChangeActiveColorTheme(listener, thisArg?, disposables?) {
				checkProposedApiEnabled(extension);
				return extHostTheming.onDidChangeActiveColorTheme(listener, thisArg, disposables);
			}
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
				return extHostWorkspace.findFiles(typeConverters.GlobPattern.from(include), typeConverters.GlobPattern.from(exclude), maxResults, extension.identifier, token);
			},
			findTextInFiles: (query: vscode.TextSearchQuery, optionsOrCallback: vscode.FindTextInFilesOptions | ((result: vscode.TextSearchResult) => void), callbackOrToken?: vscode.CancellationToken | ((result: vscode.TextSearchResult) => void), token?: vscode.CancellationToken) => {
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
				return extHostEditors.applyWorkspaceEdit(edit);
			},
			createFileSystemWatcher: (pattern, ignoreCreate, ignoreChange, ignoreDelete): vscode.FileSystemWatcher => {
				return extHostFileSystemEvent.createFileSystemWatcher(typeConverters.GlobPattern.from(pattern), ignoreCreate, ignoreChange, ignoreDelete);
			},
			get textDocuments() {
				return extHostDocuments.getAllDocumentData().map(data => data.document);
			},
			set textDocuments(value) {
				throw errors.readonly();
			},
			openTextDocument(uriOrFileNameOrOptions?: vscode.Uri | string | { language?: string; content?: string; }) {
				let uriPromise: Thenable<URI>;

				const options = uriOrFileNameOrOptions as { language?: string; content?: string; };
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
					return extHostDocuments.ensureDocumentData(uri).then(() => {
						return extHostDocuments.getDocument(uri);
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
				throw new Error('Tasks api is not allowed in Azure Data Studio'); // {{SQL CARBON EDIT}} disable task
			},
			registerFileSystemProvider(scheme, provider, options) {
				return extHostFileSystem.registerFileSystemProvider(scheme, provider, options);
			},
			get fs() {
				return extHostFileSystem.fileSystem;
			},
			registerFileSearchProvider: (scheme: string, provider: vscode.FileSearchProvider) => {
				checkProposedApiEnabled(extension);
				return extHostSearch.registerFileSearchProvider(scheme, provider);
			},
			registerTextSearchProvider: (scheme: string, provider: vscode.TextSearchProvider) => {
				checkProposedApiEnabled(extension);
				return extHostSearch.registerTextSearchProvider(scheme, provider);
			},
			registerRemoteAuthorityResolver: (authorityPrefix: string, resolver: vscode.RemoteAuthorityResolver) => {
				checkProposedApiEnabled(extension);
				return extensionService.registerRemoteAuthorityResolver(authorityPrefix, resolver);
			},
			registerResourceLabelFormatter: (formatter: vscode.ResourceLabelFormatter) => {
				checkProposedApiEnabled(extension);
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
				checkProposedApiEnabled(extension);
				return extHostTunnelService.openTunnel(forward).then(value => {
					if (!value) {
						throw new Error('cannot open tunnel');
					}
					return value;
				});
			},
			get tunnels() {
				checkProposedApiEnabled(extension);
				return extHostTunnelService.getTunnels();
			},
			onDidChangeTunnels: (listener, thisArg?, disposables?) => {
				checkProposedApiEnabled(extension);
				return extHostTunnelService.onDidChangeTunnels(listener, thisArg, disposables);

			},
			onDidTunnelsChange: (listener, thisArg?, disposables?) => {
				checkProposedApiEnabled(extension);
				return extHostTunnelService.onDidChangeTunnels(listener, thisArg, disposables);

			},
			registerTimelineProvider: (scheme: string | string[], provider: vscode.TimelineProvider) => {
				checkProposedApiEnabled(extension);
				return extHostTimeline.registerTimelineProvider(scheme, provider, extension.identifier, extHostCommands.converter);
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

		const comment: typeof vscode.comments = {
			createCommentController(id: string, label: string) {
				return extHostComment.createCommentController(extension, id, label);
			}
		};

		const comments = comment;

		// {{SQL CARBON EDIT}} -- no-op debug extensibility API
		// namespace: debug
		const debug: typeof vscode.debug = {
			get activeDebugSession() {
				throw new Error('Debug api is not allowed in Azure Data Studio');
				return undefined;
			},
			get activeDebugConsole() {
				throw new Error('Debug api is not allowed in Azure Data Studio');
				return undefined!;
			},
			get breakpoints() {
				throw new Error('Debug api is not allowed in Azure Data Studio');
				return [];
			},
			onDidStartDebugSession(listener, thisArg?, disposables?) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			onDidTerminateDebugSession(listener, thisArg?, disposables?) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			onDidChangeActiveDebugSession(listener, thisArg?, disposables?) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			onDidReceiveDebugSessionCustomEvent(listener, thisArg?, disposables?) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			onDidChangeBreakpoints(listener, thisArgs?, disposables?) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			registerDebugConfigurationProvider(debugType: string, provider: vscode.DebugConfigurationProvider) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			registerDebugAdapterDescriptorFactory(debugType: string, factory: vscode.DebugAdapterDescriptorFactory) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			registerDebugAdapterTrackerFactory(debugType: string, factory: vscode.DebugAdapterTrackerFactory) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			startDebugging(folder: vscode.WorkspaceFolder | undefined, nameOrConfig: string | vscode.DebugConfiguration, parentSessionOrOptions?: vscode.DebugSession | vscode.DebugSessionOptions) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			addBreakpoints(breakpoints: vscode.Breakpoint[]) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			removeBreakpoints(breakpoints: vscode.Breakpoint[]) {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			},
			asDebugSourceUri(source: vscode.DebugProtocolSource, session?: vscode.DebugSession): vscode.Uri {
				throw new Error('Debug api is not allowed in Azure Data Studio');
			}
		};

		const tasks: typeof vscode.tasks = { // {{SQL CARBON EDIT}} disable tasks api
			registerTaskProvider: (type: string, provider: vscode.TaskProvider) => {
				throw new Error('Tasks api is not allowed in Azure Data Studio');
			},
			fetchTasks: (filter?: vscode.TaskFilter): Thenable<vscode.Task[]> => {
				throw new Error('Tasks api is not allowed in Azure Data Studio');
			},
			executeTask: (task: vscode.Task): Thenable<vscode.TaskExecution> => {
				throw new Error('Tasks api is not allowed in Azure Data Studio');
			},
			get taskExecutions(): vscode.TaskExecution[] {
				throw new Error('Tasks api is not allowed in Azure Data Studio');
			},
			onDidStartTask: (listeners, thisArgs?, disposables?) => {
				throw new Error('Tasks api is not allowed in Azure Data Studio');
			},
			onDidEndTask: (listeners, thisArgs?, disposables?) => {
				throw new Error('Tasks api is not allowed in Azure Data Studio');
			},
			onDidStartTaskProcess: (listeners, thisArgs?, disposables?) => {
				throw new Error('Tasks api is not allowed in Azure Data Studio');
			},
			onDidEndTaskProcess: (listeners, thisArgs?, disposables?) => {
				throw new Error('Tasks api is not allowed in Azure Data Studio');
			}
		};

		return <typeof vscode>{
			// {{SQL CARBON EDIT}} - Expose the VS Code version here for extensions that rely on it
			version: initData.vscodeVersion,
			// namespaces
			authentication,
			commands,
			debug,
			env,
			extensions,
			languages,
			scm,
			comment,
			comments,
			tasks,
			window,
			workspace,
			// types
			Breakpoint: extHostTypes.Breakpoint,
			CancellationTokenSource: CancellationTokenSource,
			CodeAction: extHostTypes.CodeAction,
			CodeActionKind: extHostTypes.CodeActionKind,
			CodeActionTrigger: extHostTypes.CodeActionTrigger,
			CodeLens: extHostTypes.CodeLens,
			CodeInset: extHostTypes.CodeInset,
			Color: extHostTypes.Color,
			ColorInformation: extHostTypes.ColorInformation,
			ColorPresentation: extHostTypes.ColorPresentation,
			CommentThreadCollapsibleState: extHostTypes.CommentThreadCollapsibleState,
			CommentMode: extHostTypes.CommentMode,
			CompletionItem: extHostTypes.CompletionItem,
			CompletionItemKind: extHostTypes.CompletionItemKind,
			CompletionItemTag: extHostTypes.CompletionItemTag,
			CompletionList: extHostTypes.CompletionList,
			CompletionTriggerKind: extHostTypes.CompletionTriggerKind,
			ConfigurationTarget: extHostTypes.ConfigurationTarget,
			DebugAdapterExecutable: extHostTypes.DebugAdapterExecutable,
			DebugAdapterServer: extHostTypes.DebugAdapterServer,
			DebugAdapterInlineImplementation: extHostTypes.DebugAdapterInlineImplementation,
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
			EventEmitter: Emitter,
			ExtensionKind: extHostTypes.ExtensionKind,
			CustomExecution: extHostTypes.CustomExecution,
			CustomExecution2: extHostTypes.CustomExecution,
			FileChangeType: extHostTypes.FileChangeType,
			FileSystemError: extHostTypes.FileSystemError,
			FileType: files.FileType,
			FoldingRange: extHostTypes.FoldingRange,
			FoldingRangeKind: extHostTypes.FoldingRangeKind,
			FunctionBreakpoint: extHostTypes.FunctionBreakpoint,
			Hover: extHostTypes.Hover,
			IndentAction: languageConfiguration.IndentAction,
			Location: extHostTypes.Location,
			LogLevel: extHostTypes.LogLevel,
			MarkdownString: extHostTypes.MarkdownString,
			OverviewRulerLane: OverviewRulerLane,
			ParameterInformation: extHostTypes.ParameterInformation,
			Position: extHostTypes.Position,
			ProcessExecution: extHostTypes.ProcessExecution,
			ProgressLocation: extHostTypes.ProgressLocation,
			QuickInputButtons: extHostTypes.QuickInputButtons,
			Range: extHostTypes.Range,
			RelativePattern: extHostTypes.RelativePattern,
			ResolvedAuthority: extHostTypes.ResolvedAuthority,
			RemoteAuthorityResolverError: extHostTypes.RemoteAuthorityResolverError,
			SemanticTokensLegend: extHostTypes.SemanticTokensLegend,
			SemanticTokensBuilder: extHostTypes.SemanticTokensBuilder,
			SemanticTokens: extHostTypes.SemanticTokens,
			SemanticTokensEdits: extHostTypes.SemanticTokensEdits,
			SemanticTokensEdit: extHostTypes.SemanticTokensEdit,
			Selection: extHostTypes.Selection,
			SelectionRange: extHostTypes.SelectionRange,
			ShellExecution: extHostTypes.ShellExecution,
			ShellQuoting: extHostTypes.ShellQuoting,
			SignatureHelpTriggerKind: extHostTypes.SignatureHelpTriggerKind,
			SignatureHelp: extHostTypes.SignatureHelp,
			SignatureInformation: extHostTypes.SignatureInformation,
			SnippetString: extHostTypes.SnippetString,
			SourceBreakpoint: extHostTypes.SourceBreakpoint,
			SourceControlInputBoxValidationType: extHostTypes.SourceControlInputBoxValidationType,
			StatusBarAlignment: extHostTypes.StatusBarAlignment,
			SymbolInformation: extHostTypes.SymbolInformation,
			SymbolKind: extHostTypes.SymbolKind,
			SymbolTag: extHostTypes.SymbolTag,
			Task: extHostTypes.Task,
			Task2: extHostTypes.Task,
			TaskGroup: extHostTypes.TaskGroup,
			TaskPanelKind: extHostTypes.TaskPanelKind,
			TaskRevealKind: extHostTypes.TaskRevealKind,
			TaskScope: extHostTypes.TaskScope,
			TextDocumentSaveReason: extHostTypes.TextDocumentSaveReason,
			TextEdit: extHostTypes.TextEdit,
			TextEditorCursorStyle: TextEditorCursorStyle,
			TextEditorLineNumbersStyle: extHostTypes.TextEditorLineNumbersStyle,
			TextEditorRevealType: extHostTypes.TextEditorRevealType,
			TextEditorSelectionChangeKind: extHostTypes.TextEditorSelectionChangeKind,
			ThemeColor: extHostTypes.ThemeColor,
			ThemeIcon: extHostTypes.ThemeIcon,
			TreeItem: extHostTypes.TreeItem,
			TreeItem2: extHostTypes.TreeItem,
			TreeItemCollapsibleState: extHostTypes.TreeItemCollapsibleState,
			Uri: URI,
			ViewColumn: extHostTypes.ViewColumn,
			WorkspaceEdit: extHostTypes.WorkspaceEdit,
			// proposed
			CallHierarchyOutgoingCall: extHostTypes.CallHierarchyOutgoingCall,
			CallHierarchyIncomingCall: extHostTypes.CallHierarchyIncomingCall,
			CallHierarchyItem: extHostTypes.CallHierarchyItem,
			DebugConsoleMode: extHostTypes.DebugConsoleMode,
			Decoration: extHostTypes.Decoration,
			WebviewContentState: extHostTypes.WebviewContentState,
			UIKind: UIKind,
			ColorThemeKind: extHostTypes.ColorThemeKind,
			TimelineItem: extHostTypes.TimelineItem
		};
	};
}

class Extension<T> implements vscode.Extension<T> {

	private _extensionService: IExtHostExtensionService;
	private _originExtensionId: ExtensionIdentifier;
	private _identifier: ExtensionIdentifier;

	readonly id: string;
	readonly extensionPath: string;
	readonly packageJSON: IExtensionDescription;
	readonly extensionKind: vscode.ExtensionKind;

	constructor(extensionService: IExtHostExtensionService, originExtensionId: ExtensionIdentifier, description: IExtensionDescription, kind: extHostTypes.ExtensionKind) {
		this._extensionService = extensionService;
		this._originExtensionId = originExtensionId;
		this._identifier = description.identifier;
		this.id = description.identifier.value;
		this.extensionPath = path.normalize(originalFSPath(description.extensionLocation));
		this.packageJSON = description;
		this.extensionKind = kind;
	}

	asExtensionUri(relativePath: string): URI {
		checkProposedApiEnabled(this.packageJSON);
		return joinPath(this.packageJSON.extensionLocation, relativePath);
	}

	get isActive(): boolean {
		return this._extensionService.isActivated(this._identifier);
	}

	get exports(): T {
		if (this.packageJSON.api === 'none') {
			return undefined!; // Strict nulloverride - Public api
		}
		return <T>this._extensionService.getExtensionExports(this._identifier);
	}

	activate(): Thenable<T> {
		return this._extensionService.activateByIdWithErrors(this._identifier, { startup: false, extensionId: this._originExtensionId, activationEvent: 'api' }).then(() => this.exports);
	}
}
