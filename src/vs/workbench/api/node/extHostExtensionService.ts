/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import * as path from 'vs/base/common/path';
// {{SQL CARBON EDIT}}
import { createApiFactory, initializeExtensionApi, ISqlExtensionApiFactory } from 'sql/workbench/api/node/sqlExtHost.api.impl';
import { originalFSPath } from 'vs/base/common/resources';
import { Barrier } from 'vs/base/common/async';
import { IDisposable, dispose, toDisposable } from 'vs/base/common/lifecycle';
import { TernarySearchTree } from 'vs/base/common/map';
import { URI } from 'vs/base/common/uri';
import * as pfs from 'vs/base/node/pfs';
import { ILogService } from 'vs/platform/log/common/log';
// {{SQL CARBON EDIT}} - Remove createApiFactory initializeExtensionApi, and IExtensionApiFactory imports
//import { createApiFactory, IExtensionApiFactory, NodeModuleRequireInterceptor, VSCodeNodeModuleFactory } from 'vs/workbench/api/node/extHost.api.impl';
import { NodeModuleRequireInterceptor, VSCodeNodeModuleFactory, KeytarNodeModuleFactory } from 'vs/workbench/api/node/extHost.api.impl';
import { ExtHostExtensionServiceShape, IEnvironment, IInitData, IMainContext, MainContext, MainThreadExtensionServiceShape, MainThreadTelemetryShape, MainThreadWorkspaceShape, IStaticWorkspaceData } from 'vs/workbench/api/common/extHost.protocol';
import { ExtHostConfiguration } from 'vs/workbench/api/node/extHostConfiguration';
import { ActivatedExtension, EmptyExtension, ExtensionActivatedByAPI, ExtensionActivatedByEvent, ExtensionActivationReason, ExtensionActivationTimes, ExtensionActivationTimesBuilder, ExtensionsActivator, IExtensionAPI, IExtensionContext, IExtensionMemento, IExtensionModule, HostExtension } from 'vs/workbench/api/node/extHostExtensionActivator';
import { ExtHostLogService } from 'vs/workbench/api/node/extHostLogService';
import { ExtHostStorage } from 'vs/workbench/api/node/extHostStorage';
import { ExtHostWorkspace } from 'vs/workbench/api/node/extHostWorkspace';
import { ExtensionActivationError } from 'vs/workbench/services/extensions/common/extensions';
import { ExtensionDescriptionRegistry } from 'vs/workbench/services/extensions/node/extensionDescriptionRegistry';
import { connectProxyResolver } from 'vs/workbench/services/extensions/node/proxyResolver';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import * as errors from 'vs/base/common/errors';
import { ResolvedAuthority } from 'vs/platform/remote/common/remoteAuthorityResolver';
import * as vscode from 'vscode';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { IWorkspace } from 'vs/platform/workspace/common/workspace';
import { Schemas } from 'vs/base/common/network';
import { withNullAsUndefined } from 'vs/base/common/types';
import { realpath } from 'vs/base/node/extpath';

class ExtensionMemento implements IExtensionMemento {

	private readonly _id: string;
	private readonly _shared: boolean;
	private readonly _storage: ExtHostStorage;

	private readonly _init: Promise<ExtensionMemento>;
	private _value: { [n: string]: any; };
	private readonly _storageListener: IDisposable;

	constructor(id: string, global: boolean, storage: ExtHostStorage) {
		this._id = id;
		this._shared = global;
		this._storage = storage;

		this._init = this._storage.getValue(this._shared, this._id, Object.create(null)).then(value => {
			this._value = value;
			return this;
		});

		this._storageListener = this._storage.onDidChangeStorage(e => {
			if (e.shared === this._shared && e.key === this._id) {
				this._value = e.value;
			}
		});
	}

	get whenReady(): Promise<ExtensionMemento> {
		return this._init;
	}

	get<T>(key: string, defaultValue: T): T {
		let value = this._value[key];
		if (typeof value === 'undefined') {
			value = defaultValue;
		}
		return value;
	}

	update(key: string, value: any): Promise<boolean> {
		this._value[key] = value;
		return this._storage
			.setValue(this._shared, this._id, this._value)
			.then(() => true);
	}

	dispose(): void {
		this._storageListener.dispose();
	}
}

class ExtensionStoragePath {

	private readonly _workspace?: IStaticWorkspaceData;
	private readonly _environment: IEnvironment;

	private readonly _ready: Promise<string | undefined>;
	private _value?: string;

	constructor(workspace: IStaticWorkspaceData | undefined, environment: IEnvironment) {
		this._workspace = workspace;
		this._environment = environment;
		this._ready = this._getOrCreateWorkspaceStoragePath().then(value => this._value = value);
	}

	get whenReady(): Promise<any> {
		return this._ready;
	}

	workspaceValue(extension: IExtensionDescription): string | undefined {
		if (this._value) {
			return path.join(this._value, extension.identifier.value);
		}
		return undefined;
	}

	globalValue(extension: IExtensionDescription): string {
		return path.join(this._environment.globalStorageHome.fsPath, extension.identifier.value.toLowerCase());
	}

	private async _getOrCreateWorkspaceStoragePath(): Promise<string | undefined> {
		if (!this._workspace) {
			return Promise.resolve(undefined);
		}

		if (!this._environment.appSettingsHome) {
			return undefined;
		}
		const storageName = this._workspace.id;
		const storagePath = path.join(this._environment.appSettingsHome.fsPath, 'workspaceStorage', storageName);

		const exists = await pfs.dirExists(storagePath);

		if (exists) {
			return storagePath;
		}

		try {
			await pfs.mkdirp(storagePath);
			await pfs.writeFile(
				path.join(storagePath, 'meta.json'),
				JSON.stringify({
					id: this._workspace.id,
					configuration: this._workspace.configuration && URI.revive(this._workspace.configuration).toString(),
					name: this._workspace.name
				}, undefined, 2)
			);
			return storagePath;

		} catch (e) {
			console.error(e);
			return undefined;
		}
	}
}

interface ITestRunner {
	run(testsRoot: string, clb: (error: Error, failures?: number) => void): void;
}

export class ExtHostExtensionService implements ExtHostExtensionServiceShape {

	private static readonly WORKSPACE_CONTAINS_TIMEOUT = 7000;

	private readonly _nativeExit: (code?: number) => void;
	private readonly _initData: IInitData;
	private readonly _extHostContext: IMainContext;
	private readonly _extHostWorkspace: ExtHostWorkspace;
	private readonly _extHostConfiguration: ExtHostConfiguration;
	private readonly _extHostLogService: ExtHostLogService;

	private readonly _mainThreadWorkspaceProxy: MainThreadWorkspaceShape;
	private readonly _mainThreadTelemetryProxy: MainThreadTelemetryShape;
	private readonly _mainThreadExtensionsProxy: MainThreadExtensionServiceShape;

	private readonly _almostReadyToRunExtensions: Barrier;
	private readonly _readyToRunExtensions: Barrier;
	private readonly _registry: ExtensionDescriptionRegistry;
	private readonly _storage: ExtHostStorage;
	private readonly _storagePath: ExtensionStoragePath;
	private readonly _activator: ExtensionsActivator;
	private _extensionPathIndex: Promise<TernarySearchTree<IExtensionDescription>> | null;
	private readonly _extensionApiFactory: ISqlExtensionApiFactory;

	private readonly _resolvers: { [authorityPrefix: string]: vscode.RemoteAuthorityResolver; };

	private _started: boolean;

	constructor(
		nativeExit: (code?: number) => void,
		initData: IInitData,
		extHostContext: IMainContext,
		extHostWorkspace: ExtHostWorkspace,
		extHostConfiguration: ExtHostConfiguration,
		extHostLogService: ExtHostLogService
	) {
		this._nativeExit = nativeExit;
		this._initData = initData;
		this._extHostContext = extHostContext;
		this._extHostWorkspace = extHostWorkspace;
		this._extHostConfiguration = extHostConfiguration;
		this._extHostLogService = extHostLogService;

		this._mainThreadWorkspaceProxy = this._extHostContext.getProxy(MainContext.MainThreadWorkspace);
		this._mainThreadTelemetryProxy = this._extHostContext.getProxy(MainContext.MainThreadTelemetry);
		this._mainThreadExtensionsProxy = this._extHostContext.getProxy(MainContext.MainThreadExtensionService);

		this._almostReadyToRunExtensions = new Barrier();
		this._readyToRunExtensions = new Barrier();
		this._registry = new ExtensionDescriptionRegistry(initData.extensions);
		this._storage = new ExtHostStorage(this._extHostContext);
		this._storagePath = new ExtensionStoragePath(withNullAsUndefined(initData.workspace), initData.environment);

		const hostExtensions = new Set<string>();
		initData.hostExtensions.forEach((extensionId) => hostExtensions.add(ExtensionIdentifier.toKey(extensionId)));

		this._activator = new ExtensionsActivator(this._registry, initData.resolvedExtensions, initData.hostExtensions, {
			onExtensionActivationError: (extensionId: ExtensionIdentifier, error: ExtensionActivationError): void => {
				this._mainThreadExtensionsProxy.$onExtensionActivationError(extensionId, error);
			},

			actualActivateExtension: async (extensionId: ExtensionIdentifier, reason: ExtensionActivationReason): Promise<ActivatedExtension> => {
				if (hostExtensions.has(ExtensionIdentifier.toKey(extensionId))) {
					const activationEvent = (reason instanceof ExtensionActivatedByEvent ? reason.activationEvent : null);
					await this._mainThreadExtensionsProxy.$activateExtension(extensionId, activationEvent);
					return new HostExtension();
				}
				const extensionDescription = this._registry.getExtensionDescription(extensionId)!;
				return this._activateExtension(extensionDescription, reason);
			}
		});
		this._extensionPathIndex = null;

		// initialize API first (i.e. do not release barrier until the API is initialized)
		this._extensionApiFactory = createApiFactory(this._initData, this._extHostContext, this._extHostWorkspace, this._extHostConfiguration, this, this._extHostLogService, this._storage);

		this._resolvers = Object.create(null);

		this._started = false;

		this._initialize();

		if (this._initData.autoStart) {
			this._startExtensionHost();
		}
	}

	private async _initialize(): Promise<void> {
		try {
			const configProvider = await this._extHostConfiguration.getConfigProvider();

			// {{SQL CARBON EDIT}} - disable VSCodeNodeModuleFactory and use older initializeExtensionApi
			// const extensionPaths = await this.getExtensionPathIndex();
			// NodeModuleRequireInterceptor.INSTANCE.register(new VSCodeNodeModuleFactory(this._extensionApiFactory, extensionPaths, this._registry, configProvider));
			await initializeExtensionApi(this, this._extensionApiFactory, this._registry, configProvider);
			NodeModuleRequireInterceptor.INSTANCE.register(new KeytarNodeModuleFactory(this._extHostContext.getProxy(MainContext.MainThreadKeytar)));

			// Do this when extension service exists, but extensions are not being activated yet.
			await connectProxyResolver(this._extHostWorkspace, configProvider, this, this._extHostLogService, this._mainThreadTelemetryProxy);
			this._almostReadyToRunExtensions.open();

			await this._extHostWorkspace.waitForInitializeCall();
			this._readyToRunExtensions.open();
		} catch (err) {
			errors.onUnexpectedError(err);
		}
	}

	public async deactivateAll(): Promise<void> {
		let allPromises: Promise<void>[] = [];
		try {
			const allExtensions = this._registry.getAllExtensionDescriptions();
			const allExtensionsIds = allExtensions.map(ext => ext.identifier);
			const activatedExtensions = allExtensionsIds.filter(id => this.isActivated(id));

			allPromises = activatedExtensions.map((extensionId) => {
				return this._deactivate(extensionId);
			});
		} catch (err) {
			// TODO: write to log once we have one
		}
		await allPromises;
	}

	public isActivated(extensionId: ExtensionIdentifier): boolean {
		if (this._readyToRunExtensions.isOpen()) {
			return this._activator.isActivated(extensionId);
		}
		return false;
	}

	private _activateByEvent(activationEvent: string, startup: boolean): Promise<void> {
		const reason = new ExtensionActivatedByEvent(startup, activationEvent);
		return this._activator.activateByEvent(activationEvent, reason);
	}

	private _activateById(extensionId: ExtensionIdentifier, reason: ExtensionActivationReason): Promise<void> {
		return this._activator.activateById(extensionId, reason);
	}

	public activateByIdWithErrors(extensionId: ExtensionIdentifier, reason: ExtensionActivationReason): Promise<void> {
		return this._activateById(extensionId, reason).then(() => {
			const extension = this._activator.getActivatedExtension(extensionId);
			if (extension.activationFailed) {
				// activation failed => bubble up the error as the promise result
				return Promise.reject(extension.activationFailedError);
			}
			return undefined;
		});
	}

	public getExtensionRegistry(): Promise<ExtensionDescriptionRegistry> {
		return this._readyToRunExtensions.wait().then(_ => this._registry);
	}

	public getExtensionExports(extensionId: ExtensionIdentifier): IExtensionAPI | null | undefined {
		if (this._readyToRunExtensions.isOpen()) {
			return this._activator.getActivatedExtension(extensionId).exports;
		} else {
			return null;
		}
	}

	// create trie to enable fast 'filename -> extension id' look up
	public getExtensionPathIndex(): Promise<TernarySearchTree<IExtensionDescription>> {
		if (!this._extensionPathIndex) {
			const tree = TernarySearchTree.forPaths<IExtensionDescription>();
			const extensions = this._registry.getAllExtensionDescriptions().map(ext => {
				if (!ext.main) {
					return undefined;
				}
				return realpath(ext.extensionLocation.fsPath).then(value => tree.set(URI.file(value).fsPath, ext));
			});
			this._extensionPathIndex = Promise.all(extensions).then(() => tree);
		}
		return this._extensionPathIndex;
	}

	private _deactivate(extensionId: ExtensionIdentifier): Promise<void> {
		let result = Promise.resolve(undefined);

		if (!this._readyToRunExtensions.isOpen()) {
			return result;
		}

		if (!this._activator.isActivated(extensionId)) {
			return result;
		}

		const extension = this._activator.getActivatedExtension(extensionId);
		if (!extension) {
			return result;
		}

		// call deactivate if available
		try {
			if (typeof extension.module.deactivate === 'function') {
				result = Promise.resolve(extension.module.deactivate()).then(undefined, (err) => {
					// TODO: Do something with err if this is not the shutdown case
					return Promise.resolve(undefined);
				});
			}
		} catch (err) {
			// TODO: Do something with err if this is not the shutdown case
		}

		// clean up subscriptions
		try {
			dispose(extension.subscriptions);
		} catch (err) {
			// TODO: Do something with err if this is not the shutdown case
		}

		return result;
	}

	// --- impl

	private _activateExtension(extensionDescription: IExtensionDescription, reason: ExtensionActivationReason): Promise<ActivatedExtension> {
		this._mainThreadExtensionsProxy.$onWillActivateExtension(extensionDescription.identifier);
		return this._doActivateExtension(extensionDescription, reason).then((activatedExtension) => {
			const activationTimes = activatedExtension.activationTimes;
			const activationEvent = (reason instanceof ExtensionActivatedByEvent ? reason.activationEvent : null);
			this._mainThreadExtensionsProxy.$onDidActivateExtension(extensionDescription.identifier, activationTimes.startup, activationTimes.codeLoadingTime, activationTimes.activateCallTime, activationTimes.activateResolvedTime, activationEvent);
			this._logExtensionActivationTimes(extensionDescription, reason, 'success', activationTimes);
			return activatedExtension;
		}, (err) => {
			this._logExtensionActivationTimes(extensionDescription, reason, 'failure');
			throw err;
		});
	}

	private _logExtensionActivationTimes(extensionDescription: IExtensionDescription, reason: ExtensionActivationReason, outcome: string, activationTimes?: ExtensionActivationTimes) {
		const event = getTelemetryActivationEvent(extensionDescription, reason);
		/* __GDPR__
			"extensionActivationTimes" : {
				"${include}": [
					"${TelemetryActivationEvent}",
					"${ExtensionActivationTimes}"
				],
				"outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
			}
		*/
		this._mainThreadTelemetryProxy.$publicLog('extensionActivationTimes', {
			...event,
			...(activationTimes || {}),
			outcome,
		});
	}

	private _doActivateExtension(extensionDescription: IExtensionDescription, reason: ExtensionActivationReason): Promise<ActivatedExtension> {
		const event = getTelemetryActivationEvent(extensionDescription, reason);
		/* __GDPR__
			"activatePlugin" : {
				"${include}": [
					"${TelemetryActivationEvent}"
				]
			}
		*/
		this._mainThreadTelemetryProxy.$publicLog('activatePlugin', event);
		if (!extensionDescription.main) {
			// Treat the extension as being empty => NOT AN ERROR CASE
			return Promise.resolve(new EmptyExtension(ExtensionActivationTimes.NONE));
		}

		this._extHostLogService.info(`ExtensionService#_doActivateExtension ${extensionDescription.identifier.value} ${JSON.stringify(reason)}`);

		const activationTimesBuilder = new ExtensionActivationTimesBuilder(reason.startup);
		return Promise.all<any>([
			loadCommonJSModule(this._extHostLogService, extensionDescription.main, activationTimesBuilder),
			this._loadExtensionContext(extensionDescription)
		]).then(values => {
			return ExtHostExtensionService._callActivate(this._extHostLogService, extensionDescription.identifier, <IExtensionModule>values[0], <IExtensionContext>values[1], activationTimesBuilder);
		});
	}

	private _loadExtensionContext(extensionDescription: IExtensionDescription): Promise<IExtensionContext> {

		const globalState = new ExtensionMemento(extensionDescription.identifier.value, true, this._storage);
		const workspaceState = new ExtensionMemento(extensionDescription.identifier.value, false, this._storage);

		this._extHostLogService.trace(`ExtensionService#loadExtensionContext ${extensionDescription.identifier.value}`);
		return Promise.all([
			globalState.whenReady,
			workspaceState.whenReady,
			this._storagePath.whenReady
		]).then(() => {
			const that = this;
			return Object.freeze(<IExtensionContext>{
				globalState,
				workspaceState,
				subscriptions: [],
				get extensionPath() { return extensionDescription.extensionLocation.fsPath; },
				storagePath: this._storagePath.workspaceValue(extensionDescription),
				globalStoragePath: this._storagePath.globalValue(extensionDescription),
				asAbsolutePath: (relativePath: string) => { return path.join(extensionDescription.extensionLocation.fsPath, relativePath); },
				logPath: that._extHostLogService.getLogDirectory(extensionDescription.identifier)
			});
		});
	}

	private static _callActivate(logService: ILogService, extensionId: ExtensionIdentifier, extensionModule: IExtensionModule, context: IExtensionContext, activationTimesBuilder: ExtensionActivationTimesBuilder): Promise<ActivatedExtension> {
		// Make sure the extension's surface is not undefined
		extensionModule = extensionModule || {
			activate: undefined,
			deactivate: undefined
		};

		return this._callActivateOptional(logService, extensionId, extensionModule, context, activationTimesBuilder).then((extensionExports) => {
			return new ActivatedExtension(false, null, activationTimesBuilder.build(), extensionModule, extensionExports, context.subscriptions);
		});
	}

	private static _callActivateOptional(logService: ILogService, extensionId: ExtensionIdentifier, extensionModule: IExtensionModule, context: IExtensionContext, activationTimesBuilder: ExtensionActivationTimesBuilder): Promise<IExtensionAPI> {
		if (typeof extensionModule.activate === 'function') {
			try {
				activationTimesBuilder.activateCallStart();
				logService.trace(`ExtensionService#_callActivateOptional ${extensionId.value}`);
				const activateResult: Promise<IExtensionAPI> = extensionModule.activate.apply(global, [context]);
				activationTimesBuilder.activateCallStop();

				activationTimesBuilder.activateResolveStart();
				return Promise.resolve(activateResult).then((value) => {
					activationTimesBuilder.activateResolveStop();
					return value;
				});
			} catch (err) {
				return Promise.reject(err);
			}
		} else {
			// No activate found => the module is the extension's exports
			return Promise.resolve<IExtensionAPI>(extensionModule);
		}
	}

	// -- eager activation

	// Handle "eager" activation extensions
	private _handleEagerExtensions(): Promise<void> {
		this._activateByEvent('*', true).then(undefined, (err) => {
			console.error(err);
		});

		return this._handleWorkspaceContainsEagerExtensions(this._extHostWorkspace.workspace);
	}

	private _handleWorkspaceContainsEagerExtensions(workspace: IWorkspace | undefined): Promise<void> {
		if (!workspace || workspace.folders.length === 0) {
			return Promise.resolve(undefined);
		}

		return Promise.all(
			this._registry.getAllExtensionDescriptions().map((desc) => {
				return this._handleWorkspaceContainsEagerExtension(workspace, desc);
			})
		).then(() => { });
	}

	private _handleWorkspaceContainsEagerExtension(workspace: IWorkspace, desc: IExtensionDescription): Promise<void> {
		const activationEvents = desc.activationEvents;
		if (!activationEvents) {
			return Promise.resolve(undefined);
		}

		const fileNames: string[] = [];
		const globPatterns: string[] = [];

		for (const activationEvent of activationEvents) {
			if (/^workspaceContains:/.test(activationEvent)) {
				const fileNameOrGlob = activationEvent.substr('workspaceContains:'.length);
				if (fileNameOrGlob.indexOf('*') >= 0 || fileNameOrGlob.indexOf('?') >= 0) {
					globPatterns.push(fileNameOrGlob);
				} else {
					fileNames.push(fileNameOrGlob);
				}
			}
		}

		if (fileNames.length === 0 && globPatterns.length === 0) {
			return Promise.resolve(undefined);
		}

		const fileNamePromise = Promise.all(fileNames.map((fileName) => this._activateIfFileName(workspace, desc.identifier, fileName))).then(() => { });
		const globPatternPromise = this._activateIfGlobPatterns(desc.identifier, globPatterns);

		return Promise.all([fileNamePromise, globPatternPromise]).then(() => { });
	}

	private async _activateIfFileName(workspace: IWorkspace, extensionId: ExtensionIdentifier, fileName: string): Promise<void> {

		// find exact path
		for (const { uri } of workspace.folders) {
			if (await pfs.exists(path.join(URI.revive(uri).fsPath, fileName))) {
				// the file was found
				return (
					this._activateById(extensionId, new ExtensionActivatedByEvent(true, `workspaceContains:${fileName}`))
						.then(undefined, err => console.error(err))
				);
			}
		}

		return undefined;
	}

	private async _activateIfGlobPatterns(extensionId: ExtensionIdentifier, globPatterns: string[]): Promise<void> {
		this._extHostLogService.trace(`extensionHostMain#activateIfGlobPatterns: fileSearch, extension: ${extensionId.value}, entryPoint: workspaceContains`);

		if (globPatterns.length === 0) {
			return Promise.resolve(undefined);
		}

		const tokenSource = new CancellationTokenSource();
		const searchP = this._mainThreadWorkspaceProxy.$checkExists(globPatterns, tokenSource.token);

		const timer = setTimeout(async () => {
			tokenSource.cancel();
			this._activateById(extensionId, new ExtensionActivatedByEvent(true, `workspaceContainsTimeout:${globPatterns.join(',')}`))
				.then(undefined, err => console.error(err));
		}, ExtHostExtensionService.WORKSPACE_CONTAINS_TIMEOUT);

		let exists: boolean = false;
		try {
			exists = await searchP;
		} catch (err) {
			if (!errors.isPromiseCanceledError(err)) {
				console.error(err);
			}
		}

		tokenSource.dispose();
		clearTimeout(timer);

		if (exists) {
			// a file was found matching one of the glob patterns
			return (
				this._activateById(extensionId, new ExtensionActivatedByEvent(true, `workspaceContains:${globPatterns.join(',')}`))
					.then(undefined, err => console.error(err))
			);
		}

		return Promise.resolve(undefined);
	}

	private _handleExtensionTests(): Promise<void> {
		return this._doHandleExtensionTests().then(undefined, error => {
			console.error(error); // ensure any error message makes it onto the console

			return Promise.reject(error);
		});
	}

	private _doHandleExtensionTests(): Promise<void> {
		const { extensionDevelopmentLocationURI, extensionTestsLocationURI } = this._initData.environment;
		if (!(extensionDevelopmentLocationURI && extensionTestsLocationURI && extensionTestsLocationURI.scheme === Schemas.file)) {
			return Promise.resolve(undefined);
		}

		const extensionTestsPath = originalFSPath(extensionTestsLocationURI);

		// Require the test runner via node require from the provided path
		let testRunner: ITestRunner | undefined;
		let requireError: Error | undefined;
		try {
			testRunner = <any>require.__$__nodeRequire(extensionTestsPath);
		} catch (error) {
			requireError = error;
		}

		// Execute the runner if it follows our spec
		if (testRunner && typeof testRunner.run === 'function') {
			return new Promise<void>((c, e) => {
				testRunner!.run(extensionTestsPath, (error, failures) => {
					if (error) {
						e(error.toString());
					} else {
						c(undefined);
					}

					// after tests have run, we shutdown the host
					this._gracefulExit(error || (typeof failures === 'number' && failures > 0) ? 1 /* ERROR */ : 0 /* OK */);
				});
			});
		}

		// Otherwise make sure to shutdown anyway even in case of an error
		else {
			this._gracefulExit(1 /* ERROR */);
		}

		return Promise.reject(new Error(requireError ? requireError.toString() : nls.localize('extensionTestError', "Path {0} does not point to a valid extension test runner.", extensionTestsPath)));
	}

	private _gracefulExit(code: number): void {
		// to give the PH process a chance to flush any outstanding console
		// messages to the main process, we delay the exit() by some time
		setTimeout(() => {
			// If extension tests are running, give the exit code to the renderer
			if (this._initData.remoteAuthority && !!this._initData.environment.extensionTestsLocationURI) {
				this._mainThreadExtensionsProxy.$onExtensionHostExit(code);
				return;
			}

			this._nativeExit(code);
		}, 500);
	}

	private _startExtensionHost(): Promise<void> {
		if (this._started) {
			throw new Error(`Extension host is already started!`);
		}
		this._started = true;

		return this._readyToRunExtensions.wait()
			.then(() => this._handleEagerExtensions())
			.then(() => this._handleExtensionTests())
			.then(() => {
				this._extHostLogService.info(`eager extensions activated`);
			});
	}

	// -- called by extensions

	public registerRemoteAuthorityResolver(authorityPrefix: string, resolver: vscode.RemoteAuthorityResolver): vscode.Disposable {
		this._resolvers[authorityPrefix] = resolver;
		return toDisposable(() => {
			delete this._resolvers[authorityPrefix];
		});
	}

	// -- called by main thread

	public async $resolveAuthority(remoteAuthority: string): Promise<ResolvedAuthority> {
		const authorityPlusIndex = remoteAuthority.indexOf('+');
		if (authorityPlusIndex === -1) {
			throw new Error(`Not an authority that can be resolved!`);
		}
		const authorityPrefix = remoteAuthority.substr(0, authorityPlusIndex);

		await this._almostReadyToRunExtensions.wait();
		await this._activateByEvent(`onResolveRemoteAuthority:${authorityPrefix}`, false);

		const resolver = this._resolvers[authorityPrefix];
		if (!resolver) {
			throw new Error(`No resolver available for ${authorityPrefix}`);
		}

		const result = await resolver.resolve(remoteAuthority);
		return {
			authority: remoteAuthority,
			host: result.host,
			port: result.port,
		};
	}

	public $startExtensionHost(enabledExtensionIds: ExtensionIdentifier[]): Promise<void> {
		this._registry.keepOnly(enabledExtensionIds);
		return this._startExtensionHost();
	}

	public $activateByEvent(activationEvent: string): Promise<void> {
		return (
			this._readyToRunExtensions.wait()
				.then(_ => this._activateByEvent(activationEvent, false))
		);
	}

	public async $activate(extensionId: ExtensionIdentifier, activationEvent: string): Promise<boolean> {
		await this._readyToRunExtensions.wait();
		if (!this._registry.getExtensionDescription(extensionId)) {
			// unknown extension => ignore
			return false;
		}
		await this._activateById(extensionId, new ExtensionActivatedByEvent(false, activationEvent));
		return true;
	}

	public async $deltaExtensions(toAdd: IExtensionDescription[], toRemove: ExtensionIdentifier[]): Promise<void> {
		toAdd.forEach((extension) => (<any>extension).extensionLocation = URI.revive(extension.extensionLocation));

		const trie = await this.getExtensionPathIndex();

		await Promise.all(toRemove.map(async (extensionId) => {
			const extensionDescription = this._registry.getExtensionDescription(extensionId);
			if (!extensionDescription) {
				return;
			}
			const realpathValue = await realpath(extensionDescription.extensionLocation.fsPath);
			trie.delete(URI.file(realpathValue).fsPath);
		}));

		await Promise.all(toAdd.map(async (extensionDescription) => {
			const realpathValue = await realpath(extensionDescription.extensionLocation.fsPath);
			trie.set(URI.file(realpathValue).fsPath, extensionDescription);
		}));

		this._registry.deltaExtensions(toAdd, toRemove);
		return Promise.resolve(undefined);
	}

	public async $test_latency(n: number): Promise<number> {
		return n;
	}

	public async $test_up(b: Buffer): Promise<number> {
		return b.length;
	}

	public async $test_down(size: number): Promise<Buffer> {
		const b = Buffer.alloc(size, Math.random() % 256);
		return b;
	}

}

function loadCommonJSModule<T>(logService: ILogService, modulePath: string, activationTimesBuilder: ExtensionActivationTimesBuilder): Promise<T> {
	let r: T | null = null;
	activationTimesBuilder.codeLoadingStart();
	logService.info(`ExtensionService#loadCommonJSModule ${modulePath}`);
	try {
		r = require.__$__nodeRequire<T>(modulePath);
	} catch (e) {
		return Promise.reject(e);
	} finally {
		activationTimesBuilder.codeLoadingStop();
	}
	return Promise.resolve(r);
}

function getTelemetryActivationEvent(extensionDescription: IExtensionDescription, reason: ExtensionActivationReason): any {
	const reasonStr = reason instanceof ExtensionActivatedByEvent ? reason.activationEvent :
		reason instanceof ExtensionActivatedByAPI ? 'api' :
			'';

	/* __GDPR__FRAGMENT__
		"TelemetryActivationEvent" : {
			"id": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" },
			"name": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" },
			"extensionVersion": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" },
			"publisherDisplayName": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
			"activationEvents": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
			"isBuiltin": { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
			"reason": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
		}
	*/
	const event = {
		id: extensionDescription.identifier.value,
		name: extensionDescription.name,
		extensionVersion: extensionDescription.version,
		publisherDisplayName: extensionDescription.publisher,
		activationEvents: extensionDescription.activationEvents ? extensionDescription.activationEvents.join(',') : null,
		isBuiltin: extensionDescription.isBuiltin,
		reason: reasonStr
	};

	return event;
}
