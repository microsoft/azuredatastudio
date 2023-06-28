/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Barrier, IntervalTimer } from 'vs/base/common/async';
import { VSBuffer } from 'vs/base/common/buffer';
import * as errors from 'vs/base/common/errors';
import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { StopWatch } from 'vs/base/common/stopwatch';
import { URI } from 'vs/base/common/uri';
import { IMessagePassingProtocol } from 'vs/base/parts/ipc/common/ipc';
import * as nls from 'vs/nls';
import { Categories } from 'vs/platform/action/common/actionCommonCategories';
import { Action2, registerAction2 } from 'vs/platform/actions/common/actions';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { RemoteAuthorityResolverErrorCode, getRemoteAuthorityPrefix } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { MainContext } from 'vs/workbench/api/common/extHost.protocol';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { ExtHostCustomersRegistry, IInternalExtHostContext } from 'vs/workbench/services/extensions/common/extHostCustomers';
import { ExtensionHostKind, extensionHostKindToString } from 'vs/workbench/services/extensions/common/extensionHostKind';
import { IExtensionDescriptionDelta } from 'vs/workbench/services/extensions/common/extensionHostProtocol';
import { IExtensionHostProxy, IResolveAuthorityResult } from 'vs/workbench/services/extensions/common/extensionHostProxy';
import { ExtensionRunningLocation } from 'vs/workbench/services/extensions/common/extensionRunningLocation';
import { ActivationKind, ExtensionActivationReason, ExtensionHostExtensions, ExtensionHostStartup, IExtensionHost, IInternalExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { Proxied, ProxyIdentifier } from 'vs/workbench/services/extensions/common/proxyIdentifier';
import { IRPCProtocolLogger, RPCProtocol, RequestInitiator, ResponsiveState } from 'vs/workbench/services/extensions/common/rpcProtocol';

// Enable to see detailed message communication between window and extension host
const LOG_EXTENSION_HOST_COMMUNICATION = false;
const LOG_USE_COLORS = true;

export interface IExtensionHostManager {
	readonly kind: ExtensionHostKind;
	readonly startup: ExtensionHostStartup;
	readonly onDidExit: Event<[number, string | null]>;
	readonly onDidChangeResponsiveState: Event<ResponsiveState>;
	dispose(): void;
	ready(): Promise<void>;
	representsRunningLocation(runningLocation: ExtensionRunningLocation): boolean;
	deltaExtensions(extensionsDelta: IExtensionDescriptionDelta): Promise<void>;
	containsExtension(extensionId: ExtensionIdentifier): boolean;
	activate(extension: ExtensionIdentifier, reason: ExtensionActivationReason): Promise<boolean>;
	activateByEvent(activationEvent: string, activationKind: ActivationKind): Promise<void>;
	activationEventIsDone(activationEvent: string): boolean;
	getInspectPort(tryEnableInspector: boolean): Promise<number>;
	resolveAuthority(remoteAuthority: string, resolveAttempt: number): Promise<IResolveAuthorityResult>;
	/**
	 * Returns `null` if no resolver for `remoteAuthority` is found.
	 */
	getCanonicalURI(remoteAuthority: string, uri: URI): Promise<URI | null>;
	start(allExtensions: IExtensionDescription[], myExtensions: ExtensionIdentifier[]): Promise<void>;
	extensionTestsExecute(): Promise<number>;
	setRemoteEnvironment(env: { [key: string]: string | null }): Promise<void>;
}

export function createExtensionHostManager(instantiationService: IInstantiationService, extensionHost: IExtensionHost, initialActivationEvents: string[], internalExtensionService: IInternalExtensionService): IExtensionHostManager {
	if (extensionHost.startup === ExtensionHostStartup.Lazy && initialActivationEvents.length === 0) {
		return instantiationService.createInstance(LazyCreateExtensionHostManager, extensionHost, internalExtensionService);
	}
	return instantiationService.createInstance(ExtensionHostManager, extensionHost, initialActivationEvents, internalExtensionService);
}

type ExtensionHostStartupClassification = {
	owner: 'alexdima';
	comment: 'The startup state of the extension host';
	time: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The time reported by Date.now().' };
	action: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The action: starting, success or error.' };
	kind: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The extension host kind: LocalProcess, LocalWebWorker or Remote.' };
	errorName?: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The error name.' };
	errorMessage?: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The error message.' };
	errorStack?: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The error stack.' };
};

type ExtensionHostStartupEvent = {
	time: number;
	action: 'starting' | 'success' | 'error';
	kind: string;
	errorName?: string;
	errorMessage?: string;
	errorStack?: string;
};

class ExtensionHostManager extends Disposable implements IExtensionHostManager {

	public readonly onDidExit: Event<[number, string | null]>;

	private readonly _onDidChangeResponsiveState: Emitter<ResponsiveState> = this._register(new Emitter<ResponsiveState>());
	public readonly onDidChangeResponsiveState: Event<ResponsiveState> = this._onDidChangeResponsiveState.event;

	/**
	 * A map of already requested activation events to speed things up if the same activation event is triggered multiple times.
	 */
	private readonly _cachedActivationEvents: Map<string, Promise<void>>;
	private readonly _resolvedActivationEvents: Set<string>;
	private _rpcProtocol: RPCProtocol | null;
	private readonly _customers: IDisposable[];
	private readonly _extensionHost: IExtensionHost;
	private _proxy: Promise<IExtensionHostProxy | null> | null;
	private _hasStarted = false;

	public get kind(): ExtensionHostKind {
		return this._extensionHost.runningLocation.kind;
	}

	public get startup(): ExtensionHostStartup {
		return this._extensionHost.startup;
	}

	constructor(
		extensionHost: IExtensionHost,
		initialActivationEvents: string[],
		private readonly _internalExtensionService: IInternalExtensionService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@IWorkbenchEnvironmentService private readonly _environmentService: IWorkbenchEnvironmentService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._cachedActivationEvents = new Map<string, Promise<void>>();
		this._resolvedActivationEvents = new Set<string>();
		this._rpcProtocol = null;
		this._customers = [];

		this._extensionHost = extensionHost;
		this.onDidExit = this._extensionHost.onExit;

		const startingTelemetryEvent: ExtensionHostStartupEvent = {
			time: Date.now(),
			action: 'starting',
			kind: extensionHostKindToString(this.kind)
		};
		this._telemetryService.publicLog2<ExtensionHostStartupEvent, ExtensionHostStartupClassification>('extensionHostStartup', startingTelemetryEvent);

		this._proxy = this._extensionHost.start().then(
			(protocol) => {
				this._hasStarted = true;

				// Track healthy extension host startup
				const successTelemetryEvent: ExtensionHostStartupEvent = {
					time: Date.now(),
					action: 'success',
					kind: extensionHostKindToString(this.kind)
				};
				this._telemetryService.publicLog2<ExtensionHostStartupEvent, ExtensionHostStartupClassification>('extensionHostStartup', successTelemetryEvent);

				return this._createExtensionHostCustomers(this.kind, protocol);
			},
			(err) => {
				this._logService.error(`Error received from starting extension host (kind: ${extensionHostKindToString(this.kind)})`);
				this._logService.error(err);

				// Track errors during extension host startup
				const failureTelemetryEvent: ExtensionHostStartupEvent = {
					time: Date.now(),
					action: 'error',
					kind: extensionHostKindToString(this.kind)
				};

				if (err && err.name) {
					failureTelemetryEvent.errorName = err.name;
				}
				if (err && err.message) {
					failureTelemetryEvent.errorMessage = err.message;
				}
				if (err && err.stack) {
					failureTelemetryEvent.errorStack = err.stack;
				}
				this._telemetryService.publicLog2<ExtensionHostStartupEvent, ExtensionHostStartupClassification>('extensionHostStartup', failureTelemetryEvent);

				return null;
			}
		);
		this._proxy.then(() => {
			initialActivationEvents.forEach((activationEvent) => this.activateByEvent(activationEvent, ActivationKind.Normal));
			this._register(registerLatencyTestProvider({
				measure: () => this.measure()
			}));
		});
	}

	public override dispose(): void {
		if (this._extensionHost) {
			this._extensionHost.dispose();
		}
		if (this._rpcProtocol) {
			this._rpcProtocol.dispose();
		}
		for (let i = 0, len = this._customers.length; i < len; i++) {
			const customer = this._customers[i];
			try {
				customer.dispose();
			} catch (err) {
				errors.onUnexpectedError(err);
			}
		}
		this._proxy = null;

		super.dispose();
	}

	private async measure(): Promise<ExtHostLatencyResult | null> {
		const proxy = await this._proxy;
		if (!proxy) {
			return null;
		}
		const latency = await this._measureLatency(proxy);
		const down = await this._measureDown(proxy);
		const up = await this._measureUp(proxy);
		return {
			remoteAuthority: this._extensionHost.remoteAuthority,
			latency,
			down,
			up
		};
	}

	public async ready(): Promise<void> {
		await this._proxy;
	}

	private async _measureLatency(proxy: IExtensionHostProxy): Promise<number> {
		const COUNT = 10;

		let sum = 0;
		for (let i = 0; i < COUNT; i++) {
			const sw = StopWatch.create(true);
			await proxy.test_latency(i);
			sw.stop();
			sum += sw.elapsed();
		}
		return (sum / COUNT);
	}

	private static _convert(byteCount: number, elapsedMillis: number): number {
		return (byteCount * 1000 * 8) / elapsedMillis;
	}

	private async _measureUp(proxy: IExtensionHostProxy): Promise<number> {
		const SIZE = 10 * 1024 * 1024; // 10MB

		const buff = VSBuffer.alloc(SIZE);
		const value = Math.ceil(Math.random() * 256);
		for (let i = 0; i < buff.byteLength; i++) {
			buff.writeUInt8(i, value);
		}
		const sw = StopWatch.create(true);
		await proxy.test_up(buff);
		sw.stop();
		return ExtensionHostManager._convert(SIZE, sw.elapsed());
	}

	private async _measureDown(proxy: IExtensionHostProxy): Promise<number> {
		const SIZE = 10 * 1024 * 1024; // 10MB

		const sw = StopWatch.create(true);
		await proxy.test_down(SIZE);
		sw.stop();
		return ExtensionHostManager._convert(SIZE, sw.elapsed());
	}

	private _createExtensionHostCustomers(kind: ExtensionHostKind, protocol: IMessagePassingProtocol): IExtensionHostProxy {

		let logger: IRPCProtocolLogger | null = null;
		if (LOG_EXTENSION_HOST_COMMUNICATION || this._environmentService.logExtensionHostCommunication) {
			logger = new RPCLogger(kind);
		} else if (TelemetryRPCLogger.isEnabled()) {
			logger = new TelemetryRPCLogger(this._telemetryService);
		}

		this._rpcProtocol = new RPCProtocol(protocol, logger);
		this._register(this._rpcProtocol.onDidChangeResponsiveState((responsiveState: ResponsiveState) => this._onDidChangeResponsiveState.fire(responsiveState)));
		let extensionHostProxy: IExtensionHostProxy | null = null as IExtensionHostProxy | null;
		//let mainProxyIdentifiers: ProxyIdentifier<any>[] = []; // {{SQL CARBON EDIT}}
		const extHostContext: IInternalExtHostContext = {
			remoteAuthority: this._extensionHost.remoteAuthority,
			extensionHostKind: this.kind,
			getProxy: <T>(identifier: ProxyIdentifier<T>): Proxied<T> => this._rpcProtocol!.getProxy(identifier),
			set: <T, R extends T>(identifier: ProxyIdentifier<T>, instance: R): R => this._rpcProtocol!.set(identifier, instance),
			dispose: (): void => this._rpcProtocol!.dispose(),
			assertRegistered: (identifiers: ProxyIdentifier<any>[]): void => this._rpcProtocol!.assertRegistered(identifiers),
			drain: (): Promise<void> => this._rpcProtocol!.drain(),

			//#region internal
			internalExtensionService: this._internalExtensionService,
			_setExtensionHostProxy: (value: IExtensionHostProxy): void => {
				extensionHostProxy = value;
			},
			_setAllMainProxyIdentifiers: (value: ProxyIdentifier<any>[]): void => {
				//mainProxyIdentifiers = value; // {{SQL CARBON EDIT}}
			},
			//#endregion
		};

		// Named customers
		const namedCustomers = ExtHostCustomersRegistry.getNamedCustomers();
		for (let i = 0, len = namedCustomers.length; i < len; i++) {
			const [id, ctor] = namedCustomers[i];
			try {
				const instance = this._instantiationService.createInstance(ctor, extHostContext);
				this._customers.push(instance);
				this._rpcProtocol.set(id, instance);
			} catch (err) {
				this._logService.error(`Cannot instantiate named customer: '${id.sid}'`);
				this._logService.error(err);
				errors.onUnexpectedError(err);
			}
		}

		// Customers
		const customers = ExtHostCustomersRegistry.getCustomers();
		for (const ctor of customers) {
			try {
				const instance = this._instantiationService.createInstance(ctor, extHostContext);
				this._customers.push(instance);
			} catch (err) {
				this._logService.error(err);
				errors.onUnexpectedError(err);
			}
		}

		if (!extensionHostProxy) {
			throw new Error(`Missing IExtensionHostProxy!`);
		}

		// Check that no named customers are missing
		// {{SQL CARBON EDIT}} filter out services we don't expose
		const filtered: ProxyIdentifier<any>[] = [
			MainContext.MainThreadDebugService,
			MainContext.MainThreadInteractive
		];
		const expected: ProxyIdentifier<any>[] = Object.keys(MainContext).map((key) => (<any>MainContext)[key]).filter(v => !filtered.some(x => x === v));
		this._rpcProtocol.assertRegistered(expected);

		return extensionHostProxy;
	}

	public async activate(extension: ExtensionIdentifier, reason: ExtensionActivationReason): Promise<boolean> {
		const proxy = await this._proxy;
		if (!proxy) {
			return false;
		}
		return proxy.activate(extension, reason);
	}

	public activateByEvent(activationEvent: string, activationKind: ActivationKind): Promise<void> {
		if (activationKind === ActivationKind.Immediate && !this._hasStarted) {
			return Promise.resolve();
		}

		if (!this._cachedActivationEvents.has(activationEvent)) {
			this._cachedActivationEvents.set(activationEvent, this._activateByEvent(activationEvent, activationKind));
		}
		return this._cachedActivationEvents.get(activationEvent)!;
	}

	public activationEventIsDone(activationEvent: string): boolean {
		return this._resolvedActivationEvents.has(activationEvent);
	}

	private async _activateByEvent(activationEvent: string, activationKind: ActivationKind): Promise<void> {
		if (!this._proxy) {
			return;
		}
		const proxy = await this._proxy;
		if (!proxy) {
			// this case is already covered above and logged.
			// i.e. the extension host could not be started
			return;
		}
		await proxy.activateByEvent(activationEvent, activationKind);
		this._resolvedActivationEvents.add(activationEvent);
	}

	public async getInspectPort(tryEnableInspector: boolean): Promise<number> {
		if (this._extensionHost) {
			if (tryEnableInspector) {
				await this._extensionHost.enableInspectPort();
			}
			const port = this._extensionHost.getInspectPort();
			if (port) {
				return port;
			}
		}
		return 0;
	}

	public async resolveAuthority(remoteAuthority: string, resolveAttempt: number): Promise<IResolveAuthorityResult> {
		const sw = StopWatch.create(false);
		const prefix = () => `[${extensionHostKindToString(this._extensionHost.runningLocation.kind)}${this._extensionHost.runningLocation.affinity}][resolveAuthority(${getRemoteAuthorityPrefix(remoteAuthority)},${resolveAttempt})][${sw.elapsed()}ms] `;
		const logInfo = (msg: string) => this._logService.info(`${prefix()}${msg}`);
		const logError = (msg: string, err: any = undefined) => this._logService.error(`${prefix()}${msg}`, err);

		logInfo(`obtaining proxy...`);
		const proxy = await this._proxy;
		if (!proxy) {
			logError(`no proxy`);
			return {
				type: 'error',
				error: {
					message: `Cannot resolve authority`,
					code: RemoteAuthorityResolverErrorCode.Unknown,
					detail: undefined
				}
			};
		}
		logInfo(`invoking...`);
		const intervalLogger = new IntervalTimer();
		try {
			intervalLogger.cancelAndSet(() => logInfo('waiting...'), 1000);
			const resolverResult = await proxy.resolveAuthority(remoteAuthority, resolveAttempt);
			intervalLogger.dispose();
			if (resolverResult.type === 'ok') {
				logInfo(`returned ${resolverResult.value.authority.connectTo}`);
			} else {
				logError(`returned an error`, resolverResult.error);
			}
			return resolverResult;
		} catch (err) {
			intervalLogger.dispose();
			logError(`returned an error`, err);
			return {
				type: 'error',
				error: {
					message: err.message,
					code: RemoteAuthorityResolverErrorCode.Unknown,
					detail: err
				}
			};
		}
	}

	public async getCanonicalURI(remoteAuthority: string, uri: URI): Promise<URI | null> {
		const proxy = await this._proxy;
		if (!proxy) {
			throw new Error(`Cannot resolve canonical URI`);
		}
		return proxy.getCanonicalURI(remoteAuthority, uri);
	}

	public async start(allExtensions: IExtensionDescription[], myExtensions: ExtensionIdentifier[]): Promise<void> {
		const proxy = await this._proxy;
		if (!proxy) {
			return;
		}
		const deltaExtensions = this._extensionHost.extensions.set(allExtensions, myExtensions);
		return proxy.startExtensionHost(deltaExtensions);
	}

	public async extensionTestsExecute(): Promise<number> {
		const proxy = await this._proxy;
		if (!proxy) {
			throw new Error('Could not obtain Extension Host Proxy');
		}
		return proxy.extensionTestsExecute();
	}

	public representsRunningLocation(runningLocation: ExtensionRunningLocation): boolean {
		return this._extensionHost.runningLocation.equals(runningLocation);
	}

	public async deltaExtensions(extensionsDelta: IExtensionDescriptionDelta): Promise<void> {
		const proxy = await this._proxy;
		if (!proxy) {
			return;
		}
		this._extensionHost.extensions.delta(extensionsDelta);
		return proxy.deltaExtensions(extensionsDelta);
	}

	public containsExtension(extensionId: ExtensionIdentifier): boolean {
		return this._extensionHost.extensions.containsExtension(extensionId);
	}

	public async setRemoteEnvironment(env: { [key: string]: string | null }): Promise<void> {
		const proxy = await this._proxy;
		if (!proxy) {
			return;
		}

		return proxy.setRemoteEnvironment(env);
	}
}

/**
 * Waits until `start()` and only if it has extensions proceeds to really start.
 */
class LazyCreateExtensionHostManager extends Disposable implements IExtensionHostManager {

	public readonly onDidExit: Event<[number, string | null]>;
	private readonly _onDidChangeResponsiveState: Emitter<ResponsiveState> = this._register(new Emitter<ResponsiveState>());
	public readonly onDidChangeResponsiveState: Event<ResponsiveState> = this._onDidChangeResponsiveState.event;

	private readonly _extensionHost: IExtensionHost;
	private _startCalled: Barrier;
	private _actual: ExtensionHostManager | null;
	private _lazyStartExtensions: ExtensionHostExtensions | null;

	public get kind(): ExtensionHostKind {
		return this._extensionHost.runningLocation.kind;
	}

	public get startup(): ExtensionHostStartup {
		return this._extensionHost.startup;
	}

	constructor(
		extensionHost: IExtensionHost,
		private readonly _internalExtensionService: IInternalExtensionService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ILogService private readonly _logService: ILogService,
	) {
		super();
		this._extensionHost = extensionHost;
		this.onDidExit = extensionHost.onExit;
		this._startCalled = new Barrier();
		this._actual = null;
		this._lazyStartExtensions = null;
	}

	private _createActual(reason: string): ExtensionHostManager {
		this._logService.info(`Creating lazy extension host: ${reason}`);
		this._actual = this._register(this._instantiationService.createInstance(ExtensionHostManager, this._extensionHost, [], this._internalExtensionService));
		this._register(this._actual.onDidChangeResponsiveState((e) => this._onDidChangeResponsiveState.fire(e)));
		return this._actual;
	}

	private async _getOrCreateActualAndStart(reason: string): Promise<ExtensionHostManager> {
		if (this._actual) {
			// already created/started
			return this._actual;
		}
		const actual = this._createActual(reason);
		await actual.start([], []);
		return actual;
	}

	public async ready(): Promise<void> {
		await this._startCalled.wait();
		if (this._actual) {
			await this._actual.ready();
		}
	}
	public representsRunningLocation(runningLocation: ExtensionRunningLocation): boolean {
		return this._extensionHost.runningLocation.equals(runningLocation);
	}
	public async deltaExtensions(extensionsDelta: IExtensionDescriptionDelta): Promise<void> {
		await this._startCalled.wait();
		if (this._actual) {
			return this._actual.deltaExtensions(extensionsDelta);
		}
		this._lazyStartExtensions!.delta(extensionsDelta);
		if (extensionsDelta.myToAdd.length > 0) {
			const actual = this._createActual(`contains ${extensionsDelta.myToAdd.length} new extension(s) (installed or enabled): ${extensionsDelta.myToAdd.map(extId => extId.value)}`);
			const { toAdd, myToAdd } = this._lazyStartExtensions!.toDelta();
			actual.start(toAdd, myToAdd);
			return;
		}
	}
	public containsExtension(extensionId: ExtensionIdentifier): boolean {
		return this._extensionHost.extensions.containsExtension(extensionId);
	}
	public async activate(extension: ExtensionIdentifier, reason: ExtensionActivationReason): Promise<boolean> {
		await this._startCalled.wait();
		if (this._actual) {
			return this._actual.activate(extension, reason);
		}
		return false;
	}
	public async activateByEvent(activationEvent: string, activationKind: ActivationKind): Promise<void> {
		if (activationKind === ActivationKind.Immediate) {
			// this is an immediate request, so we cannot wait for start to be called
			if (this._actual) {
				return this._actual.activateByEvent(activationEvent, activationKind);
			}
			return;
		}
		await this._startCalled.wait();
		if (this._actual) {
			return this._actual.activateByEvent(activationEvent, activationKind);
		}
	}
	public activationEventIsDone(activationEvent: string): boolean {
		if (!this._startCalled.isOpen()) {
			return false;
		}
		if (this._actual) {
			return this._actual.activationEventIsDone(activationEvent);
		}
		return true;
	}
	public async getInspectPort(tryEnableInspector: boolean): Promise<number> {
		await this._startCalled.wait();
		if (this._actual) {
			return this._actual.getInspectPort(tryEnableInspector);
		}
		return 0;
	}
	public async resolveAuthority(remoteAuthority: string, resolveAttempt: number): Promise<IResolveAuthorityResult> {
		await this._startCalled.wait();
		if (this._actual) {
			return this._actual.resolveAuthority(remoteAuthority, resolveAttempt);
		}
		return {
			type: 'error',
			error: {
				message: `Cannot resolve authority`,
				code: RemoteAuthorityResolverErrorCode.Unknown,
				detail: undefined
			}
		};
	}
	public async getCanonicalURI(remoteAuthority: string, uri: URI): Promise<URI | null> {
		await this._startCalled.wait();
		if (this._actual) {
			return this._actual.getCanonicalURI(remoteAuthority, uri);
		}
		throw new Error(`Cannot resolve canonical URI`);
	}
	public async start(allExtensions: IExtensionDescription[], myExtensions: ExtensionIdentifier[]): Promise<void> {
		if (myExtensions.length > 0) {
			// there are actual extensions, so let's launch the extension host
			const actual = this._createActual(`contains ${myExtensions.length} extension(s): ${myExtensions.map(extId => extId.value)}.`);
			const result = actual.start(allExtensions, myExtensions);
			this._startCalled.open();
			return result;
		}
		// there are no actual extensions running, store extensions in `this._lazyStartExtensions`
		this._lazyStartExtensions = new ExtensionHostExtensions();
		this._lazyStartExtensions.set(allExtensions, myExtensions);
		this._startCalled.open();
	}
	public async extensionTestsExecute(): Promise<number> {
		await this._startCalled.wait();
		const actual = await this._getOrCreateActualAndStart(`execute tests.`);
		return actual.extensionTestsExecute();
	}
	public async setRemoteEnvironment(env: { [key: string]: string | null }): Promise<void> {
		await this._startCalled.wait();
		if (this._actual) {
			return this._actual.setRemoteEnvironment(env);
		}
	}
}

const colorTables = [
	['#2977B1', '#FC802D', '#34A13A', '#D3282F', '#9366BA'],
	['#8B564C', '#E177C0', '#7F7F7F', '#BBBE3D', '#2EBECD']
];

function prettyWithoutArrays(data: any): any {
	if (Array.isArray(data)) {
		return data;
	}
	if (data && typeof data === 'object' && typeof data.toString === 'function') {
		const result = data.toString();
		if (result !== '[object Object]') {
			return result;
		}
	}
	return data;
}

function pretty(data: any): any {
	if (Array.isArray(data)) {
		return data.map(prettyWithoutArrays);
	}
	return prettyWithoutArrays(data);
}

class RPCLogger implements IRPCProtocolLogger {

	private _totalIncoming = 0;
	private _totalOutgoing = 0;

	constructor(
		private readonly _kind: ExtensionHostKind
	) { }

	private _log(direction: string, totalLength: number, msgLength: number, req: number, initiator: RequestInitiator, str: string, data: any): void {
		data = pretty(data);

		const colorTable = colorTables[initiator];
		const color = LOG_USE_COLORS ? colorTable[req % colorTable.length] : '#000000';
		let args = [`%c[${extensionHostKindToString(this._kind)}][${direction}]%c[${String(totalLength).padStart(7)}]%c[len: ${String(msgLength).padStart(5)}]%c${String(req).padStart(5)} - ${str}`, 'color: darkgreen', 'color: grey', 'color: grey', `color: ${color}`];
		if (/\($/.test(str)) {
			args = args.concat(data);
			args.push(')');
		} else {
			args.push(data);
		}
		console.log.apply(console, args as [string, ...string[]]);
	}

	logIncoming(msgLength: number, req: number, initiator: RequestInitiator, str: string, data?: any): void {
		this._totalIncoming += msgLength;
		this._log('Ext \u2192 Win', this._totalIncoming, msgLength, req, initiator, str, data);
	}

	logOutgoing(msgLength: number, req: number, initiator: RequestInitiator, str: string, data?: any): void {
		this._totalOutgoing += msgLength;
		this._log('Win \u2192 Ext', this._totalOutgoing, msgLength, req, initiator, str, data);
	}
}

interface RPCTelemetryData {
	type: string;
	length: number;
}

type RPCTelemetryDataClassification = {
	owner: 'jrieken';
	comment: 'Insights about RPC message sizes';
	type: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; comment: 'The type of the RPC message' };
	length: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'The byte-length of the RPC message' };
};

class TelemetryRPCLogger implements IRPCProtocolLogger {

	static isEnabled(): boolean {
		// this will be a very high frequency event, so we only log a small percentage of them
		return Math.trunc(Math.random() * 1000) < 0.5;
	}

	private readonly _pendingRequests = new Map<number, string>();

	constructor(@ITelemetryService private readonly _telemetryService: ITelemetryService) { }

	logIncoming(msgLength: number, req: number, initiator: RequestInitiator, str: string): void {

		if (initiator === RequestInitiator.LocalSide && /^receiveReply(Err)?:/.test(str)) {
			// log the size of reply messages
			const requestStr = this._pendingRequests.get(req) ?? 'unknown_reply';
			this._pendingRequests.delete(req);
			this._telemetryService.publicLog2<RPCTelemetryData, RPCTelemetryDataClassification>('extensionhost.incoming', {
				type: `${str} ${requestStr}`,
				length: msgLength
			});
		}

		if (initiator === RequestInitiator.OtherSide && /^receiveRequest /.test(str)) {
			// incoming request
			this._telemetryService.publicLog2<RPCTelemetryData, RPCTelemetryDataClassification>('extensionhost.incoming', {
				type: `${str}`,
				length: msgLength
			});
		}
	}

	logOutgoing(msgLength: number, req: number, initiator: RequestInitiator, str: string): void {

		if (initiator === RequestInitiator.LocalSide && str.startsWith('request: ')) {
			this._pendingRequests.set(req, str);
			this._telemetryService.publicLog2<RPCTelemetryData, RPCTelemetryDataClassification>('extensionhost.outgoing', {
				type: str,
				length: msgLength
			});
		}
	}
}

interface ExtHostLatencyResult {
	remoteAuthority: string | null;
	up: number;
	down: number;
	latency: number;
}

interface ExtHostLatencyProvider {
	measure(): Promise<ExtHostLatencyResult | null>;
}

const providers: ExtHostLatencyProvider[] = [];
function registerLatencyTestProvider(provider: ExtHostLatencyProvider): IDisposable {
	providers.push(provider);
	return {
		dispose: () => {
			for (let i = 0; i < providers.length; i++) {
				if (providers[i] === provider) {
					providers.splice(i, 1);
					return;
				}
			}
		}
	};
}

function getLatencyTestProviders(): ExtHostLatencyProvider[] {
	return providers.slice(0);
}

registerAction2(class MeasureExtHostLatencyAction extends Action2 {

	constructor() {
		super({
			id: 'editor.action.measureExtHostLatency',
			title: {
				value: nls.localize('measureExtHostLatency', "Measure Extension Host Latency"),
				original: 'Measure Extension Host Latency'
			},
			category: Categories.Developer,
			f1: true
		});
	}

	async run(accessor: ServicesAccessor) {

		const editorService = accessor.get(IEditorService);

		const measurements = await Promise.all(getLatencyTestProviders().map(provider => provider.measure()));
		editorService.openEditor({ resource: undefined, contents: measurements.map(MeasureExtHostLatencyAction._print).join('\n\n'), options: { pinned: true } });
	}

	private static _print(m: ExtHostLatencyResult | null): string {
		if (!m) {
			return '';
		}
		return `${m.remoteAuthority ? `Authority: ${m.remoteAuthority}\n` : ``}Roundtrip latency: ${m.latency.toFixed(3)}ms\nUp: ${MeasureExtHostLatencyAction._printSpeed(m.up)}\nDown: ${MeasureExtHostLatencyAction._printSpeed(m.down)}\n`;
	}

	private static _printSpeed(n: number): string {
		if (n <= 1024) {
			return `${n} bps`;
		}
		if (n < 1024 * 1024) {
			return `${(n / 1024).toFixed(1)} kbps`;
		}
		return `${(n / 1024 / 1024).toFixed(1)} Mbps`;
	}
});
