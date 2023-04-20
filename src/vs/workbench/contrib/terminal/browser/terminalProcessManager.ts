/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from 'vs/base/common/event';
import { Disposable, dispose, IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { IProcessEnvironment, isMacintosh, isWindows, OperatingSystem, OS } from 'vs/base/common/platform';
import { withNullAsUndefined } from 'vs/base/common/types';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { formatMessageForTerminal } from 'vs/platform/terminal/common/terminalStrings';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IProductService } from 'vs/platform/product/common/productService';
import { getRemoteAuthority } from 'vs/platform/remote/common/remoteHosts';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { TerminalCapability } from 'vs/platform/terminal/common/capabilities/capabilities';
import { NaiveCwdDetectionCapability } from 'vs/platform/terminal/common/capabilities/naiveCwdDetectionCapability';
import { TerminalCapabilityStore } from 'vs/platform/terminal/common/capabilities/terminalCapabilityStore';
import { FlowControlConstants, IProcessDataEvent, IProcessProperty, IProcessPropertyMap, IProcessReadyEvent, IShellLaunchConfig, ITerminalChildProcess, ITerminalDimensions, ITerminalEnvironment, ITerminalLaunchError, ITerminalProcessOptions, ProcessPropertyType, TerminalSettingId } from 'vs/platform/terminal/common/terminal';
import { ISerializedCommandDetectionCapability } from 'vs/platform/terminal/common/terminalProcess';
import { TerminalRecorder } from 'vs/platform/terminal/common/terminalRecorder';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { EnvironmentVariableInfoChangesActive, EnvironmentVariableInfoStale } from 'vs/workbench/contrib/terminal/browser/environmentVariableInfo';
import { ITerminalInstanceService } from 'vs/workbench/contrib/terminal/browser/terminal';
import { IEnvironmentVariableCollection, IEnvironmentVariableInfo, IEnvironmentVariableService, IMergedEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariable';
import { MergedEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariableCollection';
import { serializeEnvironmentVariableCollections } from 'vs/workbench/contrib/terminal/common/environmentVariableShared';
import { IBeforeProcessDataEvent, ITerminalBackend, ITerminalConfigHelper, ITerminalProcessManager, ITerminalProfileResolverService, ProcessState } from 'vs/workbench/contrib/terminal/common/terminal';
import * as terminalEnvironment from 'vs/workbench/contrib/terminal/common/terminalEnvironment';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IHistoryService } from 'vs/workbench/services/history/common/history';
import { IPathService } from 'vs/workbench/services/path/common/pathService';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { TaskSettingId } from 'vs/workbench/contrib/tasks/common/tasks';

/** The amount of time to consider terminal errors to be related to the launch */
const LAUNCHING_DURATION = 500;

/**
 * The minimum amount of time between latency requests.
 */
const LATENCY_MEASURING_INTERVAL = 1000;

enum ProcessType {
	Process,
	PsuedoTerminal
}

/**
 * Holds all state related to the creation and management of terminal processes.
 *
 * Internal definitions:
 * - Process: The process launched with the terminalProcess.ts file, or the pty as a whole
 * - Pty Process: The pseudoterminal parent process (or the conpty/winpty agent process)
 * - Shell Process: The pseudoterminal child process (ie. the shell)
 */
export class TerminalProcessManager extends Disposable implements ITerminalProcessManager {
	processState: ProcessState = ProcessState.Uninitialized;
	ptyProcessReady: Promise<void>;
	shellProcessId: number | undefined;
	readonly remoteAuthority: string | undefined;
	os: OperatingSystem | undefined;
	userHome: string | undefined;
	isDisconnected: boolean = false;
	environmentVariableInfo: IEnvironmentVariableInfo | undefined;
	backend: ITerminalBackend | undefined;
	readonly capabilities = new TerminalCapabilityStore();

	private _isDisposed: boolean = false;
	private _process: ITerminalChildProcess | null = null;
	private _processType: ProcessType = ProcessType.Process;
	private _preLaunchInputQueue: string[] = [];
	private _latency: number = -1;
	private _latencyLastMeasured: number = 0;
	private _initialCwd: string | undefined;
	private _extEnvironmentVariableCollection: IMergedEnvironmentVariableCollection | undefined;
	private _ackDataBufferer: AckDataBufferer;
	private _hasWrittenData: boolean = false;
	private _hasChildProcesses: boolean = false;
	private _ptyResponsiveListener: IDisposable | undefined;
	private _ptyListenersAttached: boolean = false;
	private _dataFilter: SeamlessRelaunchDataFilter;
	private _processListeners?: IDisposable[];

	private _shellLaunchConfig?: IShellLaunchConfig;
	private _dimensions: ITerminalDimensions = { cols: 0, rows: 0 };
	private _isScreenReaderModeEnabled: boolean = false;

	private readonly _onPtyDisconnect = this._register(new Emitter<void>());
	readonly onPtyDisconnect = this._onPtyDisconnect.event;
	private readonly _onPtyReconnect = this._register(new Emitter<void>());
	readonly onPtyReconnect = this._onPtyReconnect.event;

	private readonly _onProcessReady = this._register(new Emitter<IProcessReadyEvent>());
	readonly onProcessReady = this._onProcessReady.event;
	private readonly _onProcessStateChange = this._register(new Emitter<void>());
	readonly onProcessStateChange = this._onProcessStateChange.event;
	private readonly _onBeforeProcessData = this._register(new Emitter<IBeforeProcessDataEvent>());
	readonly onBeforeProcessData = this._onBeforeProcessData.event;
	private readonly _onProcessData = this._register(new Emitter<IProcessDataEvent>());
	readonly onProcessData = this._onProcessData.event;
	private readonly _onDidChangeProperty = this._register(new Emitter<IProcessProperty<any>>());
	readonly onDidChangeProperty = this._onDidChangeProperty.event;
	private readonly _onEnvironmentVariableInfoChange = this._register(new Emitter<IEnvironmentVariableInfo>());
	readonly onEnvironmentVariableInfoChanged = this._onEnvironmentVariableInfoChange.event;
	private readonly _onProcessExit = this._register(new Emitter<number | undefined>());
	readonly onProcessExit = this._onProcessExit.event;
	private readonly _onRestoreCommands = this._register(new Emitter<ISerializedCommandDetectionCapability>());
	readonly onRestoreCommands = this._onRestoreCommands.event;

	get persistentProcessId(): number | undefined { return this._process?.id; }
	get shouldPersist(): boolean { return !!this.reconnectionOwner || (this._process ? this._process.shouldPersist : false); }
	get hasWrittenData(): boolean { return this._hasWrittenData; }
	get hasChildProcesses(): boolean { return this._hasChildProcesses; }
	get reconnectionOwner(): string | undefined { return this._shellLaunchConfig?.attachPersistentProcess?.reconnectionOwner || this._shellLaunchConfig?.reconnectionOwner || undefined; }

	constructor(
		private readonly _instanceId: number,
		private readonly _configHelper: ITerminalConfigHelper,
		cwd: string | URI | undefined,
		environmentVariableCollections: ReadonlyMap<string, IEnvironmentVariableCollection> | undefined,
		@IHistoryService private readonly _historyService: IHistoryService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ILogService private readonly _logService: ILogService,
		@IWorkspaceContextService private readonly _workspaceContextService: IWorkspaceContextService,
		@IConfigurationResolverService private readonly _configurationResolverService: IConfigurationResolverService,
		@IWorkbenchEnvironmentService private readonly _workbenchEnvironmentService: IWorkbenchEnvironmentService,
		@IProductService private readonly _productService: IProductService,
		@IRemoteAgentService private readonly _remoteAgentService: IRemoteAgentService,
		@IPathService private readonly _pathService: IPathService,
		@IEnvironmentVariableService private readonly _environmentVariableService: IEnvironmentVariableService,
		@ITerminalProfileResolverService private readonly _terminalProfileResolverService: ITerminalProfileResolverService,
		@IConfigurationService private readonly _configurationService: IConfigurationService,
		@ITerminalInstanceService private readonly _terminalInstanceService: ITerminalInstanceService,
		@ITelemetryService private readonly _telemetryService: ITelemetryService
	) {
		super();

		this.ptyProcessReady = this._createPtyProcessReadyPromise();
		this.getLatency();
		this._ackDataBufferer = new AckDataBufferer(e => this._process?.acknowledgeDataEvent(e));
		this._dataFilter = this._instantiationService.createInstance(SeamlessRelaunchDataFilter);
		this._dataFilter.onProcessData(ev => {
			const data = (typeof ev === 'string' ? ev : ev.data);
			const beforeProcessDataEvent: IBeforeProcessDataEvent = { data };
			this._onBeforeProcessData.fire(beforeProcessDataEvent);
			if (beforeProcessDataEvent.data && beforeProcessDataEvent.data.length > 0) {
				// This event is used by the caller so the object must be reused
				if (typeof ev !== 'string') {
					ev.data = beforeProcessDataEvent.data;
				}
				this._onProcessData.fire(typeof ev !== 'string' ? ev : { data: beforeProcessDataEvent.data, trackCommit: false });
			}
		});

		if (cwd && typeof cwd === 'object') {
			this.remoteAuthority = getRemoteAuthority(cwd);
		} else {
			this.remoteAuthority = this._workbenchEnvironmentService.remoteAuthority;
		}

		if (environmentVariableCollections) {
			this._extEnvironmentVariableCollection = new MergedEnvironmentVariableCollection(environmentVariableCollections);
			this._register(this._environmentVariableService.onDidChangeCollections(newCollection => this._onEnvironmentVariableCollectionChange(newCollection)));
			this.environmentVariableInfo = new EnvironmentVariableInfoChangesActive(this._extEnvironmentVariableCollection);
			this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
		}
	}

	override dispose(immediate: boolean = false): void {
		this._isDisposed = true;
		if (this._process) {
			// If the process was still connected this dispose came from
			// within VS Code, not the process, so mark the process as
			// killed by the user.
			this._setProcessState(ProcessState.KilledByUser);
			this._process.shutdown(immediate);
			this._process = null;
		}
		super.dispose();
	}

	private _createPtyProcessReadyPromise(): Promise<void> {
		return new Promise<void>(c => {
			const listener = this.onProcessReady(() => {
				this._logService.debug(`Terminal process ready (shellProcessId: ${this.shellProcessId})`);
				listener.dispose();
				c(undefined);
			});
		});
	}

	async detachFromProcess(): Promise<void> {
		await this._process?.detach?.();
		this._process = null;
	}

	async createProcess(
		shellLaunchConfig: IShellLaunchConfig,
		cols: number,
		rows: number,
		isScreenReaderModeEnabled: boolean,
		reset: boolean = true
	): Promise<ITerminalLaunchError | undefined> {
		this._shellLaunchConfig = shellLaunchConfig;
		this._dimensions.cols = cols;
		this._dimensions.rows = rows;
		this._isScreenReaderModeEnabled = isScreenReaderModeEnabled;

		let newProcess: ITerminalChildProcess | undefined;

		if (shellLaunchConfig.customPtyImplementation) {
			this._processType = ProcessType.PsuedoTerminal;
			newProcess = shellLaunchConfig.customPtyImplementation(this._instanceId, cols, rows);
		} else {
			const backend = this._terminalInstanceService.getBackend(this.remoteAuthority);
			if (!backend) {
				throw new Error(`No terminal backend registered for remote authority '${this.remoteAuthority}'`);
			}
			this.backend = backend;

			// Create variable resolver
			const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot();
			const lastActiveWorkspace = activeWorkspaceRootUri ? withNullAsUndefined(this._workspaceContextService.getWorkspaceFolder(activeWorkspaceRootUri)) : undefined;
			const variableResolver = terminalEnvironment.createVariableResolver(lastActiveWorkspace, await this._terminalProfileResolverService.getEnvironment(this.remoteAuthority), this._configurationResolverService);

			// resolvedUserHome is needed here as remote resolvers can launch local terminals before
			// they're connected to the remote.
			this.userHome = this._pathService.resolvedUserHome?.fsPath;
			this.os = OS;
			if (!!this.remoteAuthority) {

				const userHomeUri = await this._pathService.userHome();
				this.userHome = userHomeUri.path;
				const remoteEnv = await this._remoteAgentService.getEnvironment();
				if (!remoteEnv) {
					throw new Error(`Failed to get remote environment for remote authority "${this.remoteAuthority}"`);
				}
				this.userHome = remoteEnv.userHome.path;
				this.os = remoteEnv.os;

				// this is a copy of what the merged environment collection is on the remote side
				const env = await this._resolveEnvironment(backend, variableResolver, shellLaunchConfig);
				const shouldPersist = ((this._configurationService.getValue(TaskSettingId.Reconnection) && shellLaunchConfig.reconnectionOwner) || !shellLaunchConfig.isFeatureTerminal) && this._configHelper.config.enablePersistentSessions && !shellLaunchConfig.isTransient;
				if (shellLaunchConfig.attachPersistentProcess) {
					const result = await backend.attachToProcess(shellLaunchConfig.attachPersistentProcess.id);
					if (result) {
						newProcess = result;
					} else {
						// Warn and just create a new terminal if attach failed for some reason
						this._logService.warn(`Attach to process failed for terminal`, shellLaunchConfig.attachPersistentProcess);
						shellLaunchConfig.attachPersistentProcess = undefined;
					}
				}
				if (!newProcess) {
					await this._terminalProfileResolverService.resolveShellLaunchConfig(shellLaunchConfig, {
						remoteAuthority: this.remoteAuthority,
						os: this.os
					});
					const options: ITerminalProcessOptions = {
						shellIntegration: {
							enabled: this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled)
						},
						windowsEnableConpty: this._configHelper.config.windowsEnableConpty && !isScreenReaderModeEnabled,
						environmentVariableCollections: this._extEnvironmentVariableCollection?.collections ? serializeEnvironmentVariableCollections(this._extEnvironmentVariableCollection.collections) : undefined
					};
					try {
						newProcess = await backend.createProcess(
							shellLaunchConfig,
							'', // TODO: Fix cwd
							cols,
							rows,
							this._configHelper.config.unicodeVersion,
							env, // TODO:
							options,
							shouldPersist
						);
					} catch (e) {
						if (e?.message === 'Could not fetch remote environment') {
							this._logService.trace(`Could not fetch remote environment, silently failing`);
							return undefined;
						}
						throw e;
					}
				}
				if (!this._isDisposed) {
					this._setupPtyHostListeners(backend);
				}
			} else {
				if (shellLaunchConfig.attachPersistentProcess) {
					const result = shellLaunchConfig.attachPersistentProcess.findRevivedId ? await backend.attachToRevivedProcess(shellLaunchConfig.attachPersistentProcess.id) : await backend.attachToProcess(shellLaunchConfig.attachPersistentProcess.id);
					if (result) {
						newProcess = result;
					} else {
						// Warn and just create a new terminal if attach failed for some reason
						this._logService.warn(`Attach to process failed for terminal`, shellLaunchConfig.attachPersistentProcess);
						shellLaunchConfig.attachPersistentProcess = undefined;
					}
				}
				if (!newProcess) {
					newProcess = await this._launchLocalProcess(backend, shellLaunchConfig, cols, rows, this.userHome, isScreenReaderModeEnabled, variableResolver);
				}
				if (!this._isDisposed) {
					this._setupPtyHostListeners(backend);
				}
			}
		}

		// If the process was disposed during its creation, shut it down and return failure
		if (this._isDisposed) {
			newProcess.shutdown(false);
			return undefined;
		}

		this._process = newProcess;
		this._setProcessState(ProcessState.Launching);

		// Add any capabilities inherit to the backend
		if (this.os === OperatingSystem.Linux || this.os === OperatingSystem.Macintosh) {
			this.capabilities.add(TerminalCapability.NaiveCwdDetection, new NaiveCwdDetectionCapability(this._process));
		}

		this._dataFilter.newProcess(this._process, reset);

		if (this._processListeners) {
			dispose(this._processListeners);
		}
		this._processListeners = [
			newProcess.onProcessReady((e: IProcessReadyEvent) => {
				this.shellProcessId = e.pid;
				this._initialCwd = e.cwd;
				this._onDidChangeProperty.fire({ type: ProcessPropertyType.InitialCwd, value: this._initialCwd });
				this._onProcessReady.fire(e);

				if (this._preLaunchInputQueue.length > 0 && this._process) {
					// Send any queued data that's waiting
					newProcess!.input(this._preLaunchInputQueue.join(''));
					this._preLaunchInputQueue.length = 0;
				}
			}),
			newProcess.onProcessExit(exitCode => this._onExit(exitCode)),
			newProcess.onDidChangeProperty(({ type, value }) => {
				switch (type) {
					case ProcessPropertyType.HasChildProcesses:
						this._hasChildProcesses = value;
						break;
					case ProcessPropertyType.FailedShellIntegrationActivation:
						this._telemetryService?.publicLog2<{}, { owner: 'meganrogge'; comment: 'Indicates shell integration was not activated because of custom args' }>('terminal/shellIntegrationActivationFailureCustomArgs');
						break;
				}
				this._onDidChangeProperty.fire({ type, value });
			})
		];
		if (newProcess.onRestoreCommands) {
			this._processListeners.push(newProcess.onRestoreCommands(e => {
				this._onRestoreCommands.fire(e);
			}));
		}

		setTimeout(() => {
			if (this.processState === ProcessState.Launching) {
				this._setProcessState(ProcessState.Running);
			}
		}, LAUNCHING_DURATION);

		const result = await newProcess.start();
		if (result) {
			// Error
			return result;
		}
		return undefined;
	}

	async relaunch(shellLaunchConfig: IShellLaunchConfig, cols: number, rows: number, isScreenReaderModeEnabled: boolean, reset: boolean): Promise<ITerminalLaunchError | undefined> {
		this.ptyProcessReady = this._createPtyProcessReadyPromise();
		this._logService.trace(`Relaunching terminal instance ${this._instanceId}`);

		// Fire reconnect if needed to ensure the terminal is usable again
		if (this.isDisconnected) {
			this.isDisconnected = false;
			this._onPtyReconnect.fire();
		}

		// Clear data written flag to re-enable seamless relaunch if this relaunch was manually
		// triggered
		this._hasWrittenData = false;

		return this.createProcess(shellLaunchConfig, cols, rows, isScreenReaderModeEnabled, reset);
	}

	// Fetch any extension environment additions and apply them
	private async _resolveEnvironment(backend: ITerminalBackend, variableResolver: terminalEnvironment.VariableResolver | undefined, shellLaunchConfig: IShellLaunchConfig): Promise<IProcessEnvironment> {
		const platformKey = isWindows ? 'windows' : (isMacintosh ? 'osx' : 'linux');
		const envFromConfigValue = this._configurationService.getValue<ITerminalEnvironment | undefined>(`terminal.integrated.env.${platformKey}`);
		this._configHelper.showRecommendations(shellLaunchConfig);

		let baseEnv: IProcessEnvironment;
		if (shellLaunchConfig.useShellEnvironment) {
			// TODO: Avoid as any?
			baseEnv = await backend.getShellEnvironment() as any;
		} else {
			baseEnv = await this._terminalProfileResolverService.getEnvironment(this.remoteAuthority);
		}

		const env = await terminalEnvironment.createTerminalEnvironment(shellLaunchConfig, envFromConfigValue, variableResolver, this._productService.version, this._configHelper.config.detectLocale, baseEnv);
		if (!this._isDisposed && !shellLaunchConfig.strictEnv && !shellLaunchConfig.hideFromUser) {
			this._extEnvironmentVariableCollection = this._environmentVariableService.mergedCollection;

			this._register(this._environmentVariableService.onDidChangeCollections(newCollection => this._onEnvironmentVariableCollectionChange(newCollection)));
			// For remote terminals, this is a copy of the mergedEnvironmentCollection created on
			// the remote side. Since the environment collection is synced between the remote and
			// local sides immediately this is a fairly safe way of enabling the env var diffing and
			// info widget. While technically these could differ due to the slight change of a race
			// condition, the chance is minimal plus the impact on the user is also not that great
			// if it happens - it's not worth adding plumbing to sync back the resolved collection.
			await this._extEnvironmentVariableCollection.applyToProcessEnvironment(env, variableResolver);
			if (this._extEnvironmentVariableCollection.map.size > 0) {
				this.environmentVariableInfo = new EnvironmentVariableInfoChangesActive(this._extEnvironmentVariableCollection);
				this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
			}
		}
		return env;
	}

	private async _launchLocalProcess(
		backend: ITerminalBackend,
		shellLaunchConfig: IShellLaunchConfig,
		cols: number,
		rows: number,
		userHome: string | undefined,
		isScreenReaderModeEnabled: boolean,
		variableResolver: terminalEnvironment.VariableResolver | undefined
	): Promise<ITerminalChildProcess> {
		await this._terminalProfileResolverService.resolveShellLaunchConfig(shellLaunchConfig, {
			remoteAuthority: undefined,
			os: OS
		});
		const activeWorkspaceRootUri = this._historyService.getLastActiveWorkspaceRoot(Schemas.file);

		const initialCwd = await terminalEnvironment.getCwd(
			shellLaunchConfig,
			userHome,
			variableResolver,
			activeWorkspaceRootUri,
			this._configHelper.config.cwd,
			this._logService
		);

		const env = await this._resolveEnvironment(backend, variableResolver, shellLaunchConfig);

		const options: ITerminalProcessOptions = {
			shellIntegration: {
				enabled: this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled)
			},
			windowsEnableConpty: this._configHelper.config.windowsEnableConpty && !isScreenReaderModeEnabled,
			environmentVariableCollections: this._extEnvironmentVariableCollection ? serializeEnvironmentVariableCollections(this._extEnvironmentVariableCollection.collections) : undefined
		};
		const shouldPersist = ((this._configurationService.getValue(TaskSettingId.Reconnection) && shellLaunchConfig.reconnectionOwner) || !shellLaunchConfig.isFeatureTerminal) && this._configHelper.config.enablePersistentSessions && !shellLaunchConfig.isTransient;
		return await backend.createProcess(shellLaunchConfig, initialCwd, cols, rows, this._configHelper.config.unicodeVersion, env, options, shouldPersist);
	}

	private _setupPtyHostListeners(backend: ITerminalBackend) {
		if (this._ptyListenersAttached) {
			return;
		}
		this._ptyListenersAttached = true;

		// Mark the process as disconnected is the pty host is unresponsive, the responsive event
		// will fire only when the pty host was already unresponsive
		this._register(backend.onPtyHostUnresponsive(() => {
			this.isDisconnected = true;
			this._onPtyDisconnect.fire();
		}));
		this._ptyResponsiveListener = backend.onPtyHostResponsive(() => {
			this.isDisconnected = false;
			this._onPtyReconnect.fire();
		});
		this._register(toDisposable(() => this._ptyResponsiveListener?.dispose()));

		// When the pty host restarts, reconnect is no longer possible so dispose the responsive
		// listener
		this._register(backend.onPtyHostRestart(async () => {
			// When the pty host restarts, reconnect is no longer possible
			if (!this.isDisconnected) {
				this.isDisconnected = true;
				this._onPtyDisconnect.fire();
			}
			this._ptyResponsiveListener?.dispose();
			this._ptyResponsiveListener = undefined;
			if (this._shellLaunchConfig) {
				if (this._shellLaunchConfig.isFeatureTerminal && !this.reconnectionOwner) {
					// Indicate the process is exited (and gone forever) only for feature terminals
					// so they can react to the exit, this is particularly important for tasks so
					// that it knows that the process is not still active. Note that this is not
					// done for regular terminals because otherwise the terminal instance would be
					// disposed.
					this._onExit(-1);
				} else {
					// For normal terminals write a message indicating what happened and relaunch
					// using the previous shellLaunchConfig
					const message = localize('ptyHostRelaunch', "Restarting the terminal because the connection to the shell process was lost...");
					this._onProcessData.fire({ data: formatMessageForTerminal(message, { loudFormatting: true }), trackCommit: false });
					await this.relaunch(this._shellLaunchConfig, this._dimensions.cols, this._dimensions.rows, this._isScreenReaderModeEnabled, false);
				}
			}
		}));
	}

	async getBackendOS(): Promise<OperatingSystem> {
		let os = OS;
		if (!!this.remoteAuthority) {
			const remoteEnv = await this._remoteAgentService.getEnvironment();
			if (!remoteEnv) {
				throw new Error(`Failed to get remote environment for remote authority "${this.remoteAuthority}"`);
			}
			os = remoteEnv.os;
		}
		return os;
	}

	setDimensions(cols: number, rows: number): Promise<void>;
	setDimensions(cols: number, rows: number, sync: false): Promise<void>;
	setDimensions(cols: number, rows: number, sync: true): void;
	setDimensions(cols: number, rows: number, sync?: boolean): Promise<void> | void {
		if (sync) {
			this._resize(cols, rows);
			return;
		}

		return this.ptyProcessReady.then(() => this._resize(cols, rows));
	}

	async setUnicodeVersion(version: '6' | '11'): Promise<void> {
		return this._process?.setUnicodeVersion(version);
	}

	private _resize(cols: number, rows: number) {
		if (!this._process) {
			return;
		}
		// The child process could already be terminated
		try {
			this._process!.resize(cols, rows);
		} catch (error) {
			// We tried to write to a closed pipe / channel.
			if (error.code !== 'EPIPE' && error.code !== 'ERR_IPC_CHANNEL_CLOSED') {
				throw (error);
			}
		}
		this._dimensions.cols = cols;
		this._dimensions.rows = rows;
	}

	async write(data: string): Promise<void> {
		await this.ptyProcessReady;
		this._dataFilter.disableSeamlessRelaunch();
		this._hasWrittenData = true;
		if (this.shellProcessId || this._processType === ProcessType.PsuedoTerminal) {
			if (this._process) {
				// Send data if the pty is ready
				this._process.input(data);
			}
		} else {
			// If the pty is not ready, queue the data received to send later
			this._preLaunchInputQueue.push(data);
		}
	}

	async processBinary(data: string): Promise<void> {
		await this.ptyProcessReady;
		this._dataFilter.disableSeamlessRelaunch();
		this._hasWrittenData = true;
		this._process?.processBinary(data);
	}

	getInitialCwd(): Promise<string> {
		return Promise.resolve(this._initialCwd ? this._initialCwd : '');
	}

	async getLatency(): Promise<number> {
		await this.ptyProcessReady;
		if (!this._process) {
			return Promise.resolve(0);
		}
		if (this._latencyLastMeasured === 0 || this._latencyLastMeasured + LATENCY_MEASURING_INTERVAL < Date.now()) {
			const latencyRequest = this._process.getLatency();
			this._latency = await latencyRequest;
			this._latencyLastMeasured = Date.now();
		}
		return Promise.resolve(this._latency);
	}

	async refreshProperty<T extends ProcessPropertyType>(type: T): Promise<IProcessPropertyMap[T]> {
		if (!this._process) {
			throw new Error('Cannot refresh property when process is not set');
		}
		return this._process.refreshProperty(type);
	}

	async updateProperty<T extends ProcessPropertyType>(type: T, value: IProcessPropertyMap[T]): Promise<void> {
		return this._process?.updateProperty(type, value);
	}

	acknowledgeDataEvent(charCount: number): void {
		this._ackDataBufferer.ack(charCount);
	}

	private _onExit(exitCode: number | undefined): void {
		this._process = null;
		// If the process is marked as launching then mark the process as killed
		// during launch. This typically means that there is a problem with the
		// shell and args.
		if (this.processState === ProcessState.Launching) {
			this._setProcessState(ProcessState.KilledDuringLaunch);
		}

		// If TerminalInstance did not know about the process exit then it was
		// triggered by the process, not on VS Code's side.
		if (this.processState === ProcessState.Running) {
			this._setProcessState(ProcessState.KilledByProcess);
		}

		this._onProcessExit.fire(exitCode);
	}

	private _setProcessState(state: ProcessState) {
		this.processState = state;
		this._onProcessStateChange.fire();
	}

	private _onEnvironmentVariableCollectionChange(newCollection: IMergedEnvironmentVariableCollection): void {
		const diff = this._extEnvironmentVariableCollection!.diff(newCollection);
		if (diff === undefined) {
			// If there are no longer differences, remove the stale info indicator
			if (this.environmentVariableInfo instanceof EnvironmentVariableInfoStale) {
				this.environmentVariableInfo = new EnvironmentVariableInfoChangesActive(this._extEnvironmentVariableCollection!);
				this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
			}
			return;
		}
		this.environmentVariableInfo = this._instantiationService.createInstance(EnvironmentVariableInfoStale, diff, this._instanceId);
		this._onEnvironmentVariableInfoChange.fire(this.environmentVariableInfo);
	}
}

class AckDataBufferer {
	private _unsentCharCount: number = 0;

	constructor(
		private readonly _callback: (charCount: number) => void
	) {
	}

	ack(charCount: number) {
		this._unsentCharCount += charCount;
		while (this._unsentCharCount > FlowControlConstants.CharCountAckSize) {
			this._unsentCharCount -= FlowControlConstants.CharCountAckSize;
			this._callback(FlowControlConstants.CharCountAckSize);
		}
	}
}

const enum SeamlessRelaunchConstants {
	/**
	 * How long to record data events for new terminals.
	 */
	RecordTerminalDuration = 10000,
	/**
	 * The maximum duration after a relaunch occurs to trigger a swap.
	 */
	SwapWaitMaximumDuration = 3000
}

/**
 * Filters data events from the process and supports seamlessly restarting swapping out the process
 * with another, delaying the swap in output in order to minimize flickering/clearing of the
 * terminal.
 */
class SeamlessRelaunchDataFilter extends Disposable {
	private _firstRecorder?: TerminalRecorder;
	private _secondRecorder?: TerminalRecorder;
	private _firstDisposable?: IDisposable;
	private _secondDisposable?: IDisposable;
	private _dataListener?: IDisposable;
	private _activeProcess?: ITerminalChildProcess;
	private _disableSeamlessRelaunch: boolean = false;

	private _swapTimeout?: number;

	private readonly _onProcessData = this._register(new Emitter<string | IProcessDataEvent>());
	get onProcessData(): Event<string | IProcessDataEvent> { return this._onProcessData.event; }

	constructor(
		@ILogService private readonly _logService: ILogService
	) {
		super();
	}

	newProcess(process: ITerminalChildProcess, reset: boolean) {
		// Stop listening to the old process and trigger delayed shutdown (for hang issue #71966)
		this._dataListener?.dispose();
		this._activeProcess?.shutdown(false);

		this._activeProcess = process;

		// Start firing events immediately if:
		// - there's no recorder, which means it's a new terminal
		// - this is not a reset, so seamless relaunch isn't necessary
		// - seamless relaunch is disabled because the terminal has accepted input
		if (!this._firstRecorder || !reset || this._disableSeamlessRelaunch) {
			this._firstDisposable?.dispose();
			[this._firstRecorder, this._firstDisposable] = this._createRecorder(process);
			if (this._disableSeamlessRelaunch && reset) {
				this._onProcessData.fire('\x1bc');
			}
			this._dataListener = process.onProcessData(e => this._onProcessData.fire(e));
			this._disableSeamlessRelaunch = false;
			return;
		}

		// Trigger a swap if there was a recent relaunch
		if (this._secondRecorder) {
			this.triggerSwap();
		}

		this._swapTimeout = window.setTimeout(() => this.triggerSwap(), SeamlessRelaunchConstants.SwapWaitMaximumDuration);

		// Pause all outgoing data events
		this._dataListener?.dispose();

		this._firstDisposable?.dispose();
		const recorder = this._createRecorder(process);
		[this._secondRecorder, this._secondDisposable] = recorder;
	}

	/**
	 * Disables seamless relaunch for the active process
	 */
	disableSeamlessRelaunch() {
		this._disableSeamlessRelaunch = true;
		this._stopRecording();
		this.triggerSwap();
	}

	/**
	 * Trigger the swap of the processes if needed (eg. timeout, input)
	 */
	triggerSwap() {
		// Clear the swap timeout if it exists
		if (this._swapTimeout) {
			window.clearTimeout(this._swapTimeout);
			this._swapTimeout = undefined;
		}

		// Do nothing if there's nothing being recorder
		if (!this._firstRecorder) {
			return;
		}
		// Clear the first recorder if no second process was attached before the swap trigger
		if (!this._secondRecorder) {
			this._firstRecorder = undefined;
			this._firstDisposable?.dispose();
			return;
		}

		// Generate data for each recorder
		const firstData = this._getDataFromRecorder(this._firstRecorder);
		const secondData = this._getDataFromRecorder(this._secondRecorder);

		// Re-write the terminal if the data differs
		if (firstData === secondData) {
			this._logService.trace(`Seamless terminal relaunch - identical content`);
		} else {
			this._logService.trace(`Seamless terminal relaunch - resetting content`);
			// Fire full reset (RIS) followed by the new data so the update happens in the same frame
			this._onProcessData.fire({ data: `\x1bc${secondData}`, trackCommit: false });
		}

		// Set up the new data listener
		this._dataListener?.dispose();
		this._dataListener = this._activeProcess!.onProcessData(e => this._onProcessData.fire(e));

		// Replace first recorder with second
		this._firstRecorder = this._secondRecorder;
		this._firstDisposable?.dispose();
		this._firstDisposable = this._secondDisposable;
		this._secondRecorder = undefined;
	}

	private _stopRecording() {
		// Continue recording if a swap is coming
		if (this._swapTimeout) {
			return;
		}
		// Stop recording
		this._firstRecorder = undefined;
		this._firstDisposable?.dispose();
		this._secondRecorder = undefined;
		this._secondDisposable?.dispose();
	}

	private _createRecorder(process: ITerminalChildProcess): [TerminalRecorder, IDisposable] {
		const recorder = new TerminalRecorder(0, 0);
		const disposable = process.onProcessData(e => recorder.handleData(typeof e === 'string' ? e : e.data));
		return [recorder, disposable];
	}

	private _getDataFromRecorder(recorder: TerminalRecorder): string {
		return recorder.generateReplayEventSync().events.filter(e => !!e.data).map(e => e.data).join('');
	}
}
