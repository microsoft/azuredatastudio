/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import * as objects from 'vs/base/common/objects';
import { parseArgs, OPTIONS } from 'vs/platform/environment/node/argv';
import { ICommonIssueService, IssueReporterData, IssueReporterFeatures, ProcessExplorerData } from 'vs/platform/issue/common/issue';
import { BrowserWindow, ipcMain, screen, IpcMainEvent, Display, shell } from 'electron';
import { ILaunchMainService } from 'vs/platform/launch/electron-main/launchMainService';
import { PerformanceInfo, isRemoteDiagnosticError } from 'vs/platform/diagnostics/common/diagnostics';
import { IDiagnosticsService } from 'vs/platform/diagnostics/node/diagnosticsService';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { INativeEnvironmentService } from 'vs/platform/environment/node/environmentService';
import { isMacintosh, IProcessEnvironment } from 'vs/base/common/platform';
import { ILogService } from 'vs/platform/log/common/log';
import { IWindowState } from 'vs/platform/windows/electron-main/windows';
import { listProcesses } from 'vs/base/node/ps';
import { IDialogMainService } from 'vs/platform/dialogs/electron-main/dialogs';
import { URI } from 'vs/base/common/uri';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

const DEFAULT_BACKGROUND_COLOR = '#1E1E1E';

export const IIssueMainService = createDecorator<IIssueMainService>('issueMainService');

export interface IIssueMainService extends ICommonIssueService { }

export class IssueMainService implements ICommonIssueService {
	_serviceBrand: undefined;
	_issueWindow: BrowserWindow | null = null;
	_issueParentWindow: BrowserWindow | null = null;
	_processExplorerWindow: BrowserWindow | null = null;
	_processExplorerParentWindow: BrowserWindow | null = null;

	constructor(
		private machineId: string,
		private userEnv: IProcessEnvironment,
		@IEnvironmentService private readonly environmentService: INativeEnvironmentService,
		@ILaunchMainService private readonly launchMainService: ILaunchMainService,
		@ILogService private readonly logService: ILogService,
		@IDiagnosticsService private readonly diagnosticsService: IDiagnosticsService,
		@IDialogMainService private readonly dialogMainService: IDialogMainService
	) {
		this.registerListeners();
	}

	private registerListeners(): void {
		ipcMain.on('vscode:issueSystemInfoRequest', async (event: IpcMainEvent) => {
			Promise.all([this.launchMainService.getMainProcessInfo(), this.launchMainService.getRemoteDiagnostics({ includeProcesses: false, includeWorkspaceMetadata: false })])
				.then(result => {
					const [info, remoteData] = result;
					this.diagnosticsService.getSystemInfo(info, remoteData).then(msg => {
						event.sender.send('vscode:issueSystemInfoResponse', msg);
					});
				});
		});

		ipcMain.on('vscode:listProcesses', async (event: IpcMainEvent) => {
			const processes = [];

			try {
				const mainPid = await this.launchMainService.getMainProcessId();
				processes.push({ name: localize('local', "Local"), rootProcess: await listProcesses(mainPid) });
				(await this.launchMainService.getRemoteDiagnostics({ includeProcesses: true }))
					.forEach(data => {
						if (isRemoteDiagnosticError(data)) {
							processes.push({
								name: data.hostName,
								rootProcess: data
							});
						} else {
							if (data.processes) {
								processes.push({
									name: data.hostName,
									rootProcess: data.processes
								});
							}
						}
					});
			} catch (e) {
				this.logService.error(`Listing processes failed: ${e}`);
			}

			event.sender.send('vscode:listProcessesResponse', processes);
		});

		ipcMain.on('vscode:issueReporterClipboard', (event: IpcMainEvent) => {
			const messageOptions = {
				message: localize('issueReporterWriteToClipboard', "There is too much data to send to GitHub directly. The data will be copied to the clipboard, please paste it into the GitHub issue page that is opened."),
				type: 'warning',
				buttons: [
					localize('ok', "OK"),
					localize('cancel', "Cancel")
				]
			};

			if (this._issueWindow) {
				this.dialogMainService.showMessageBox(messageOptions, this._issueWindow)
					.then(result => {
						event.sender.send('vscode:issueReporterClipboardResponse', result.response === 0);
					});
			}
		});

		ipcMain.on('vscode:issuePerformanceInfoRequest', (event: IpcMainEvent) => {
			this.getPerformanceInfo().then(msg => {
				event.sender.send('vscode:issuePerformanceInfoResponse', msg);
			});
		});

		ipcMain.on('vscode:issueReporterConfirmClose', () => {
			const messageOptions = {
				message: localize('confirmCloseIssueReporter', "Your input will not be saved. Are you sure you want to close this window?"),
				type: 'warning',
				buttons: [
					localize('yes', "Yes"),
					localize('cancel', "Cancel")
				]
			};

			if (this._issueWindow) {
				this.dialogMainService.showMessageBox(messageOptions, this._issueWindow)
					.then(result => {
						if (result.response === 0) {
							if (this._issueWindow) {
								this._issueWindow.destroy();
								this._issueWindow = null;
							}
						}
					});
			}
		});

		ipcMain.on('vscode:workbenchCommand', (_: unknown, commandInfo: { id: any; from: any; args: any; }) => {
			const { id, from, args } = commandInfo;

			let parentWindow: BrowserWindow | null;
			switch (from) {
				case 'issueReporter':
					parentWindow = this._issueParentWindow;
					break;
				case 'processExplorer':
					parentWindow = this._processExplorerParentWindow;
					break;
				default:
					throw new Error(`Unexpected command source: ${from}`);
			}

			if (parentWindow) {
				parentWindow.webContents.send('vscode:runAction', { id, from, args });
			}
		});

		ipcMain.on('vscode:openExternal', (_: unknown, arg: string) => {
			shell.openExternal(arg);
		});

		ipcMain.on('vscode:closeIssueReporter', (event: IpcMainEvent) => {
			if (this._issueWindow) {
				this._issueWindow.close();
			}
		});

		ipcMain.on('vscode:closeProcessExplorer', (event: IpcMainEvent) => {
			if (this._processExplorerWindow) {
				this._processExplorerWindow.close();
			}
		});

		ipcMain.on('vscode:windowsInfoRequest', (event: IpcMainEvent) => {
			this.launchMainService.getMainProcessInfo().then(info => {
				event.sender.send('vscode:windowsInfoResponse', info.windows);
			});
		});
	}

	openReporter(data: IssueReporterData): Promise<void> {
		return new Promise(_ => {
			if (!this._issueWindow) {
				this._issueParentWindow = BrowserWindow.getFocusedWindow();
				if (this._issueParentWindow) {
					const position = this.getWindowPosition(this._issueParentWindow, 700, 800);

					this._issueWindow = new BrowserWindow({
						fullscreen: false,
						width: position.width,
						height: position.height,
						minWidth: 300,
						minHeight: 200,
						x: position.x,
						y: position.y,
						title: localize('issueReporter', "Issue Reporter"),
						backgroundColor: data.styles.backgroundColor || DEFAULT_BACKGROUND_COLOR,
						webPreferences: {
							preload: URI.parse(require.toUrl('vs/base/parts/sandbox/electron-browser/preload.js')).fsPath,
							nodeIntegration: true,
							enableWebSQL: false
						}
					});

					this._issueWindow.setMenuBarVisibility(false); // workaround for now, until a menu is implemented

					// Modified when testing UI
					const features: IssueReporterFeatures = {};

					this.logService.trace('issueService#openReporter: opening issue reporter');
					this._issueWindow.loadURL(this.getIssueReporterPath(data, features));

					this._issueWindow.on('close', () => this._issueWindow = null);

					this._issueParentWindow.on('closed', () => {
						if (this._issueWindow) {
							this._issueWindow.close();
							this._issueWindow = null;
						}
					});
				}
			}

			if (this._issueWindow) {
				this._issueWindow.focus();
			}
		});
	}

	openProcessExplorer(data: ProcessExplorerData): Promise<void> {
		return new Promise(_ => {
			// Create as singleton
			if (!this._processExplorerWindow) {
				this._processExplorerParentWindow = BrowserWindow.getFocusedWindow();
				if (this._processExplorerParentWindow) {
					const position = this.getWindowPosition(this._processExplorerParentWindow, 800, 500);
					this._processExplorerWindow = new BrowserWindow({
						skipTaskbar: true,
						resizable: true,
						fullscreen: false,
						width: position.width,
						height: position.height,
						minWidth: 300,
						minHeight: 200,
						x: position.x,
						y: position.y,
						backgroundColor: data.styles.backgroundColor,
						title: localize('processExplorer', "Process Explorer"),
						webPreferences: {
							preload: URI.parse(require.toUrl('vs/base/parts/sandbox/electron-browser/preload.js')).fsPath,
							nodeIntegration: true,
							enableWebSQL: false
						}
					});

					this._processExplorerWindow.setMenuBarVisibility(false);

					const windowConfiguration = {
						appRoot: this.environmentService.appRoot,
						nodeCachedDataDir: this.environmentService.nodeCachedDataDir,
						windowId: this._processExplorerWindow.id,
						userEnv: this.userEnv,
						machineId: this.machineId,
						data
					};

					this._processExplorerWindow.loadURL(
						toLauchUrl('vs/code/electron-browser/processExplorer/processExplorer.html', windowConfiguration));

					this._processExplorerWindow.on('close', () => this._processExplorerWindow = null);

					this._processExplorerParentWindow.on('close', () => {
						if (this._processExplorerWindow) {
							this._processExplorerWindow.close();
							this._processExplorerWindow = null;
						}
					});
				}
			}

			// Focus
			if (this._processExplorerWindow) {
				this._processExplorerWindow.focus();
			}
		});
	}

	public async getSystemStatus(): Promise<string> {
		return Promise.all([this.launchMainService.getMainProcessInfo(), this.launchMainService.getRemoteDiagnostics({ includeProcesses: false, includeWorkspaceMetadata: false })])
			.then(result => {
				const [info, remoteData] = result;
				return this.diagnosticsService.getDiagnostics(info, remoteData);
			});
	}

	private getWindowPosition(parentWindow: BrowserWindow, defaultWidth: number, defaultHeight: number): IWindowState {
		// We want the new window to open on the same display that the parent is in
		let displayToUse: Display | undefined;
		const displays = screen.getAllDisplays();

		// Single Display
		if (displays.length === 1) {
			displayToUse = displays[0];
		}

		// Multi Display
		else {

			// on mac there is 1 menu per window so we need to use the monitor where the cursor currently is
			if (isMacintosh) {
				const cursorPoint = screen.getCursorScreenPoint();
				displayToUse = screen.getDisplayNearestPoint(cursorPoint);
			}

			// if we have a last active window, use that display for the new window
			if (!displayToUse && parentWindow) {
				displayToUse = screen.getDisplayMatching(parentWindow.getBounds());
			}

			// fallback to primary display or first display
			if (!displayToUse) {
				displayToUse = screen.getPrimaryDisplay() || displays[0];
			}
		}

		const state: IWindowState = {
			width: defaultWidth,
			height: defaultHeight
		};

		const displayBounds = displayToUse.bounds;
		state.x = displayBounds.x + (displayBounds.width / 2) - (state.width! / 2);
		state.y = displayBounds.y + (displayBounds.height / 2) - (state.height! / 2);

		if (displayBounds.width > 0 && displayBounds.height > 0 /* Linux X11 sessions sometimes report wrong display bounds */) {
			if (state.x < displayBounds.x) {
				state.x = displayBounds.x; // prevent window from falling out of the screen to the left
			}

			if (state.y < displayBounds.y) {
				state.y = displayBounds.y; // prevent window from falling out of the screen to the top
			}

			if (state.x > (displayBounds.x + displayBounds.width)) {
				state.x = displayBounds.x; // prevent window from falling out of the screen to the right
			}

			if (state.y > (displayBounds.y + displayBounds.height)) {
				state.y = displayBounds.y; // prevent window from falling out of the screen to the bottom
			}

			if (state.width! > displayBounds.width) {
				state.width = displayBounds.width; // prevent window from exceeding display bounds width
			}

			if (state.height! > displayBounds.height) {
				state.height = displayBounds.height; // prevent window from exceeding display bounds height
			}
		}

		return state;
	}

	private getPerformanceInfo(): Promise<PerformanceInfo> {
		return new Promise(async (resolve, reject) => {
			Promise.all([this.launchMainService.getMainProcessInfo(), this.launchMainService.getRemoteDiagnostics({ includeProcesses: true, includeWorkspaceMetadata: true })])
				.then(result => {
					const [info, remoteData] = result;
					this.diagnosticsService.getPerformanceInfo(info, remoteData)
						.then(diagnosticInfo => {
							resolve(diagnosticInfo);
						})
						.catch(err => {
							this.logService.warn('issueService#getPerformanceInfo ', err.message);
							reject(err);
						});
				});
		});
	}

	private getIssueReporterPath(data: IssueReporterData, features: IssueReporterFeatures): string {
		if (!this._issueWindow) {
			throw new Error('Issue window has been disposed');
		}

		const windowConfiguration = {
			appRoot: this.environmentService.appRoot,
			nodeCachedDataDir: this.environmentService.nodeCachedDataDir,
			windowId: this._issueWindow.id,
			machineId: this.machineId,
			userEnv: this.userEnv,
			data,
			features
		};

		return toLauchUrl('vs/code/electron-browser/issue/issueReporter.html', windowConfiguration);
	}
}

function toLauchUrl<T>(pathToHtml: string, windowConfiguration: T): string {
	const environment = parseArgs(process.argv, OPTIONS);
	const config = objects.assign(environment, windowConfiguration);
	for (const keyValue of Object.keys(config)) {
		const key = keyValue as keyof typeof config;
		if (config[key] === undefined || config[key] === null || config[key] === '') {
			delete config[key]; // only send over properties that have a true value
		}
	}

	return `${require.toUrl(pathToHtml)}?config=${encodeURIComponent(JSON.stringify(config))}`;
}
