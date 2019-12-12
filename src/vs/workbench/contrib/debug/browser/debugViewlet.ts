/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/debugViewlet';
import * as nls from 'vs/nls';
import { IAction } from 'vs/base/common/actions';
import * as DOM from 'vs/base/browser/dom';
import { IActionViewItem } from 'vs/base/browser/ui/actionbar/actionbar';
import { IDebugService, VIEWLET_ID, State, BREAKPOINTS_VIEW_ID, IDebugConfiguration, REPL_ID, CONTEXT_DEBUG_UX, CONTEXT_DEBUG_UX_KEY } from 'vs/workbench/contrib/debug/common/debug';
import { StartAction, ConfigureAction, SelectAndStartAction, FocusSessionAction } from 'vs/workbench/contrib/debug/browser/debugActions';
import { StartDebugActionViewItem, FocusSessionActionViewItem } from 'vs/workbench/contrib/debug/browser/debugActionViewItems';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { IProgressService } from 'vs/platform/progress/common/progress';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { memoize } from 'vs/base/common/decorators';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { DebugToolBar } from 'vs/workbench/contrib/debug/browser/debugToolBar';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { ViewPane, ViewPaneContainer } from 'vs/workbench/browser/parts/views/viewPaneContainer';
import { IMenu, MenuId, IMenuService, MenuItemAction } from 'vs/platform/actions/common/actions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { MenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TogglePanelAction } from 'vs/workbench/browser/panel';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { Viewlet } from 'vs/workbench/browser/viewlet';
import { StartView } from 'vs/workbench/contrib/debug/browser/startView';

// Register a lightweight viewlet responsible for making the container
export class DebugViewlet extends Viewlet {
	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IStorageService protected storageService: IStorageService,
		@IInstantiationService protected instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService protected contextMenuService: IContextMenuService,
		@IExtensionService protected extensionService: IExtensionService,
		@IWorkspaceContextService protected contextService: IWorkspaceContextService,
		@IWorkbenchLayoutService protected layoutService: IWorkbenchLayoutService,
		@IConfigurationService protected configurationService: IConfigurationService
	) {
		super(VIEWLET_ID, instantiationService.createInstance(DebugViewPaneContainer), telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService, layoutService, configurationService);
	}
}

export class DebugViewPaneContainer extends ViewPaneContainer {

	private startDebugActionViewItem: StartDebugActionViewItem | undefined;
	private progressResolve: (() => void) | undefined;
	private breakpointView: ViewPane | undefined;
	private paneListeners = new Map<string, IDisposable>();
	private debugToolBarMenu: IMenu | undefined;
	private disposeOnTitleUpdate: IDisposable | undefined;

	constructor(
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IProgressService private readonly progressService: IProgressService,
		@IDebugService private readonly debugService: IDebugService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IWorkspaceContextService contextService: IWorkspaceContextService,
		@IStorageService storageService: IStorageService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IExtensionService extensionService: IExtensionService,
		@IConfigurationService configurationService: IConfigurationService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IMenuService private readonly menuService: IMenuService,
		@IContextKeyService private readonly contextKeyService: IContextKeyService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super(VIEWLET_ID, `${VIEWLET_ID}.state`, { showHeaderInTitleWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService);

		this._register(this.debugService.onDidChangeState(state => this.onDebugServiceStateChange(state)));
		this._register(this.debugService.onDidNewSession(() => this.updateToolBar()));
		this._register(this.contextKeyService.onDidChangeContext(e => {
			if (e.affectsSome(new Set([CONTEXT_DEBUG_UX_KEY]))) {
				this.updateTitleArea();
			}
		}));

		this._register(this.contextService.onDidChangeWorkbenchState(() => this.updateTitleArea()));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('debug.toolBarLocation')) {
				this.updateTitleArea();
			}
		}));
	}

	create(parent: HTMLElement): void {
		super.create(parent);
		DOM.addClass(parent, 'debug-viewlet');
	}

	focus(): void {
		super.focus();

		if (this.startDebugActionViewItem) {
			this.startDebugActionViewItem.focus();
		} else {
			this.focusView(StartView.ID);
		}
	}

	@memoize
	private get startAction(): StartAction {
		return this._register(this.instantiationService.createInstance(StartAction, StartAction.ID, StartAction.LABEL));
	}

	@memoize
	private get configureAction(): ConfigureAction {
		return this._register(this.instantiationService.createInstance(ConfigureAction, ConfigureAction.ID, ConfigureAction.LABEL));
	}

	@memoize
	private get toggleReplAction(): ToggleReplAction {
		return this._register(this.instantiationService.createInstance(ToggleReplAction, ToggleReplAction.ID, ToggleReplAction.LABEL));
	}

	@memoize
	private get selectAndStartAction(): SelectAndStartAction {
		return this._register(this.instantiationService.createInstance(SelectAndStartAction, SelectAndStartAction.ID, nls.localize('startAdditionalSession', "Start Additional Session")));
	}

	getActions(): IAction[] {
		if (CONTEXT_DEBUG_UX.getValue(this.contextKeyService) === 'simple') {
			return [];
		}
		if (!this.showInitialDebugActions) {

			if (!this.debugToolBarMenu) {
				this.debugToolBarMenu = this.menuService.createMenu(MenuId.DebugToolBar, this.contextKeyService);
				this._register(this.debugToolBarMenu);
			}

			const { actions, disposable } = DebugToolBar.getActions(this.debugToolBarMenu, this.debugService, this.instantiationService);
			if (this.disposeOnTitleUpdate) {
				dispose(this.disposeOnTitleUpdate);
			}
			this.disposeOnTitleUpdate = disposable;

			return actions;
		}

		if (this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
			return [this.toggleReplAction];
		}

		return [this.startAction, this.configureAction, this.toggleReplAction];
	}

	get showInitialDebugActions(): boolean {
		const state = this.debugService.state;
		return state === State.Inactive || this.configurationService.getValue<IDebugConfiguration>('debug').toolBarLocation !== 'docked';
	}

	getSecondaryActions(): IAction[] {
		if (this.showInitialDebugActions) {
			return [];
		}

		return [this.selectAndStartAction, this.configureAction, this.toggleReplAction];
	}

	getActionViewItem(action: IAction): IActionViewItem | undefined {
		if (action.id === StartAction.ID) {
			this.startDebugActionViewItem = this.instantiationService.createInstance(StartDebugActionViewItem, null, action);
			return this.startDebugActionViewItem;
		}
		if (action.id === FocusSessionAction.ID) {
			return new FocusSessionActionViewItem(action, this.debugService, this.themeService, this.contextViewService, this.configurationService);
		}
		if (action instanceof MenuItemAction) {
			return new MenuEntryActionViewItem(action, this.keybindingService, this.notificationService, this.contextMenuService);
		}

		return undefined;
	}

	focusView(id: string): void {
		const view = this.getView(id);
		if (view) {
			view.focus();
		}
	}

	private onDebugServiceStateChange(state: State): void {
		if (this.progressResolve) {
			this.progressResolve();
			this.progressResolve = undefined;
		}

		if (state === State.Initializing) {
			this.progressService.withProgress({ location: VIEWLET_ID }, _progress => {
				return new Promise(resolve => this.progressResolve = resolve);
			});
		}

		this.updateToolBar();
	}

	private updateToolBar(): void {
		if (this.configurationService.getValue<IDebugConfiguration>('debug').toolBarLocation === 'docked') {
			this.updateTitleArea();
		}
	}

	addPanes(panes: { pane: ViewPane, size: number, index?: number }[]): void {
		super.addPanes(panes);

		for (const { pane: pane } of panes) {
			// attach event listener to
			if (pane.id === BREAKPOINTS_VIEW_ID) {
				this.breakpointView = pane;
				this.updateBreakpointsMaxSize();
			} else {
				this.paneListeners.set(pane.id, pane.onDidChange(() => this.updateBreakpointsMaxSize()));
			}
		}
	}

	removePanes(panes: ViewPane[]): void {
		super.removePanes(panes);
		for (const pane of panes) {
			dispose(this.paneListeners.get(pane.id));
			this.paneListeners.delete(pane.id);
		}
	}

	private updateBreakpointsMaxSize(): void {
		if (this.breakpointView) {
			// We need to update the breakpoints view since all other views are collapsed #25384
			const allOtherCollapsed = this.panes.every(view => !view.isExpanded() || view === this.breakpointView);
			this.breakpointView.maximumBodySize = allOtherCollapsed ? Number.POSITIVE_INFINITY : this.breakpointView.minimumBodySize;
		}
	}
}

class ToggleReplAction extends TogglePanelAction {
	static readonly ID = 'debug.toggleRepl';
	static readonly LABEL = nls.localize({ comment: ['Debug is a noun in this context, not a verb.'], key: 'debugConsoleAction' }, 'Debug Console');

	constructor(id: string, label: string,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IPanelService panelService: IPanelService
	) {
		super(id, label, REPL_ID, panelService, layoutService, 'debug-action codicon-terminal');
	}
}
