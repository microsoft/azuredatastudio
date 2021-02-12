/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { Event, Emitter } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import * as os from 'os';
import * as path from 'vs/base/common/path';
import product from 'vs/platform/product/common/product';
import * as platform from 'vs/base/common/platform';
import * as terminalEnvironment from 'vs/workbench/contrib/terminal/common/terminalEnvironment';
import { IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { ILogService } from 'vs/platform/log/common/log';
import { IShellLaunchConfig, ITerminalLaunchError } from 'vs/workbench/contrib/terminal/common/terminal';
import { TerminalProcess } from 'vs/workbench/contrib/terminal/node/terminalProcess';
import { Disposable } from 'vs/base/common/lifecycle';
import { TerminalDataBufferer } from 'vs/workbench/contrib/terminal/common/terminalDataBuffering';
import { ISendInputToTerminalProcessArguments, ICompleteTerminalConfiguration, ICreateTerminalProcessArguments, ICreateTerminalProcessResult, IStartTerminalProcessArguments, IOnTerminalProcessEventArguments, IRemoteTerminalProcessEvent, IRemoteTerminalProcessDataEvent, IRemoteTerminalProcessReadyEvent, IRemoteTerminalProcessTitleChangedEvent, IRemoteTerminalProcessExitEvent, IShutdownTerminalProcessArguments, IResizeTerminalProcessArguments, IGetTerminalCwdArguments, IGetTerminalInitialCwdArguments, IRemoteTerminalDescriptionDto, IRemoteTerminalProcessExecCommandEvent, ISendCommandResultToTerminalProcessArguments, IWorkspaceFolderData, IRemoteTerminalProcessReplayEvent, IRemoteTerminalProcessOrphanQuestionEvent, IOrphanQuestionReplyArgs, IListTerminalsArgs } from 'vs/workbench/contrib/terminal/common/remoteTerminalChannel';
import { getMainProcessParentEnv } from 'vs/workbench/contrib/terminal/node/terminalEnvironment';
import { getSystemShell } from 'vs/workbench/contrib/terminal/node/terminal';
import { AbstractVariableResolverService } from 'vs/workbench/services/configurationResolver/common/variableResolver';
import { RemoteAgentConnectionContext } from 'vs/platform/remote/common/remoteAgentEnvironment';
import { createRemoteURITransformer } from 'vs/server/remoteUriTransformer';
import { IURITransformer } from 'vs/base/common/uriIpc';
import { deserializeEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariableShared';
import { IEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariable';
import { MergedEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariableCollection';
import { CLIServerBase, ICommandsExecuter } from 'vs/workbench/api/node/extHostCLIServer';
import { createRandomIPCHandle } from 'vs/base/parts/ipc/node/ipc.net';
import { cloneAndChange } from 'vs/base/common/objects';
import { buildUserEnvironment } from 'vs/server/extensionHostConnection';
import { ServerEnvironmentService } from 'vs/server/serverEnvironmentService';
import { IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { Barrier, Queue, RunOnceScheduler } from 'vs/base/common/async';
import { printTime } from 'vs/server/remoteExtensionManagement';
import { ProtocolConstants } from 'vs/base/parts/ipc/common/ipc.net';

const MAX_RECORDER_DATA_SIZE = 1024 * 1024; // 1MB

class CustomVariableResolver extends AbstractVariableResolverService {
	constructor(
		env: platform.IProcessEnvironment,
		workspaceFolders: IWorkspaceFolder[],
		activeFileResource: URI | undefined,
		resolvedVariables: { [name: string]: string; }
	) {
		super({
			getFolderUri: (folderName: string): URI | undefined => {
				const found = workspaceFolders.filter(f => f.name === folderName);
				if (found && found.length > 0) {
					return found[0].uri;
				}
				return undefined;
			},
			getWorkspaceFolderCount: (): number => {
				return workspaceFolders.length;
			},
			getConfigurationValue: (folderUri: URI, section: string): string | undefined => {
				return resolvedVariables[`config:${section}`];
			},
			getExecPath: (): string | undefined => {
				return env['VSCODE_EXEC_PATH'];
			},
			getFilePath: (): string | undefined => {
				if (activeFileResource) {
					return path.normalize(activeFileResource.fsPath);
				}
				return undefined;
			},
			getSelectedText: (): string | undefined => {
				return resolvedVariables['selectedText'];
			},
			getLineNumber: (): string | undefined => {
				return resolvedVariables['lineNumber'];
			}
		}, undefined, env);
	}
}

export class RemoteTerminalChannel implements IServerChannel<RemoteAgentConnectionContext> {

	private static _nextTerminalId = 1;

	private readonly _terminals = new Map<number, TerminalProcessData>();

	constructor(
		private readonly _logService: ILogService,
		private readonly _environmentService: ServerEnvironmentService,
	) {
		this._terminals = new Map<number, TerminalProcessData>();
	}

	async call(ctx: RemoteAgentConnectionContext, command: string, arg?: any): Promise<any> {
		switch (command) {
			case '$createTerminalProcess': {
				const uriTransformer = createRemoteURITransformer(ctx.remoteAuthority);
				const args = <ICreateTerminalProcessArguments>arg;
				return this._createTerminalProcess(uriTransformer, args);
			}

			case '$startTerminalProcess': {
				const args = <IStartTerminalProcessArguments>arg;
				return this._startTerminalProcess(args);
			}

			case '$sendInputToTerminalProcess': {
				const args = <ISendInputToTerminalProcessArguments>arg;
				return this._sendInputToTerminalProcess(args);
			}

			case '$shutdownTerminalProcess': {
				const args = <IShutdownTerminalProcessArguments>arg;
				return this._shutdownTerminalProcess(args);
			}

			case '$resizeTerminalProcess': {
				const args = <IResizeTerminalProcessArguments>arg;
				return this._resizeTerminalProcess(args);
			}

			case '$getTerminalInitialCwd': {
				const args = <IGetTerminalInitialCwdArguments>arg;
				return this._getTerminalInitialCwd(args);
			}

			case '$getTerminalCwd': {
				const args = <IGetTerminalCwdArguments>arg;
				return this._getTerminalCwd(args);
			}

			case '$sendCommandResultToTerminalProcess': {
				const args = <ISendCommandResultToTerminalProcessArguments>arg;
				return this._sendCommandResultToTerminalProcess(args);
			}

			case '$orphanQuestionReply': {
				const args = <IOrphanQuestionReplyArgs>arg;
				return this._orphanQuestionReply(args);
			}

			case '$listTerminals': {
				const args = <IListTerminalsArgs>arg;
				return this._listTerminals(args);
			}
		}

		throw new Error(`IPC Command ${command} not found`);
	}

	private async _createTerminalProcess(uriTransformer: IURITransformer, args: ICreateTerminalProcessArguments): Promise<ICreateTerminalProcessResult> {

		const shellLaunchConfig: IShellLaunchConfig = {
			name: args.shellLaunchConfig.name,
			executable: args.shellLaunchConfig.executable,
			args: args.shellLaunchConfig.args,
			cwd: (
				typeof args.shellLaunchConfig.cwd === 'string' || typeof args.shellLaunchConfig.cwd === 'undefined'
					? args.shellLaunchConfig.cwd
					: URI.revive(uriTransformer.transformIncoming(args.shellLaunchConfig.cwd))
			),
			env: args.shellLaunchConfig.env
		};

		const newEnv = await buildUserEnvironment(args.resolverEnv, platform.language, this._environmentService, this._logService);

		const reviveWorkspaceFolder = (workspaceData: IWorkspaceFolderData): IWorkspaceFolder => {
			return {
				uri: URI.revive(uriTransformer.transformIncoming(workspaceData.uri)),
				name: workspaceData.name,
				index: workspaceData.index,
				toResource: () => {
					throw new Error('Not implemented');
				}
			};
		};
		const workspaceFolders = args.workspaceFolders.map(reviveWorkspaceFolder);
		const activeWorkspaceFolder = args.activeWorkspaceFolder ? reviveWorkspaceFolder(args.activeWorkspaceFolder) : undefined;
		const activeFileResource = args.activeFileResource ? URI.revive(uriTransformer.transformIncoming(args.activeFileResource)) : undefined;
		const customVariableResolver = new CustomVariableResolver(newEnv, workspaceFolders, activeFileResource, args.resolvedVariables);
		const variableResolver = terminalEnvironment.createVariableResolver(activeWorkspaceFolder, customVariableResolver);

		// Merge in shell and args from settings
		const envPlatformKey = platform.isWindows ? 'terminal.integrated.env.windows' : (platform.isMacintosh ? 'terminal.integrated.env.osx' : 'terminal.integrated.env.linux');
		if (!shellLaunchConfig.executable) {
			shellLaunchConfig.executable = this._getDefaultShell(false, args.configuration, variableResolver, args.isWorkspaceShellAllowed, newEnv);
			shellLaunchConfig.args = this._getDefaultShellArgs(false, args.configuration, variableResolver, args.isWorkspaceShellAllowed);
		} else {
			if (variableResolver) {
				shellLaunchConfig.executable = variableResolver(shellLaunchConfig.executable);
				if (shellLaunchConfig.args) {
					if (Array.isArray(shellLaunchConfig.args)) {
						const resolvedArgs: string[] = [];
						for (const arg of shellLaunchConfig.args) {
							resolvedArgs.push(variableResolver(arg));
						}
						shellLaunchConfig.args = resolvedArgs;
					} else {
						shellLaunchConfig.args = variableResolver(shellLaunchConfig.args);
					}
				}
			}
		}

		// Get the initial cwd
		const initialCwd = terminalEnvironment.getCwd(shellLaunchConfig, os.homedir(), variableResolver, activeWorkspaceFolder?.uri, args.configuration['terminal.integrated.cwd'], this._logService);
		shellLaunchConfig.cwd = initialCwd;

		const envFromConfig = args.configuration[envPlatformKey];
		const baseEnv = args.configuration['terminal.integrated.inheritEnv'] ? newEnv : await this._getNonInheritedEnv(newEnv);
		const env = terminalEnvironment.createTerminalEnvironment(
			shellLaunchConfig,
			envFromConfig,
			variableResolver,
			args.isWorkspaceShellAllowed,
			product.version,
			args.configuration['terminal.integrated.detectLocale'],
			baseEnv
		);

		// Apply extension environment variable collections to the environment
		if (!shellLaunchConfig.strictEnv) {
			const entries: [string, IEnvironmentVariableCollection][] = [];
			for (const [k, v] of args.envVariableCollections) {
				entries.push([k, { map: deserializeEnvironmentVariableCollection(v) }]);
			}
			const envVariableCollections = new Map<string, IEnvironmentVariableCollection>(entries);
			const mergedCollection = new MergedEnvironmentVariableCollection(envVariableCollections);
			mergedCollection.applyToProcessEnvironment(env);
		}

		// Fork the process and listen for messages
		this._logService.debug(`Terminal process launching on ext host`, { shellLaunchConfig, initialCwd, cols: args.cols, rows: args.rows, env });

		const ipcHandlePath = createRandomIPCHandle();
		env.VSCODE_IPC_HOOK_CLI = ipcHandlePath;
		// TODO@remoteAgentTerminals remove this later
		env['USES_VSCODE_SERVER_SPAWN'] = 'true';
		const id = RemoteTerminalChannel._nextTerminalId++;
		const terminalProcess = new TerminalProcess(shellLaunchConfig, initialCwd, args.cols, args.rows, env, newEnv, false, this._logService);
		const terminalProcessData = new TerminalProcessData(id, terminalProcess, args.workspaceId, args.workspaceName, args.shouldPersistTerminal, args.cols, args.rows, uriTransformer, ipcHandlePath, this._logService, () => {
			terminalProcessData.dispose();
			this._terminals.delete(id);
		});
		this._terminals.set(id, terminalProcessData);

		return {
			terminalId: id,
			resolvedShellLaunchConfig: shellLaunchConfig
		};
	}

	private async _startTerminalProcess(args: IStartTerminalProcessArguments): Promise<ITerminalLaunchError | undefined> {
		const terminalProcessData = this._terminals.get(args.id);
		if (!terminalProcessData) {
			return { message: 'Missing terminal' };
		}

		const error = await terminalProcessData.start();
		if (error) {
			// TODO: Teardown?
			return error;
		}

		return undefined;
	}

	private _getDefaultShell(useAutomationShell: boolean, configuration: ICompleteTerminalConfiguration, variableResolver: terminalEnvironment.VariableResolver | undefined, isWorkspaceShellAllowed: boolean, remoteExtHostEnv: platform.IProcessEnvironment): string {
		const fetchSetting = (key: terminalEnvironment.TerminalShellSetting): { userValue: string | string[] | undefined, value: string | string[] | undefined, defaultValue: string | string[] | undefined } => {
			return configuration[key];
		};
		return terminalEnvironment.getDefaultShell(
			fetchSetting,
			isWorkspaceShellAllowed,
			getSystemShell(platform.platform),
			remoteExtHostEnv.hasOwnProperty('PROCESSOR_ARCHITEW6432'),
			remoteExtHostEnv.windir,
			variableResolver,
			this._logService,
			useAutomationShell
		);
	}

	private _getDefaultShellArgs(useAutomationShell: boolean, configuration: ICompleteTerminalConfiguration, variableResolver: terminalEnvironment.VariableResolver | undefined, isWorkspaceShellAllowed: boolean): string[] | string {
		const fetchSetting = (key: terminalEnvironment.TerminalShellSetting | terminalEnvironment.TerminalShellArgsSetting): { userValue: string | string[] | undefined, value: string | string[] | undefined, defaultValue: string | string[] | undefined } => {
			return configuration[key];
		};
		return terminalEnvironment.getDefaultShellArgs(
			fetchSetting,
			isWorkspaceShellAllowed,
			useAutomationShell,
			variableResolver,
			this._logService
		);
	}

	private _getNonInheritedEnv(remoteExtHostEnv: platform.IProcessEnvironment): Promise<platform.IProcessEnvironment> {
		return getMainProcessParentEnv(remoteExtHostEnv);
	}

	private _getTerminalOrThrow(id: number): TerminalProcessData {
		const terminalProcessData = this._terminals.get(id);
		if (!terminalProcessData) {
			throw new Error('Missing terminal');
		}

		return terminalProcessData;
	}

	private _sendInputToTerminalProcess(args: ISendInputToTerminalProcessArguments): void {
		const terminalProcessData = this._getTerminalOrThrow(args.id);
		terminalProcessData.input(args.data);
	}

	private _shutdownTerminalProcess(args: IShutdownTerminalProcessArguments): void {
		const terminalProcessData = this._getTerminalOrThrow(args.id);
		terminalProcessData.shutdown(args.immediate);
	}

	private _resizeTerminalProcess(args: IResizeTerminalProcessArguments): void {
		const terminalProcessData = this._getTerminalOrThrow(args.id);
		terminalProcessData.resize(args.cols, args.rows);
	}

	private _getTerminalInitialCwd(args: IGetTerminalInitialCwdArguments): Promise<string> {
		const terminalProcessData = this._getTerminalOrThrow(args.id);
		return terminalProcessData.getInitialCwd();
	}

	private _getTerminalCwd(args: IGetTerminalCwdArguments): Promise<string> {
		const terminalProcessData = this._getTerminalOrThrow(args.id);
		return terminalProcessData.getCwd();
	}

	private _sendCommandResultToTerminalProcess(args: ISendCommandResultToTerminalProcessArguments): void {
		const terminalProcessData = this._getTerminalOrThrow(args.id);
		terminalProcessData.sendCommandResult(args.reqId, args.isError, args.payload);
	}

	private _orphanQuestionReply(args: IOrphanQuestionReplyArgs): void {
		const terminalProcessData = this._getTerminalOrThrow(args.id);
		terminalProcessData.orphanQuestionReply();
	}

	private async _listTerminals(args: IListTerminalsArgs): Promise<IRemoteTerminalDescriptionDto[]> {
		if (args.isInitialization) {
			// there is a fresh connection => reduce the grace time on all existing terminals!
			for (const [, terminal] of this._terminals) {
				terminal.reduceGraceTime();
			}
		}

		const persistentTerminals = Array.from(this._terminals.entries())
			.filter(([_id, terminalProcessData]) => terminalProcessData.shouldPersistTerminal);

		this._logService.info(`Listing ${persistentTerminals.length} persistent terminals, ${this._terminals.size} total terminals`);
		const promises = persistentTerminals.map(async ([id, terminalProcessData]) => {
			const [cwd, isOrphan] = await Promise.all([terminalProcessData.getCwd(), terminalProcessData.isOrphaned()]);
			return {
				id,
				title: terminalProcessData.title,
				pid: terminalProcessData.pid,
				workspaceId: terminalProcessData.workspaceId,
				workspaceName: terminalProcessData.workspaceName,
				cwd,
				isOrphan
			};
		});
		const allTerminals = await Promise.all(promises);
		return allTerminals.filter(entry => entry.isOrphan);
	}

	listen(_: any, event: string, arg: any): Event<any> {
		switch (event) {
			case '$onTerminalProcessEvent': {
				const args = <IOnTerminalProcessEventArguments>arg;
				return this._onTerminalProcessEvent(args);
			}

			default:
				break;
		}

		throw new Error('Not supported');
	}

	private _onTerminalProcessEvent(args: IOnTerminalProcessEventArguments): Event<IRemoteTerminalProcessEvent> {
		const terminalProcessData = this._terminals.get(args.id);
		if (!terminalProcessData) {
			throw new Error('Missing terminal');
		}

		return terminalProcessData.events;
	}
}

interface RecorderEntry {
	cols: number;
	rows: number;
	data: string[];
}

class TerminalRecorder {

	private _entries: RecorderEntry[];
	private _totalDataLength: number;

	constructor(cols: number, rows: number) {
		this._entries = [{ cols, rows, data: [] }];
		this._totalDataLength = 0;
	}

	public recordResize(cols: number, rows: number): void {
		if (this._entries.length > 0) {
			const lastEntry = this._entries[this._entries.length - 1];
			if (lastEntry.data.length === 0) {
				// last entry is just a resize, so just remove it
				this._entries.pop();
			}
		}

		if (this._entries.length > 0) {
			const lastEntry = this._entries[this._entries.length - 1];
			if (lastEntry.cols === cols && lastEntry.rows === rows) {
				// nothing changed
				return;
			}
			if (lastEntry.cols === 0 && lastEntry.rows === 0) {
				// we finally received a good size!
				lastEntry.cols = cols;
				lastEntry.rows = rows;
				return;
			}
		}

		this._entries.push({ cols, rows, data: [] });
	}

	public recordData(data: string): void {
		const lastEntry = this._entries[this._entries.length - 1];
		lastEntry.data.push(data);

		this._totalDataLength += data.length;
		while (this._totalDataLength > MAX_RECORDER_DATA_SIZE) {
			const firstEntry = this._entries[0];
			const remainingToDelete = this._totalDataLength - MAX_RECORDER_DATA_SIZE;
			if (remainingToDelete >= firstEntry.data[0].length) {
				// the first data piece must be deleted
				this._totalDataLength -= firstEntry.data[0].length;
				firstEntry.data.shift();
				if (firstEntry.data.length === 0) {
					// the first entry must be deleted
					this._entries.shift();
				}
			} else {
				// the first data piece must be partially deleted
				firstEntry.data[0] = firstEntry.data[0].substr(remainingToDelete);
				this._totalDataLength -= remainingToDelete;
			}
		}
	}

	public generateReplayEvent(): IRemoteTerminalProcessReplayEvent {
		// normalize entries to one element per data array
		this._entries.forEach((entry) => {
			if (entry.data.length > 0) {
				entry.data = [entry.data.join('')];
			}
		});
		return {
			type: 'replay',
			events: this._entries.map(entry => ({ cols: entry.cols, rows: entry.rows, data: entry.data[0] ?? '' }))
		};
	}
}

class TerminalProcessData extends Disposable {

	private readonly _events: Emitter<IRemoteTerminalProcessEvent>;
	public readonly events: Event<IRemoteTerminalProcessEvent>;

	private readonly _bufferer: TerminalDataBufferer;
	private _lastReqId = 0;
	private readonly _pendingCommands = new Map<number, { resolve: (data: any) => void; reject: (err: any) => void; }>();

	private readonly _recorder: TerminalRecorder;
	private _seenFirstListener: boolean;

	private _orphanQuestionBarrier: AutoOpenBarrier | null;
	private _orphanQuestionReplyTime: number;
	private _orphanRequestQueue = new Queue<boolean>();
	private _disconnectRunner1: RunOnceScheduler;
	private _disconnectRunner2: RunOnceScheduler;

	private _title = '';
	private _pid = -1;

	public get pid(): number {
		return this._pid;
	}

	public get title(): string {
		return this._title;
	}

	constructor(
		private readonly _id: number,
		private readonly _terminalProcess: TerminalProcess,
		public readonly workspaceId: string,
		public readonly workspaceName: string,
		public readonly shouldPersistTerminal: boolean,
		cols: number, rows: number,
		private readonly _uriTransformer: IURITransformer,
		ipcHandlePath: string,
		private readonly _logService: ILogService,
		private readonly _onExit: () => void,
	) {
		super();

		this._recorder = new TerminalRecorder(cols, rows);
		this._seenFirstListener = false;

		this._orphanQuestionBarrier = null;
		this._orphanQuestionReplyTime = 0;
		this._disconnectRunner1 = this._register(new RunOnceScheduler(() => {
			this._logService.info(`The reconnection grace time of ${printTime(ProtocolConstants.ReconnectionGraceTime)} has expired, so the terminal process with pid ${this._pid} will be shutdown.`);
			this.shutdown(true);
		}, ProtocolConstants.ReconnectionGraceTime));
		this._disconnectRunner2 = this._register(new RunOnceScheduler(() => {
			this._logService.info(`The short reconnection grace time of ${printTime(ProtocolConstants.ReconnectionShortGraceTime)} has expired, so the terminal process with pid ${this._pid} will be shutdown.`);
			this.shutdown(true);
		}, ProtocolConstants.ReconnectionShortGraceTime));

		this._events = this._register(new Emitter<IRemoteTerminalProcessEvent>({
			onListenerDidAdd: () => {
				this._disconnectRunner1.cancel();
				this._disconnectRunner2.cancel();
				if (this._seenFirstListener) {
					// only replay events to subsequent (reconnected) listeners
					this._triggerReplay();
				}
				this._seenFirstListener = true;
			},
			onLastListenerRemove: () => {
				if (this.shouldPersistTerminal) {
					this._disconnectRunner1.schedule();
				} else {
					this.shutdown(true);
				}
			}
		}));
		this.events = this._events.event;

		this._bufferer = new TerminalDataBufferer((id, data) => {
			const ev: IRemoteTerminalProcessDataEvent = {
				type: 'data',
				data: data
			};
			this._events.fire(ev);
		});

		this._register(this._terminalProcess.onProcessReady((e: { pid: number, cwd: string }) => {
			this._pid = e.pid;
			const ev: IRemoteTerminalProcessReadyEvent = {
				type: 'ready',
				pid: e.pid,
				cwd: e.cwd
			};
			this._events.fire(ev);
		}));

		this._register(this._terminalProcess.onProcessTitleChanged((title) => {
			this._title = title;
			const ev: IRemoteTerminalProcessTitleChangedEvent = {
				type: 'titleChanged',
				title: title
			};
			this._events.fire(ev);
		}));

		// Buffer data events to reduce the amount of messages going to the renderer
		this._register(this._bufferer.startBuffering(this._id, this._terminalProcess.onProcessData));
		this._register(this._terminalProcess.onProcessData(e => {
			this._recorder.recordData(e);
		}));
		this._register(this._terminalProcess.onProcessExit(exitCode => {
			this._bufferer.stopBuffering(this._id);

			const ev: IRemoteTerminalProcessExitEvent = {
				type: 'exit',
				exitCode: exitCode
			};
			this._events.fire(ev);

			// Remove process reference
			this._onExit();
		}));

		const commandsExecuter: ICommandsExecuter = {
			executeCommand: <T>(id: string, ...args: any[]): Promise<T> => {
				return this._executeCommand(id, args);
			}
		};
		this._register(new CLIServerBase(commandsExecuter, this._logService, ipcHandlePath));
	}

	public start(): Promise<ITerminalLaunchError | undefined> {
		return this._terminalProcess.start();
	}

	public shutdown(immediate: boolean): void {
		return this._terminalProcess.shutdown(immediate);
	}

	public input(data: string): void {
		return this._terminalProcess.input(data);
	}

	public resize(cols: number, rows: number): void {
		this._recorder.recordResize(cols, rows);
		return this._terminalProcess.resize(cols, rows);
	}

	public getInitialCwd(): Promise<string> {
		return this._terminalProcess.getInitialCwd();
	}

	public getCwd(): Promise<string> {
		return this._terminalProcess.getCwd();
	}

	private _triggerReplay(): void {
		const ev = this._recorder.generateReplayEvent();
		let dataLength = 0;
		for (const e of ev.events) {
			dataLength += e.data.length;
		}

		this._logService.info(`Replaying ${dataLength} chars and ${ev.events.length} size events.`);
		this._events.fire(ev);
	}

	private _executeCommand<T>(commandId: string, commandArgs: any[]): Promise<T> {
		let resolve: (data: any) => void;
		let reject: (err: any) => void;
		const result = new Promise<T>((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		});

		const reqId = ++this._lastReqId;
		this._pendingCommands.set(reqId, { resolve: resolve!, reject: reject! });

		const serializedCommandArgs = cloneAndChange(commandArgs, (obj) => {
			if (obj && obj.$mid === 1) {
				// this is UriComponents
				return this._uriTransformer.transformOutgoing(obj);
			}
			if (obj && obj instanceof URI) {
				return this._uriTransformer.transformOutgoingURI(obj);
			}
			return undefined;
		});
		const ev: IRemoteTerminalProcessExecCommandEvent = {
			type: 'execCommand',
			reqId,
			commandId,
			commandArgs: serializedCommandArgs
		};
		this._events.fire(ev);

		return result;
	}

	public sendCommandResult(reqId: number, isError: boolean, serializedPayload: any): void {
		const data = this._pendingCommands.get(reqId);
		if (!data) {
			return;
		}
		this._pendingCommands.delete(reqId);
		const payload = cloneAndChange(serializedPayload, (obj) => {
			if (obj && obj.$mid === 1) {
				// this is UriComponents
				return this._uriTransformer.transformIncoming(obj);
			}
			return undefined;
		});
		if (isError) {
			data.reject(payload);
		} else {
			data.resolve(payload);
		}
	}

	public async orphanQuestionReply(): Promise<void> {
		this._orphanQuestionReplyTime = Date.now();
		if (this._orphanQuestionBarrier) {
			const barrier = this._orphanQuestionBarrier;
			this._orphanQuestionBarrier = null;
			barrier.open();
		}
	}

	public reduceGraceTime(): void {
		if (this._disconnectRunner2.isScheduled()) {
			// we are disconnected and already running the short reconnection timer
			return;
		}
		if (this._disconnectRunner1.isScheduled()) {
			// we are disconnected and running the long reconnection timer
			this._disconnectRunner2.schedule();
		}
	}

	public async isOrphaned(): Promise<boolean> {
		return await this._orphanRequestQueue.queue(async () => this._isOrphaned());
	}

	private async _isOrphaned(): Promise<boolean> {
		if (this._disconnectRunner1.isScheduled() || this._disconnectRunner2.isScheduled()) {
			return true;
		}

		if (!this._orphanQuestionBarrier) {
			// the barrier opens after 4 seconds with or without a reply
			this._orphanQuestionBarrier = new AutoOpenBarrier(4000);
			this._orphanQuestionReplyTime = 0;
			const ev: IRemoteTerminalProcessOrphanQuestionEvent = {
				type: 'orphan?'
			};
			this._events.fire(ev);
		}

		await this._orphanQuestionBarrier.wait();
		return (Date.now() - this._orphanQuestionReplyTime > 500);
	}
}

class AutoOpenBarrier extends Barrier {

	private readonly _timeout: any;

	constructor(autoOpenTimeMs: number) {
		super();
		this._timeout = setTimeout(() => this.open(), autoOpenTimeMs);
	}

	open(): void {
		clearTimeout(this._timeout);
		super.open();
	}
}
