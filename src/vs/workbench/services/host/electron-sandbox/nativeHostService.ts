/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { INativeHostService } from 'vs/platform/native/common/native';
import { InstantiationType, registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ILabelService, Verbosity } from 'vs/platform/label/common/label';
import { IWorkbenchEnvironmentService } from 'vs/workbench/services/environment/common/environmentService';
import { IWindowOpenable, IOpenWindowOptions, isFolderToOpen, isWorkspaceToOpen, IOpenEmptyWindowOptions } from 'vs/platform/window/common/window';
import { Disposable } from 'vs/base/common/lifecycle';
import { NativeHostService } from 'vs/platform/native/electron-sandbox/nativeHostService';
import { INativeWorkbenchEnvironmentService } from 'vs/workbench/services/environment/electron-sandbox/environmentService';
import { IMainProcessService } from 'vs/platform/ipc/common/mainProcessService';

class WorkbenchNativeHostService extends NativeHostService {

	constructor(
		@INativeWorkbenchEnvironmentService environmentService: INativeWorkbenchEnvironmentService,
		@IMainProcessService mainProcessService: IMainProcessService
	) {
		super(environmentService.window.id, mainProcessService);
	}
}

class WorkbenchHostService extends Disposable implements IHostService {

	declare readonly _serviceBrand: undefined;

	constructor(
		@INativeHostService private readonly nativeHostService: INativeHostService,
		@ILabelService private readonly labelService: ILabelService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService
	) {
		super();
	}

	//#region Focus

	get onDidChangeFocus(): Event<boolean> { return this._onDidChangeFocus; }
	private _onDidChangeFocus: Event<boolean> = Event.latch(Event.any(
		Event.map(Event.filter(this.nativeHostService.onDidFocusWindow, id => id === this.nativeHostService.windowId), () => this.hasFocus),
		Event.map(Event.filter(this.nativeHostService.onDidBlurWindow, id => id === this.nativeHostService.windowId), () => this.hasFocus)
	), undefined, this._store);

	get hasFocus(): boolean {
		return document.hasFocus();
	}

	async hadLastFocus(): Promise<boolean> {
		const activeWindowId = await this.nativeHostService.getActiveWindowId();

		if (typeof activeWindowId === 'undefined') {
			return false;
		}

		return activeWindowId === this.nativeHostService.windowId;
	}

	//#endregion


	//#region Window

	openWindow(options?: IOpenEmptyWindowOptions): Promise<void>;
	openWindow(toOpen: IWindowOpenable[], options?: IOpenWindowOptions): Promise<void>;
	openWindow(arg1?: IOpenEmptyWindowOptions | IWindowOpenable[], arg2?: IOpenWindowOptions): Promise<void> {
		if (Array.isArray(arg1)) {
			return this.doOpenWindow(arg1, arg2);
		}

		return this.doOpenEmptyWindow(arg1);
	}

	private doOpenWindow(toOpen: IWindowOpenable[], options?: IOpenWindowOptions): Promise<void> {
		const remoteAuthority = this.environmentService.remoteAuthority;
		if (!!remoteAuthority) {
			toOpen.forEach(openable => openable.label = openable.label || this.getRecentLabel(openable));

			if (options?.remoteAuthority === undefined) {
				// set the remoteAuthority of the window the request came from.
				// It will be used when the input is neither file nor vscode-remote.
				options = options ? { ...options, remoteAuthority } : { remoteAuthority };
			}
		}

		return this.nativeHostService.openWindow(toOpen, options);
	}

	private getRecentLabel(openable: IWindowOpenable): string {
		if (isFolderToOpen(openable)) {
			return this.labelService.getWorkspaceLabel(openable.folderUri, { verbose: Verbosity.LONG });
		}

		if (isWorkspaceToOpen(openable)) {
			return this.labelService.getWorkspaceLabel({ id: '', configPath: openable.workspaceUri }, { verbose: Verbosity.LONG });
		}

		return this.labelService.getUriLabel(openable.fileUri);
	}

	private doOpenEmptyWindow(options?: IOpenEmptyWindowOptions): Promise<void> {
		const remoteAuthority = this.environmentService.remoteAuthority;
		if (!!remoteAuthority && options?.remoteAuthority === undefined) {
			// set the remoteAuthority of the window the request came from
			options = options ? { ...options, remoteAuthority } : { remoteAuthority };
		}
		return this.nativeHostService.openWindow(options);
	}

	toggleFullScreen(): Promise<void> {
		return this.nativeHostService.toggleFullScreen();
	}

	//#endregion


	//#region Lifecycle

	focus(options?: { force: boolean }): Promise<void> {
		return this.nativeHostService.focusWindow(options);
	}

	restart(): Promise<void> {
		return this.nativeHostService.relaunch();
	}

	reload(options?: { disableExtensions?: boolean }): Promise<void> {
		return this.nativeHostService.reload(options);
	}

	close(): Promise<void> {
		return this.nativeHostService.closeWindow();
	}

	async withExpectedShutdown<T>(expectedShutdownTask: () => Promise<T>): Promise<T> {
		return await expectedShutdownTask();
	}

	//#endregion
}

registerSingleton(IHostService, WorkbenchHostService, InstantiationType.Delayed);
registerSingleton(INativeHostService, WorkbenchNativeHostService, InstantiationType.Delayed);
