/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import * as errors from 'vs/base/common/errors';
import { equals, deepClone, assign } from 'vs/base/common/objects';
import * as DOM from 'vs/base/browser/dom';
import { Separator } from 'vs/base/browser/ui/actionbar/actionbar';
import { IAction, Action } from 'vs/base/common/actions';
import { IFileService } from 'vs/platform/files/common/files';
import { toResource, IUntitledResourceInput } from 'vs/workbench/common/editor';
import { IEditorService, IResourceEditor } from 'vs/workbench/services/editor/common/editorService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IWindowsService, IWindowService, IWindowSettings, IOpenFileRequest, IWindowsConfiguration, IAddFoldersRequest, IRunActionInWindowRequest, IPathData, IRunKeybindingInWindowRequest } from 'vs/platform/windows/common/windows';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { ITitleService } from 'vs/workbench/services/title/common/titleService';
import { IWorkbenchThemeService, VS_HC_THEME } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as browser from 'vs/base/browser/browser';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IResourceInput } from 'vs/platform/editor/common/editor';
import { KeyboardMapperFactory } from 'vs/workbench/services/keybinding/electron-browser/keybindingService';
import { ipcRenderer as ipc, webFrame, crashReporter, Event } from 'electron';
import { IWorkspaceEditingService } from 'vs/workbench/services/workspace/common/workspaceEditing';
import { IMenuService, MenuId, IMenu, MenuItemAction, ICommandAction } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { fillInActionBarActions } from 'vs/platform/actions/browser/menuItemActionItem';
import { RunOnceScheduler } from 'vs/base/common/async';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { LifecyclePhase, ILifecycleService } from 'vs/platform/lifecycle/common/lifecycle';
import { IWorkspaceFolderCreationData } from 'vs/platform/workspaces/common/workspaces';
import { IIntegrityService } from 'vs/workbench/services/integrity/common/integrity';
import { isRootUser, isWindows, isMacintosh, isLinux } from 'vs/base/common/platform';
import product from 'vs/platform/product/node/product';
import pkg from 'vs/platform/product/node/package';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { EditorServiceImpl } from 'vs/workbench/browser/parts/editor/editor';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IAccessibilityService, AccessibilitySupport } from 'vs/platform/accessibility/common/accessibility';
import { WorkbenchState, IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { coalesce } from 'vs/base/common/arrays';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

const TextInputActions: IAction[] = [
	new Action('undo', nls.localize('undo', "Undo"), undefined, true, () => Promise.resolve(document.execCommand('undo'))),
	new Action('redo', nls.localize('redo', "Redo"), undefined, true, () => Promise.resolve(document.execCommand('redo'))),
	new Separator(),
	new Action('editor.action.clipboardCutAction', nls.localize('cut', "Cut"), undefined, true, () => Promise.resolve(document.execCommand('cut'))),
	new Action('editor.action.clipboardCopyAction', nls.localize('copy', "Copy"), undefined, true, () => Promise.resolve(document.execCommand('copy'))),
	new Action('editor.action.clipboardPasteAction', nls.localize('paste', "Paste"), undefined, true, () => Promise.resolve(document.execCommand('paste'))),
	new Separator(),
	new Action('editor.action.selectAll', nls.localize('selectAll', "Select All"), undefined, true, () => Promise.resolve(document.execCommand('selectAll')))
];

export class ElectronWindow extends Disposable {

	private touchBarMenu?: IMenu;
	private touchBarUpdater: RunOnceScheduler;
	private touchBarDisposables: IDisposable[];
	private lastInstalledTouchedBar: ICommandAction[][];

	private previousConfiguredZoomLevel: number;

	private addFoldersScheduler: RunOnceScheduler;
	private pendingFoldersToAdd: URI[];

	private closeEmptyWindowScheduler: RunOnceScheduler = this._register(new RunOnceScheduler(() => this.onAllEditorsClosed(), 50));

	constructor(
		@IEditorService private readonly editorService: EditorServiceImpl,
		@IWindowsService private readonly windowsService: IWindowsService,
		@IWindowService private readonly windowService: IWindowService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@ITitleService private readonly titleService: ITitleService,
		@IWorkbenchThemeService protected themeService: IWorkbenchThemeService,
		@INotificationService private readonly notificationService: INotificationService,
		@ICommandService private readonly commandService: ICommandService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IWorkspaceEditingService private readonly workspaceEditingService: IWorkspaceEditingService,
		@IFileService private readonly fileService: IFileService,
		@IMenuService private readonly menuService: IMenuService,
		@ILifecycleService private readonly lifecycleService: ILifecycleService,
		@IIntegrityService private readonly integrityService: IIntegrityService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IAccessibilityService private readonly accessibilityService: IAccessibilityService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService
	) {
		super();

		this.touchBarDisposables = [];

		this.pendingFoldersToAdd = [];
		this.addFoldersScheduler = this._register(new RunOnceScheduler(() => this.doAddFolders(), 100));

		this.registerListeners();
		this.create();
	}

	private registerListeners(): void {

		// React to editor input changes
		this._register(this.editorService.onDidActiveEditorChange(() => this.updateTouchbarMenu()));

		// prevent opening a real URL inside the shell
		[DOM.EventType.DRAG_OVER, DOM.EventType.DROP].forEach(event => {
			window.document.body.addEventListener(event, (e: DragEvent) => {
				DOM.EventHelper.stop(e);
			});
		});

		// Support runAction event
		ipc.on('vscode:runAction', (event: Event, request: IRunActionInWindowRequest) => {
			const args: any[] = request.args || [];

			// If we run an action from the touchbar, we fill in the currently active resource
			// as payload because the touch bar items are context aware depending on the editor
			if (request.from === 'touchbar') {
				const activeEditor = this.editorService.activeEditor;
				if (activeEditor) {
					const resource = toResource(activeEditor, { supportSideBySide: true });
					if (resource) {
						args.push(resource);
					}
				}
			} else {
				args.push({ from: request.from }); // TODO@telemetry this is a bit weird to send this to every action?
			}

			this.commandService.executeCommand(request.id, ...args).then(_ => {
				/* __GDPR__
					"commandExecuted" : {
						"id" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
						"from": { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
					}
				*/
				this.telemetryService.publicLog('commandExecuted', { id: request.id, from: request.from });
			}, err => {
				this.notificationService.error(err);
			});
		});

		// Support runKeybinding event
		ipc.on('vscode:runKeybinding', (event: Event, request: IRunKeybindingInWindowRequest) => {
			if (document.activeElement) {
				this.keybindingService.dispatchByUserSettingsLabel(request.userSettingsLabel, document.activeElement);
			}
		});

		// Error reporting from main
		ipc.on('vscode:reportError', (event: Event, error: string) => {
			if (error) {
				errors.onUnexpectedError(JSON.parse(error));
			}
		});

		// Support openFiles event for existing and new files
		ipc.on('vscode:openFiles', (event: Event, request: IOpenFileRequest) => this.onOpenFiles(request));

		// Support addFolders event if we have a workspace opened
		ipc.on('vscode:addFolders', (event: Event, request: IAddFoldersRequest) => this.onAddFoldersRequest(request));

		// Message support
		ipc.on('vscode:showInfoMessage', (event: Event, message: string) => {
			this.notificationService.info(message);
		});

		// Fullscreen Events
		ipc.on('vscode:enterFullScreen', () => {
			this.lifecycleService.when(LifecyclePhase.Ready).then(() => {
				browser.setFullscreen(true);
			});
		});

		ipc.on('vscode:leaveFullScreen', () => {
			this.lifecycleService.when(LifecyclePhase.Ready).then(() => {
				browser.setFullscreen(false);
			});
		});

		// High Contrast Events
		ipc.on('vscode:enterHighContrast', () => {
			const windowConfig = this.configurationService.getValue<IWindowSettings>('window');
			if (windowConfig && windowConfig.autoDetectHighContrast) {
				this.lifecycleService.when(LifecyclePhase.Ready).then(() => {
					this.themeService.setColorTheme(VS_HC_THEME, undefined);
				});
			}
		});

		ipc.on('vscode:leaveHighContrast', () => {
			const windowConfig = this.configurationService.getValue<IWindowSettings>('window');
			if (windowConfig && windowConfig.autoDetectHighContrast) {
				this.lifecycleService.when(LifecyclePhase.Ready).then(() => {
					this.themeService.restoreColorTheme();
				});
			}
		});

		// keyboard layout changed event
		ipc.on('vscode:keyboardLayoutChanged', () => {
			KeyboardMapperFactory.INSTANCE._onKeyboardLayoutChanged();
		});

		// keyboard layout changed event
		ipc.on('vscode:accessibilitySupportChanged', (event: Event, accessibilitySupportEnabled: boolean) => {
			this.accessibilityService.setAccessibilitySupport(accessibilitySupportEnabled ? AccessibilitySupport.Enabled : AccessibilitySupport.Disabled);
		});

		// Zoom level changes
		this.updateWindowZoomLevel();
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('window.zoomLevel')) {
				this.updateWindowZoomLevel();
			}
		}));

		// Context menu support in input/textarea
		window.document.addEventListener('contextmenu', e => this.onContextMenu(e));

		// Listen to visible editor changes
		this._register(this.editorService.onDidVisibleEditorsChange(() => this.onDidVisibleEditorsChange()));

		// Listen to editor closing (if we run with --wait)
		const filesToWait = this.windowService.getConfiguration().filesToWait;
		if (filesToWait) {
			const resourcesToWaitFor = coalesce(filesToWait.paths.map(p => p.fileUri));
			const waitMarkerFile = filesToWait.waitMarkerFileUri;
			const listenerDispose = this.editorService.onDidCloseEditor(() => this.onEditorClosed(listenerDispose, resourcesToWaitFor, waitMarkerFile));

			this._register(listenerDispose);
		}
	}

	private onDidVisibleEditorsChange(): void {

		// Close when empty: check if we should close the window based on the setting
		// Overruled by: window has a workspace opened or this window is for extension development
		// or setting is disabled. Also enabled when running with --wait from the command line.
		const visibleEditors = this.editorService.visibleControls;
		if (visibleEditors.length === 0 && this.contextService.getWorkbenchState() === WorkbenchState.EMPTY && !this.environmentService.isExtensionDevelopment) {
			const closeWhenEmpty = this.configurationService.getValue<boolean>('window.closeWhenEmpty');
			if (closeWhenEmpty || this.environmentService.args.wait) {
				this.closeEmptyWindowScheduler.schedule();
			}
		}
	}

	private onAllEditorsClosed(): void {
		const visibleEditors = this.editorService.visibleControls.length;
		if (visibleEditors === 0) {
			this.windowService.closeWindow();
		}
	}

	private onEditorClosed(listenerDispose: IDisposable, resourcesToWaitFor: URI[], waitMarkerFile: URI): void {

		// In wait mode, listen to changes to the editors and wait until the files
		// are closed that the user wants to wait for. When this happens we delete
		// the wait marker file to signal to the outside that editing is done.
		if (resourcesToWaitFor.every(resource => !this.editorService.isOpen({ resource }))) {
			listenerDispose.dispose();
			this.fileService.del(waitMarkerFile);
		}
	}

	private onContextMenu(e: MouseEvent): void {
		if (e.target instanceof HTMLElement) {
			const target = <HTMLElement>e.target;
			if (target.nodeName && (target.nodeName.toLowerCase() === 'input' || target.nodeName.toLowerCase() === 'textarea')) {
				DOM.EventHelper.stop(e, true);

				this.contextMenuService.showContextMenu({
					getAnchor: () => e,
					getActions: () => TextInputActions,
					onHide: () => target.focus() // fixes https://github.com/Microsoft/vscode/issues/52948
				});
			}
		}
	}

	private updateWindowZoomLevel(): void {
		const windowConfig: IWindowsConfiguration = this.configurationService.getValue<IWindowsConfiguration>();

		let newZoomLevel = 0;
		if (windowConfig.window && typeof windowConfig.window.zoomLevel === 'number') {
			newZoomLevel = windowConfig.window.zoomLevel;

			// Leave early if the configured zoom level did not change (https://github.com/Microsoft/vscode/issues/1536)
			if (this.previousConfiguredZoomLevel === newZoomLevel) {
				return;
			}

			this.previousConfiguredZoomLevel = newZoomLevel;
		}

		if (webFrame.getZoomLevel() !== newZoomLevel) {
			webFrame.setZoomLevel(newZoomLevel);
			browser.setZoomFactor(webFrame.getZoomFactor());
			// See https://github.com/Microsoft/vscode/issues/26151
			// Cannot be trusted because the webFrame might take some time
			// until it really applies the new zoom level
			browser.setZoomLevel(webFrame.getZoomLevel(), /*isTrusted*/false);
		}
	}

	private create(): void {

		// Handle window.open() calls
		const $this = this;
		window.open = function (url: string, target: string, features: string, replace: boolean): Window | null {
			$this.windowsService.openExternal(url);

			return null;
		};

		// Emit event when vscode is ready
		this.lifecycleService.when(LifecyclePhase.Ready).then(() => {
			ipc.send('vscode:workbenchReady', this.windowService.getCurrentWindowId());
		});

		// Integrity warning
		this.integrityService.isPure().then(res => this.titleService.updateProperties({ isPure: res.isPure }));

		// Root warning
		this.lifecycleService.when(LifecyclePhase.Restored).then(() => {
			let isAdminPromise: Promise<boolean>;
			if (isWindows) {
				isAdminPromise = import('native-is-elevated').then(isElevated => isElevated());
			} else {
				isAdminPromise = Promise.resolve(isRootUser());
			}

			return isAdminPromise.then(isAdmin => {

				// Update title
				this.titleService.updateProperties({ isAdmin });

				// Show warning message (unix only)
				if (isAdmin && !isWindows) {
					this.notificationService.warn(nls.localize('runningAsRoot', "It is not recommended to run {0} as root user.", product.nameShort));
				}
			});
		});

		// Touchbar menu (if enabled)
		this.updateTouchbarMenu();

		// Crash reporter (if enabled)
		if (!this.environmentService.disableCrashReporter && product.crashReporter && product.hockeyApp && this.configurationService.getValue('telemetry.enableCrashReporter')) {
			this.setupCrashReporter();
		}
	}

	private updateTouchbarMenu(): void {
		if (
			!isMacintosh || // macOS only
			!this.configurationService.getValue<boolean>('keyboard.touchbar.enabled') // disabled via setting
		) {
			return;
		}

		// Dispose old
		this.touchBarDisposables = dispose(this.touchBarDisposables);
		this.touchBarMenu = undefined;

		// Create new (delayed)
		this.touchBarUpdater = new RunOnceScheduler(() => this.doUpdateTouchbarMenu(), 300);
		this.touchBarDisposables.push(this.touchBarUpdater);
		this.touchBarUpdater.schedule();
	}

	private doUpdateTouchbarMenu(): void {
		if (!this.touchBarMenu) {
			this.touchBarMenu = this.editorService.invokeWithinEditorContext(accessor => this.menuService.createMenu(MenuId.TouchBarContext, accessor.get(IContextKeyService)));
			this.touchBarDisposables.push(this.touchBarMenu);
			this.touchBarDisposables.push(this.touchBarMenu.onDidChange(() => this.touchBarUpdater.schedule()));
		}

		const actions: Array<MenuItemAction | Separator> = [];

		// Fill actions into groups respecting order
		fillInActionBarActions(this.touchBarMenu, undefined, actions);

		// Convert into command action multi array
		const items: ICommandAction[][] = [];
		let group: ICommandAction[] = [];
		for (const action of actions) {

			// Command
			if (action instanceof MenuItemAction) {
				group.push(action.item);
			}

			// Separator
			else if (action instanceof Separator) {
				if (group.length) {
					items.push(group);
				}

				group = [];
			}
		}

		if (group.length) {
			items.push(group);
		}

		// Only update if the actions have changed
		if (!equals(this.lastInstalledTouchedBar, items)) {
			this.lastInstalledTouchedBar = items;
			this.windowService.updateTouchBar(items);
		}
	}

	private setupCrashReporter(): void {

		// base options with product info
		const options = {
			companyName: product.crashReporter.companyName,
			productName: product.crashReporter.productName,
			submitURL: isWindows ? product.hockeyApp[`win32-${process.arch}`] : isLinux ? product.hockeyApp[`linux-${process.arch}`] : product.hockeyApp.darwin,
			extra: {
				vscode_version: pkg.version,
				vscode_commit: product.commit
			}
		};

		// mixin telemetry info
		this.telemetryService.getTelemetryInfo()
			.then(info => {
				assign(options.extra, {
					vscode_sessionId: info.sessionId
				});

				// start crash reporter right here
				crashReporter.start(deepClone(options));

				// start crash reporter in the main process
				return this.windowsService.startCrashReporter(options);
			});
	}

	private onAddFoldersRequest(request: IAddFoldersRequest): void {

		// Buffer all pending requests
		this.pendingFoldersToAdd.push(...request.foldersToAdd.map(f => URI.revive(f)));

		// Delay the adding of folders a bit to buffer in case more requests are coming
		if (!this.addFoldersScheduler.isScheduled()) {
			this.addFoldersScheduler.schedule();
		}
	}

	private doAddFolders(): void {
		const foldersToAdd: IWorkspaceFolderCreationData[] = [];

		this.pendingFoldersToAdd.forEach(folder => {
			foldersToAdd.push(({ uri: folder }));
		});

		this.pendingFoldersToAdd = [];

		this.workspaceEditingService.addFolders(foldersToAdd);
	}

	private onOpenFiles(request: IOpenFileRequest): void {
		const inputs: IResourceEditor[] = [];
		const diffMode = !!(request.filesToDiff && (request.filesToDiff.length === 2));

		if (!diffMode && request.filesToOpen) {
			inputs.push(...this.toInputs(request.filesToOpen, false));
		}

		if (!diffMode && request.filesToCreate) {
			inputs.push(...this.toInputs(request.filesToCreate, true));
		}

		if (diffMode && request.filesToDiff) {
			inputs.push(...this.toInputs(request.filesToDiff, false));
		}

		if (inputs.length) {
			this.openResources(inputs, diffMode);
		}

		if (request.filesToWait && inputs.length) {
			// In wait mode, listen to changes to the editors and wait until the files
			// are closed that the user wants to wait for. When this happens we delete
			// the wait marker file to signal to the outside that editing is done.
			const resourcesToWaitFor = request.filesToWait.paths.map(p => URI.revive(p.fileUri));
			const waitMarkerFile = URI.revive(request.filesToWait.waitMarkerFileUri);
			const unbind = this.editorService.onDidCloseEditor(() => {
				if (resourcesToWaitFor.every(resource => !this.editorService.isOpen({ resource }))) {
					unbind.dispose();
					this.fileService.del(waitMarkerFile);
				}
			});
		}
	}

	private openResources(resources: Array<IResourceInput | IUntitledResourceInput>, diffMode: boolean): void {
		this.lifecycleService.when(LifecyclePhase.Ready).then((): Promise<any> => {

			// In diffMode we open 2 resources as diff
			if (diffMode && resources.length === 2) {
				return this.editorService.openEditor({ leftResource: resources[0].resource!, rightResource: resources[1].resource!, options: { pinned: true } });
			}

			// For one file, just put it into the current active editor
			if (resources.length === 1) {
				return this.editorService.openEditor(resources[0]);
			}

			// Otherwise open all
			return this.editorService.openEditors(resources);
		});
	}

	private toInputs(paths: IPathData[], isNew: boolean): IResourceEditor[] {
		return paths.map(p => {
			const resource = URI.revive(p.fileUri);
			let input: IResourceInput | IUntitledResourceInput;
			if (isNew) {
				input = { filePath: resource.fsPath, options: { pinned: true } } as IUntitledResourceInput;
			} else {
				input = { resource, options: { pinned: true } } as IResourceInput;
			}

			if (!isNew && typeof p.lineNumber === 'number' && typeof p.columnNumber === 'number') {
				input.options!.selection = {
					startLineNumber: p.lineNumber,
					startColumn: p.columnNumber
				};
			}

			return input;
		});
	}

	dispose(): void {
		this.touchBarDisposables = dispose(this.touchBarDisposables);

		super.dispose();
	}
}
