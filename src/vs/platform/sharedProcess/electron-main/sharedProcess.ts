/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IpcMainEvent, MessagePortMain } from 'electron';
import { validatedIpcMain } from 'vs/base/parts/ipc/electron-main/ipcMain';
import { Barrier, DeferredPromise } from 'vs/base/common/async';
import { Disposable } from 'vs/base/common/lifecycle';
import { IEnvironmentMainService } from 'vs/platform/environment/electron-main/environmentMainService';
import { ILifecycleMainService } from 'vs/platform/lifecycle/electron-main/lifecycleMainService';
import { ILogService } from 'vs/platform/log/common/log';
import { ISharedProcessConfiguration } from 'vs/platform/sharedProcess/node/sharedProcess';
import { IUserDataProfilesService } from 'vs/platform/userDataProfile/common/userDataProfile';
import { IPolicyService } from 'vs/platform/policy/common/policy';
import { ILoggerMainService } from 'vs/platform/log/electron-main/loggerService';
import { UtilityProcess } from 'vs/platform/utilityProcess/electron-main/utilityProcess';
import { NullTelemetryService } from 'vs/platform/telemetry/common/telemetryUtils';
import { parseSharedProcessDebugPort } from 'vs/platform/environment/node/environmentService';
import { assertIsDefined } from 'vs/base/common/types';

export class SharedProcess extends Disposable {

	private readonly firstWindowConnectionBarrier = new Barrier();

	private utilityProcess: UtilityProcess | undefined = undefined;

	constructor(
		private readonly machineId: string,
		@IEnvironmentMainService private readonly environmentMainService: IEnvironmentMainService,
		@IUserDataProfilesService private readonly userDataProfilesService: IUserDataProfilesService,
		@ILifecycleMainService private readonly lifecycleMainService: ILifecycleMainService,
		@ILogService private readonly logService: ILogService,
		@ILoggerMainService private readonly loggerMainService: ILoggerMainService,
		@IPolicyService private readonly policyService: IPolicyService,
	) {
		super();

		this.registerListeners();
	}

	private registerListeners(): void {

		// Shared process connections from workbench windows
		validatedIpcMain.on('vscode:createSharedProcessMessageChannel', (e, nonce: string) => this.onWindowConnection(e, nonce));

		// Lifecycle
		this._register(this.lifecycleMainService.onWillShutdown(() => this.onWillShutdown()));
	}

	private async onWindowConnection(e: IpcMainEvent, nonce: string): Promise<void> {
		this.logService.trace('[SharedProcess] on vscode:createSharedProcessMessageChannel');

		// release barrier if this is the first window connection
		if (!this.firstWindowConnectionBarrier.isOpen()) {
			this.firstWindowConnectionBarrier.open();
		}

		// await the shared process to be overall ready
		// we do not just wait for IPC ready because the
		// workbench window will communicate directly

		await this.whenReady();

		// connect to the shared process
		const port = await this.connect();

		// Check back if the requesting window meanwhile closed
		// Since shared process is delayed on startup there is
		// a chance that the window close before the shared process
		// was ready for a connection.

		if (e.sender.isDestroyed()) {
			return port.close();
		}

		// send the port back to the requesting window
		e.sender.postMessage('vscode:createSharedProcessMessageChannelResult', nonce, [port]);
	}

	private onWillShutdown(): void {
		this.logService.trace('[SharedProcess] onWillShutdown');

		this.utilityProcess?.postMessage('vscode:electron-main->shared-process=exit');
		this.utilityProcess = undefined;
	}

	private _whenReady: Promise<void> | undefined = undefined;
	whenReady(): Promise<void> {
		if (!this._whenReady) {
			this._whenReady = (async () => {

				// Wait for shared process being ready to accept connection
				await this.whenIpcReady;

				// Overall signal that the shared process was loaded and
				// all services within have been created.

				const whenReady = new DeferredPromise<void>();
				if (this.utilityProcess) {
					this.utilityProcess.once('vscode:shared-process->electron-main=init-done', () => whenReady.complete());
				} else {
					validatedIpcMain.once('vscode:shared-process->electron-main=init-done', () => whenReady.complete());
				}

				await whenReady.p;
				this.logService.trace('[SharedProcess] Overall ready');
			})();
		}

		return this._whenReady;
	}

	private _whenIpcReady: Promise<void> | undefined = undefined;
	private get whenIpcReady() {
		if (!this._whenIpcReady) {
			this._whenIpcReady = (async () => {

				// Always wait for first window asking for connection
				await this.firstWindowConnectionBarrier.wait();

				// Spawn shared process
				this.createUtilityProcess();

				// Wait for shared process indicating that IPC connections are accepted
				const sharedProcessIpcReady = new DeferredPromise<void>();
				if (this.utilityProcess) {
					this.utilityProcess.once('vscode:shared-process->electron-main=ipc-ready', () => sharedProcessIpcReady.complete());
				} else {
					validatedIpcMain.once('vscode:shared-process->electron-main=ipc-ready', () => sharedProcessIpcReady.complete());
				}

				await sharedProcessIpcReady.p;
				this.logService.trace('[SharedProcess] IPC ready');
			})();
		}

		return this._whenIpcReady;
	}

	private createUtilityProcess(): void {
		this.utilityProcess = this._register(new UtilityProcess(this.logService, NullTelemetryService, this.lifecycleMainService));

		const inspectParams = parseSharedProcessDebugPort(this.environmentMainService.args, this.environmentMainService.isBuilt);
		let execArgv: string[] | undefined = undefined;
		if (inspectParams.port) {
			execArgv = ['--nolazy'];
			if (inspectParams.break) {
				execArgv.push(`--inspect-brk=${inspectParams.port}`);
			} else {
				execArgv.push(`--inspect=${inspectParams.port}`);
			}
		}

		this.utilityProcess.start({
			type: 'shared-process',
			entryPoint: 'vs/code/node/sharedProcess/sharedProcessMain',
			payload: this.createSharedProcessConfiguration(),
			execArgv
		});
	}

	private createSharedProcessConfiguration(): ISharedProcessConfiguration {
		return {
			machineId: this.machineId,
			codeCachePath: this.environmentMainService.codeCachePath,
			profiles: {
				home: this.userDataProfilesService.profilesHome,
				all: this.userDataProfilesService.profiles,
			},
			args: this.environmentMainService.args,
			logLevel: this.loggerMainService.getLogLevel(),
			loggers: this.loggerMainService.getRegisteredLoggers(),
			policiesData: this.policyService.serialize()
		};
	}

	async connect(): Promise<MessagePortMain> {

		// Wait for shared process being ready to accept connection
		await this.whenIpcReady;

		// Connect and return message port
		const utilityProcess = assertIsDefined(this.utilityProcess);
		return utilityProcess.connect();
	}
}
