/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import { Emitter, Event } from 'vs/base/common/event';
import { cloneAndChange } from 'vs/base/common/objects';
import { Disposable } from 'vs/base/common/lifecycle';
import * as path from 'vs/base/common/path';
import * as platform from 'vs/base/common/platform';
import { URI } from 'vs/base/common/uri';
import { IURITransformer } from 'vs/base/common/uriIpc';
import { IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { createRandomIPCHandle } from 'vs/base/parts/ipc/node/ipc.net';
import { ILogService } from 'vs/platform/log/common/log';
import product from 'vs/platform/product/common/product';
import { RemoteAgentConnectionContext } from 'vs/platform/remote/common/remoteAgentEnvironment';
import { IPtyService, IShellLaunchConfig, ITerminalsLayoutInfo } from 'vs/platform/terminal/common/terminal';
import { IGetTerminalLayoutInfoArgs, ISetTerminalLayoutInfoArgs } from 'vs/platform/terminal/common/terminalProcess';
import { IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { buildUserEnvironment } from 'vs/server/extensionHostConnection';
import { createRemoteURITransformer } from 'vs/server/remoteUriTransformer';
import { IServerEnvironmentService } from 'vs/server/serverEnvironmentService';
import { CLIServerBase, ICommandsExecuter } from 'vs/workbench/api/node/extHostCLIServer';
import { IEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariable';
import { MergedEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariableCollection';
import { deserializeEnvironmentVariableCollection } from 'vs/workbench/contrib/terminal/common/environmentVariableShared';
import { ICreateTerminalProcessArguments, ICreateTerminalProcessResult, IWorkspaceFolderData } from 'vs/workbench/contrib/terminal/common/remoteTerminalChannel';
import * as terminalEnvironment from 'vs/workbench/contrib/terminal/common/terminalEnvironment';
import { getMainProcessParentEnv } from 'vs/workbench/contrib/terminal/node/terminalEnvironment';
import { AbstractVariableResolverService } from 'vs/workbench/services/configurationResolver/common/variableResolver';

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
			getAppRoot: (): string | undefined => {
				return env['VSCODE_CWD'];
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
		}, undefined, Promise.resolve(env));
	}
}

export class RemoteTerminalChannel extends Disposable implements IServerChannel<RemoteAgentConnectionContext> {

	private _lastReqId = 0;
	private readonly _pendingCommands = new Map<number, {
		resolve: (data: any) => void;
		reject: (err: any) => void;
		uriTransformer: IURITransformer;
	}>();

	private readonly _onExecuteCommand = this._register(new Emitter<{ reqId: number, commandId: string, commandArgs: any[] }>());
	readonly onExecuteCommand = this._onExecuteCommand.event;

	constructor(
		private readonly _logService: ILogService,
		private readonly _environmentService: IServerEnvironmentService,
		private readonly _ptyService: IPtyService
	) {
		super();
	}

	async call(ctx: RemoteAgentConnectionContext, command: string, args?: any): Promise<any> {
		switch (command) {
			case '$restartPtyHost': return this._ptyService.restartPtyHost?.apply(this._ptyService, args);

			case '$createProcess': {
				const uriTransformer = createRemoteURITransformer(ctx.remoteAuthority);
				return this._createProcess(uriTransformer, <ICreateTerminalProcessArguments>args);
			}
			case '$attachToProcess': return this._ptyService.attachToProcess.apply(this._ptyService, args);

			case '$listProcesses': return this._ptyService.listProcesses.apply(this._ptyService, args);
			case '$orphanQuestionReply': this._ptyService.orphanQuestionReply.apply(this._ptyService, args);

			case '$start': return this._ptyService.start.apply(this._ptyService, args);
			case '$input': return this._ptyService.input.apply(this._ptyService, args);
			case '$acknowledgeDataEvent': return this._ptyService.acknowledgeDataEvent.apply(this._ptyService, args);
			case '$shutdown': return this._ptyService.shutdown.apply(this._ptyService, args);
			case '$resize': return this._ptyService.resize.apply(this._ptyService, args);
			case '$getInitialCwd': return this._ptyService.getInitialCwd.apply(this._ptyService, args);
			case '$getCwd': return this._ptyService.getCwd.apply(this._ptyService, args);

			case '$processBinary': return this._ptyService.processBinary.apply(this._ptyService, args);

			case '$sendCommandResult': return this._sendCommandResult(args[0], args[1], args[2]);
			case '$getDefaultSystemShell': return this._getDefaultSystemShell.apply(this, args);
			case '$getShellEnvironment': return this._getShellEnvironment();
			case '$getTerminalLayoutInfo': return this._getTerminalLayoutInfo(<IGetTerminalLayoutInfoArgs>args);
			case '$setTerminalLayoutInfo': return this._setTerminalLayoutInfo(<ISetTerminalLayoutInfoArgs>args);
			case '$reduceConnectionGraceTime': return this._reduceConnectionGraceTime();
		}

		throw new Error(`IPC Command ${command} not found`);
	}

	listen(_: any, event: string, arg: any): Event<any> {
		switch (event) {
			case '$onPtyHostExitEvent': return this._ptyService.onPtyHostExit || Event.None;
			case '$onPtyHostStartEvent': return this._ptyService.onPtyHostStart || Event.None;
			case '$onPtyHostUnresponsiveEvent': return this._ptyService.onPtyHostUnresponsive || Event.None;
			case '$onPtyHostResponsiveEvent': return this._ptyService.onPtyHostResponsive || Event.None;
			case '$onProcessDataEvent': return this._ptyService.onProcessData;
			case '$onProcessExitEvent': return this._ptyService.onProcessExit;
			case '$onProcessReadyEvent': return this._ptyService.onProcessReady;
			case '$onProcessReplayEvent': return this._ptyService.onProcessReplay;
			case '$onProcessTitleChangedEvent': return this._ptyService.onProcessTitleChanged;
			case '$onProcessShellTypeChangedEvent': return this._ptyService.onProcessShellTypeChanged;
			case '$onProcessOverrideDimensionsEvent': return this._ptyService.onProcessOverrideDimensions;
			case '$onProcessResolvedShellLaunchConfigEvent': return this._ptyService.onProcessResolvedShellLaunchConfig;
			case '$onProcessOrphanQuestion': return this._ptyService.onProcessOrphanQuestion;
			case '$onExecuteCommand': return this.onExecuteCommand;
			default:
				break;
		}

		throw new Error('Not supported');
	}

	private async _createProcess(uriTransformer: IURITransformer, args: ICreateTerminalProcessArguments): Promise<ICreateTerminalProcessResult> {
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

		const newEnv = await buildUserEnvironment(args.resolverEnv, platform.language, false, this._environmentService, this._logService);

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
		const variableResolver = terminalEnvironment.createVariableResolver(activeWorkspaceFolder, process.env, customVariableResolver);

		// Get the initial cwd
		const initialCwd = terminalEnvironment.getCwd(shellLaunchConfig, os.homedir(), variableResolver, activeWorkspaceFolder?.uri, args.configuration['terminal.integrated.cwd'], this._logService);
		shellLaunchConfig.cwd = initialCwd;

		const envPlatformKey = platform.isWindows ? 'terminal.integrated.env.windows' : (platform.isMacintosh ? 'terminal.integrated.env.osx' : 'terminal.integrated.env.linux');
		const envFromConfig = args.configuration[envPlatformKey];
		const baseEnv = args.configuration['terminal.integrated.inheritEnv'] ? newEnv : await this._getNonInheritedEnv(newEnv);
		const env = terminalEnvironment.createTerminalEnvironment(
			shellLaunchConfig,
			envFromConfig,
			variableResolver,
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
		this._logService.debug(`Terminal process launching on remote agent`, { shellLaunchConfig, initialCwd, cols: args.cols, rows: args.rows, env });

		// Setup the CLI server to support forwarding commands run from the CLI
		const ipcHandlePath = createRandomIPCHandle();
		env.VSCODE_IPC_HOOK_CLI = ipcHandlePath;
		const commandsExecuter: ICommandsExecuter = {
			executeCommand: <T>(id: string, ...args: any[]): Promise<T> => this._executeCommand(id, args, uriTransformer)
		};
		const cliServer = new CLIServerBase(commandsExecuter, this._logService, ipcHandlePath);

		const id = await this._ptyService.createProcess(shellLaunchConfig, initialCwd, args.cols, args.rows, env, newEnv, false, args.shouldPersistTerminal, args.workspaceId, args.workspaceName);
		this._ptyService.onProcessExit(e => e.id === id && cliServer.dispose());

		return {
			persistentTerminalId: id,
			resolvedShellLaunchConfig: shellLaunchConfig
		};
	}

	private _executeCommand<T>(commandId: string, commandArgs: any[], uriTransformer: IURITransformer): Promise<T> {
		let resolve!: (data: any) => void;
		let reject!: (err: any) => void;
		const result = new Promise<T>((_resolve, _reject) => {
			resolve = _resolve;
			reject = _reject;
		});

		const reqId = ++this._lastReqId;
		this._pendingCommands.set(reqId, { resolve, reject, uriTransformer });

		const serializedCommandArgs = cloneAndChange(commandArgs, (obj) => {
			if (obj && obj.$mid === 1) {
				// this is UriComponents
				return uriTransformer.transformOutgoing(obj);
			}
			if (obj && obj instanceof URI) {
				return uriTransformer.transformOutgoingURI(obj);
			}
			return undefined;
		});
		this._onExecuteCommand.fire({
			reqId,
			commandId,
			commandArgs: serializedCommandArgs
		});

		return result;
	}

	private _getNonInheritedEnv(remoteExtHostEnv: platform.IProcessEnvironment): Promise<platform.IProcessEnvironment> {
		return getMainProcessParentEnv(remoteExtHostEnv);
	}

	private _sendCommandResult(reqId: number, isError: boolean, serializedPayload: any): void {
		const data = this._pendingCommands.get(reqId);
		if (!data) {
			return;
		}
		this._pendingCommands.delete(reqId);
		const payload = cloneAndChange(serializedPayload, (obj) => {
			if (obj && obj.$mid === 1) {
				// this is UriComponents
				return data.uriTransformer.transformIncoming(obj);
			}
			return undefined;
		});
		if (isError) {
			data.reject(payload);
		} else {
			data.resolve(payload);
		}
	}

	private _getDefaultSystemShell(osOverride?: platform.OperatingSystem): Promise<string> {
		return this._ptyService.getDefaultSystemShell(osOverride);
	}

	private _getShellEnvironment(): platform.IProcessEnvironment {
		return { ...process.env };
	}

	private _setTerminalLayoutInfo(args: ISetTerminalLayoutInfoArgs): void {
		this._ptyService.setTerminalLayoutInfo(args);
	}

	private async _getTerminalLayoutInfo(args: IGetTerminalLayoutInfoArgs): Promise<ITerminalsLayoutInfo | undefined> {
		return this._ptyService.getTerminalLayoutInfo(args);
	}

	private _reduceConnectionGraceTime(): Promise<void> {
		return this._ptyService.reduceConnectionGraceTime();
	}
}
