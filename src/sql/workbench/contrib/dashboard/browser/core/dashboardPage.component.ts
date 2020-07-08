/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardPage';
import 'sql/workbench/contrib/dashboard/browser/core/dashboardPanelStyles';

import { Component, Inject, forwardRef, ViewChild, ElementRef, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';

import { DashboardServiceInterface } from 'sql/workbench/contrib/dashboard/browser/services/dashboardServiceInterface.service';
import { CommonServiceInterface, SingleConnectionManagementService } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { WidgetConfig, TabConfig, TabSettingConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { IPropertiesConfig } from 'sql/workbench/contrib/dashboard/browser/pages/serverDashboardPage.contribution';
import { PanelComponent, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { IDashboardRegistry, Extensions as DashboardExtensions } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import { IDashboardTab } from 'sql/workbench/services/dashboard/browser/common/interfaces';
import { TabComponent, TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { AngularEventType, IAngularEventingService } from 'sql/platform/angularEventing/browser/angularEventingService';
import { DashboardTab, IConfigModifierCollection } from 'sql/workbench/contrib/dashboard/browser/core/interfaces';
import * as dashboardHelper from 'sql/workbench/contrib/dashboard/browser/core/dashboardHelper';
import { WIDGETS_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardGridContainer.contribution';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import * as Constants from 'sql/platform/connection/common/constants';

import { Registry } from 'vs/platform/registry/common/platform';
import * as types from 'vs/base/common/types';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as nls from 'vs/nls';
import * as objects from 'vs/base/common/objects';
import { Event, Emitter } from 'vs/base/common/event';
import { Action, IAction, IActionViewItem } from 'vs/base/common/actions';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import Severity from 'vs/base/common/severity';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IContextKeyService, ContextKeyExpr, RawContextKey, IContextKey } from 'vs/platform/contextkey/common/contextkey';
import { ILogService } from 'vs/platform/log/common/log';
import { firstIndex, find } from 'vs/base/common/arrays';
import { values } from 'vs/base/common/collections';
import { RefreshWidgetAction, ToolbarAction } from 'sql/workbench/contrib/dashboard/browser/core/actions';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import * as DOM from 'vs/base/browser/dom';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { TaskRegistry } from 'sql/workbench/services/tasks/browser/tasksRegistry';
import { MenuRegistry, IMenuService, MenuId, MenuItemAction } from 'vs/platform/actions/common/actions';
import { fillInActions, LabeledMenuItemActionItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { NAV_SECTION } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardNavSection.contribution';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { DASHBOARD_BORDER, EDITOR_PANE_BACKGROUND, TOOLBAR_OVERFLOW_SHADOW } from 'vs/workbench/common/theme';
import { IColorTheme, registerThemingParticipant, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { attachTabbedPanelStyler } from 'sql/workbench/common/styler';
import { focusBorder } from 'vs/platform/theme/common/colorRegistry';

const dashboardRegistry = Registry.as<IDashboardRegistry>(DashboardExtensions.DashboardContributions);
const homeTabGroupId = 'home';

@Component({
	selector: 'dashboard-page',
	templateUrl: decodeURI(require.toUrl('./dashboardPage.component.html'))
})
export abstract class DashboardPage extends AngularDisposable implements IConfigModifierCollection {

	protected tabs: Array<TabConfig> = [];

	private _originalConfig: WidgetConfig[];

	protected panelActions: Action[];
	private _tabsDispose: Array<IDisposable> = [];
	private _tabSettingConfigs: Array<TabSettingConfig> = [];

	@ViewChildren(TabChild) private _tabs: QueryList<DashboardTab>;
	@ViewChild(PanelComponent) private _panel: PanelComponent;
	@ViewChild('toolbar', { read: ElementRef }) private toolbarContainer: ElementRef;
	protected toolbar: Taskbar;
	public showToolbar: boolean;

	private _editEnabled = new Emitter<boolean>();
	public readonly editEnabled: Event<boolean> = this._editEnabled.event;
	// tslint:disable:no-unused-variable
	private readonly homeTabTitle: string = nls.localize('home', "Home");
	private readonly homeTabId: string = 'homeTab';
	private tabToolbarActionsConfig = new Map<string, any[]>();
	private tabContents = new Map<string, string>();

	static tabName = new RawContextKey<string>('tabName', undefined);
	private _tabName: IContextKey<string>;
	public containerOverflowStyle: string;

	// a set of config modifiers
	private readonly _configModifiers: Array<(item: Array<WidgetConfig>, collection: IConfigModifierCollection, context: string) => Array<WidgetConfig>> = [
		dashboardHelper.removeEmpty,
		dashboardHelper.initExtensionConfigs,
		dashboardHelper.addProvider,
		dashboardHelper.addEdition,
		dashboardHelper.addContext,
		dashboardHelper.filterConfigs
	];

	public get connectionManagementService(): SingleConnectionManagementService {
		return this.dashboardService.connectionManagementService;
	}

	public get contextKeyService(): IContextKeyService {
		return this.dashboardService.scopedContextKeyService;
	}

	private readonly _gridModifiers: Array<(item: Array<WidgetConfig>, originalConfig?: Array<WidgetConfig>) => Array<WidgetConfig>> = [
		dashboardHelper.validateGridConfig
	];

	protected abstract propertiesWidget: WidgetConfig;
	protected abstract get context(): string;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) protected dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ElementRef)) protected _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(IAngularEventingService) private angularEventingService: IAngularEventingService,
		@Inject(IConfigurationService) private configurationService: IConfigurationService,
		@Inject(ILogService) private logService: ILogService,
		@Inject(ICommandService) private commandService: ICommandService,
		@Inject(IContextKeyService) contextKeyService: IContextKeyService,
		@Inject(IMenuService) private menuService: IMenuService,
		@Inject(IKeybindingService) private keybindingService: IKeybindingService,
		@Inject(IContextMenuService) private contextMenuService: IContextMenuService,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super();
		this._tabName = DashboardPage.tabName.bindTo(contextKeyService);
	}

	ngAfterViewInit(): void {
		attachTabbedPanelStyler(this._panel, this.themeService);
		this.updateTheme(this.themeService.getColorTheme());
	}

	protected init() {
		this.dashboardService.dashboardContextKey.set(this.context);
		if (!this.dashboardService.connectionManagementService.connectionInfo) {
			this.notificationService.notify({
				severity: Severity.Error,
				message: nls.localize('missingConnectionInfo', "No connection information could be found for this dashboard")
			});
		} else {
			let tempWidgets = this.dashboardService.getSettings<Array<WidgetConfig>>([this.context, 'widgets'].join('.'));
			this.processTasksWidgets(tempWidgets, this.homeTabId);
			this._originalConfig = objects.deepClone(tempWidgets);
			let properties = this.getProperties();
			this._configModifiers.forEach((cb) => {
				tempWidgets = cb.apply(this, [tempWidgets, this, this.context]);
				properties = properties ? cb.apply(this, [properties, this, this.context]) : undefined;
			});
			this._gridModifiers.forEach(cb => {
				tempWidgets = cb.apply(this, [tempWidgets, this._originalConfig]);
			});
			this.propertiesWidget = properties ? properties[0] : undefined;
			this._panel.options = {
				alwaysShowTabs: true,
				layout: NavigationBarLayout.vertical,
				showIcon: true
			};
			this.createTabs(tempWidgets);
		}

		this.showToolbar = true;
		this.createToolbar(this.toolbarContainer.nativeElement, this.homeTabId);

		this._register(this.themeService.onDidColorThemeChange((event: IColorTheme) => {
			this.updateTheme(event);
		}));
	}

	private getContributedTasks(tabId: string): ITaskbarContent[] {
		const tasks: ITaskbarContent[] = [];
		// for now we only allow contributing to the home tab toolbar.
		if (tabId === this.homeTabId) {
			let primary: IAction[] = [];
			let secondary: IAction[] = [];
			const menu = this.menuService.createMenu(MenuId.DashboardToolbar, this.contextKeyService);
			let groups = menu.getActions({ arg: this.connectionManagementService.connectionInfo.connectionProfile.toIConnectionProfile(), shouldForwardArgs: true });
			fillInActions(groups, { primary, secondary }, false, (group: string) => group === undefined || group === '');

			primary.forEach(a => {
				if (a instanceof MenuItemAction) {
					// Need to ensure that we don't add the same action multiple times
					let foundIndex = firstIndex(tasks, act => act.action && act.action.id === a.id);
					if (foundIndex < 0) {
						tasks.push({ action: a });
					}
				}
			});

			if (primary.length > 0) {
				let separator: HTMLElement = Taskbar.createTaskbarSeparator();
				tasks.push({ element: separator });
			}
		}
		return tasks;
	}

	private createToolbar(parentElement: HTMLElement, tabId: string): void {
		// clear out toolbar
		DOM.clearNode(parentElement);
		this.toolbar = this._register(new Taskbar(parentElement, {
			actionViewItemProvider: action => this.createActionItemProvider(action as Action),
			collapseOverflow: true
		}));
		let content = [];
		content = this.getToolbarContent(tabId);
		if (tabId === this.homeTabId) {
			const configureDashboardCommand = MenuRegistry.getCommand('configureDashboard');
			const configureDashboardAction = new ToolbarAction(configureDashboardCommand.id, configureDashboardCommand.title.toString(), TaskRegistry.getOrCreateTaskIconClassName(configureDashboardCommand), this.runAction, this, this.logService);
			content.push({ action: configureDashboardAction });
		}
		this.toolbar.setContent(content);
	}

	private getToolbarContent(tabId: string): ITaskbarContent[] {
		const toolbarTasks = this.tabToolbarActionsConfig.get(tabId);
		let tasks = TaskRegistry.getTasks();
		let content = [];
		if (types.isArray(toolbarTasks) && toolbarTasks.length > 0) {
			tasks = toolbarTasks.map(i => {
				if (types.isString(i)) {
					if (tasks.some(x => x === i)) {
						return i;
					}
				} else {
					if (tasks.some(x => x === i.name) && this.contextKeyService.contextMatchesRules(ContextKeyExpr.deserialize(i.when))) {
						return i.name;
					}
				}
				return undefined;
			}).filter(i => !!i);
			content = this.convertTasksToToolbarContent(tasks);
		} else {
			content = [];
		}

		// get extension actions contributed to the page's toolbar
		const contributedTasks = this.getContributedTasks(tabId);
		content.push(...contributedTasks);

		const refreshAction = new RefreshWidgetAction(() => {
			this.refresh();
		}, this);
		content.push({ action: refreshAction });
		return content;
	}

	private convertTasksToToolbarContent(tasks: string[]): ITaskbarContent[] {
		let _tasks = tasks.map(i => MenuRegistry.getCommand(i)).filter(v => !!v);

		let toolbarActions = [];
		_tasks.forEach(a => {
			let iconClassName = TaskRegistry.getOrCreateTaskIconClassName(a);
			toolbarActions.push(new ToolbarAction(a.id, a.title.toString(), iconClassName, this.runAction, this, this.logService));
		});

		let content: ITaskbarContent[] = [];
		toolbarActions.forEach(a => {
			content.push({ action: a });
		});

		if (content.length > 0) {
			let separator: HTMLElement = Taskbar.createTaskbarSeparator();
			content.push({ element: separator });
		}

		return content;
	}

	private runAction(id: string): Promise<void> {
		return this.commandService.executeCommand(id, this.connectionManagementService.connectionInfo.connectionProfile);
	}

	private createActionItemProvider(action: Action): IActionViewItem {
		// Create ActionItem for actions contributed by extensions
		if (action instanceof MenuItemAction) {
			return new LabeledMenuItemActionItem(action, this.keybindingService, this.contextMenuService, this.notificationService);
		}
		return undefined;
	}

	private createTabs(homeWidgets: WidgetConfig[]) {
		// Clear all tabs
		this.tabs = [];
		this._tabSettingConfigs = [];
		this._tabsDispose.forEach(i => i.dispose());
		this._tabsDispose = [];

		let allTabs = dashboardHelper.filterConfigs(dashboardRegistry.tabs, this);

		// Before separating tabs into pinned / shown, ensure that the home tab is always set up as expected
		allTabs = this.setAndRemoveHomeTab(allTabs, homeWidgets);

		this.loadNewTabs(allTabs.filter((tab) => tab.group === homeTabGroupId));

		// If preview features are disabled only show the home tab since extension-contributed tabs
		// are still under preview
		const extensionTabsEnabled = this.configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (!extensionTabsEnabled) {
			allTabs = [];
		}

		// Load tab setting configs
		this._tabSettingConfigs = this.dashboardService.getSettings<Array<TabSettingConfig>>([this.context, 'tabs'].join('.'));

		this.addCustomTabGroups(allTabs);
		this.addExtensionsTabGroup(allTabs);

		this.panelActions = [];

		this._cd.detectChanges();

		this._tabsDispose.push(this.dashboardService.onPinUnpinTab(e => {
			const tabConfig = find(this._tabSettingConfigs, i => i.tabId === e.tabId);
			if (tabConfig) {
				tabConfig.isPinned = e.isPinned;
			} else {
				this._tabSettingConfigs.push(e);
			}
			this.rewriteConfig();
		}));

		this._tabsDispose.push(this.dashboardService.onAddNewTabs(e => {
			this.loadNewTabs(e, true);
		}));
	}

	/**
	 * Add the custom tab groups and their child tabs.
	 * @param allTabs The available tabs
	 */
	private addCustomTabGroups(allTabs: IDashboardTab[]): void {
		dashboardRegistry.tabGroups.forEach((tabGroup) => {
			const tabs = allTabs.filter(tab => tab.group === tabGroup.id);
			if (tabs.length > 0) {
				this.addNewTab({
					id: tabGroup.id,
					provider: Constants.anyProviderName,
					originalConfig: [],
					publisher: undefined,
					title: tabGroup.title,
					context: this.context,
					type: 'group-header',
					editable: false,
					canClose: false,
					actions: []
				});
				this.loadNewTabs(tabs);
			}
		});
	}

	/**
	 * Add the "Extensions" tab group, tabs without a group will be added here.
	 * @param allTabs The available tabs
	 */
	private addExtensionsTabGroup(allTabs: IDashboardTab[]): void {
		const tabs = allTabs.filter(tab => !tab.group);
		if (tabs.length > 0) {
			this.addNewTab({
				id: 'generalTabGroupHeader',
				provider: Constants.anyProviderName,
				originalConfig: [],
				publisher: undefined,
				title: nls.localize('dashboard.generalTabGroupHeader', "General"),
				context: this.context,
				type: 'group-header',
				editable: false,
				canClose: false,
				actions: []
			});
			this.loadNewTabs(tabs);
		}
	}

	private setAndRemoveHomeTab(allTabs: IDashboardTab[], homeWidgets: WidgetConfig[]): IDashboardTab[] {
		const homeTabConfig: TabConfig = {
			id: this.homeTabId,
			provider: Constants.anyProviderName,
			publisher: undefined,
			title: this.homeTabTitle,
			container: { 'widgets-container': homeWidgets },
			context: this.context,
			originalConfig: [],
			editable: true,
			canClose: false,
			actions: [],
			iconClass: 'home-tab-icon'
		};

		const homeTabIndex = firstIndex(allTabs, (tab) => tab.isHomeTab === true);
		if (homeTabIndex !== undefined && homeTabIndex > -1) {
			// Have a tab: get its information and copy over to the home tab definition
			const homeTab = allTabs.splice(homeTabIndex, 1)[0];
			const tabConfig = this.initTabComponents(homeTab);
			homeTabConfig.id = tabConfig.id;
			homeTabConfig.container = tabConfig.container;
		}
		this.addNewTab(homeTabConfig);
		return allTabs;
	}

	private rewriteConfig(): void {
		const writeableConfig = objects.deepClone(this._tabSettingConfigs);

		const target: ConfigurationTarget = ConfigurationTarget.USER;
		this.dashboardService.writeSettings([this.context, 'tabs'].join('.'), writeableConfig, target);
	}

	private loadNewTabs(dashboardTabs: IDashboardTab[], openLastTab: boolean = false) {
		if (dashboardTabs && dashboardTabs.length > 0) {
			const selectedTabs = dashboardTabs.map(v => this.initTabComponents(v)).map(v => {
				const config = v as TabConfig;
				config.context = this.context;
				config.editable = false;
				config.canClose = false;
				config.actions = [];
				this.addNewTab(config);
				return config;
			});

			if (openLastTab) {
				// put this immediately on the stack so that is ran *after* the tab is rendered
				setTimeout(() => {
					const selectedLastTab = selectedTabs.pop();
					this._panel.selectTab(selectedLastTab.id);
				});
			}
		}
	}

	private initTabComponents(value: IDashboardTab): { id: string; title: string; container: object; alwaysShow: boolean; iconClass?: string } {
		const containerResult = dashboardHelper.getDashboardContainer(value.container, this.logService);
		if (!containerResult.result) {
			return { id: value.id, title: value.title, container: { 'error-container': undefined }, alwaysShow: value.alwaysShow, iconClass: value.iconClass };
		}
		const key = Object.keys(containerResult.container)[0];
		this.tabContents.set(value.id, key);
		if (key === WIDGETS_CONTAINER || key === GRID_CONTAINER) {
			let configs = <WidgetConfig[]>values(containerResult.container)[0];
			this._configModifiers.forEach(cb => {
				configs = cb.apply(this, [configs, this, this.context]);
			});
			this._gridModifiers.forEach(cb => {
				configs = cb.apply(this, [configs]);
			});

			this.processTasksWidgets(configs, value.id);

			if (key === WIDGETS_CONTAINER) {
				return { id: value.id, title: value.title, container: { 'widgets-container': configs }, alwaysShow: value.alwaysShow, iconClass: value.iconClass };
			}
			else {
				return { id: value.id, title: value.title, container: { 'grid-container': configs }, alwaysShow: value.alwaysShow, iconClass: value.iconClass };
			}
		}
		return { id: value.id, title: value.title, container: containerResult.container, alwaysShow: value.alwaysShow, iconClass: value.iconClass };
	}

	/**
	 * Process the tasks widgets, tasks widgets has been deprecated and the tasks are now in toolbar.
	 * @param widgets widgets
	 * @param tabId tab id
	 */
	private processTasksWidgets(widgets: WidgetConfig[], tabId: string): void {
		let index;
		const allTasks = [];
		// do this in a while loop since there might be multiple tasks widgets in a tab
		do {
			index = widgets.findIndex(c => c.widget['tasks-widget']);
			if (index !== -1) {
				const tasks = widgets[index].widget['tasks-widget'];
				if (Array.isArray(tasks)) {
					allTasks.push(...tasks);
				}
				widgets.splice(index, 1);
			}
		} while (index !== -1);
		this.tabToolbarActionsConfig.set(tabId, allTasks);
	}

	protected getContentType(tab: TabConfig): string {
		return tab.container ? Object.keys(tab.container)[0] : '';
	}

	private addNewTab(tab: TabConfig): void {
		const existedTab = find(this.tabs, i => i.id === tab.id);
		if (!existedTab) {
			if (!tab.iconClass && tab.type !== 'group-header') {
				tab.iconClass = 'default-tab-icon';
			}
			this.tabs.push(tab);
			this._cd.detectChanges();
		}
	}

	private getProperties(): Array<WidgetConfig> {
		const properties = this.dashboardService.getSettings<IPropertiesConfig[] | string | boolean>([this.context, 'properties'].join('.'));
		if (types.isUndefinedOrNull(properties)) {
			return [this.propertiesWidget];
		} else if (types.isBoolean(properties)) {
			return properties ? [this.propertiesWidget] : [];
		} else if (types.isString(properties) && properties === 'collapsed') {
			return [this.propertiesWidget];
		} else if (types.isArray(properties)) {
			return properties.map((item) => {
				const retVal = objects.assign({}, this.propertiesWidget);
				retVal.edition = item.edition;
				retVal.provider = item.provider;
				retVal.widget = { 'properties-widget': { properties: item.properties } };
				return retVal;
			});
		} else {
			return undefined;
		}
	}

	public refresh(refreshConfig: boolean = false): void {
		if (refreshConfig) {
			this.init();
		} else {
			if (this._tabs) {
				const tab = this._tabs.find(t => t.id === this._tabName.get());
				if (tab) {
					tab.refresh();
				}
			}
		}
	}

	public handleTabChange(tab: TabComponent): void {
		this._tabName.set(tab.identifier);
		const tabContent = this.tabContents.get(tab.identifier);
		if (tab.identifier === this.homeTabId || tabContent === WIDGETS_CONTAINER || tabContent === GRID_CONTAINER || tabContent === NAV_SECTION) {
			this.showToolbar = true;
			this.createToolbar(this.toolbarContainer.nativeElement, tab.identifier);
		} else { // hide toolbar
			this.showToolbar = false;
		}

		// control-host container has its own scroll management
		const newTab = this.tabs.find(t => t.id === tab.identifier);
		this.containerOverflowStyle = newTab && this.getContentType(newTab) === 'controlhost-container' ? 'initial' : 'auto';

		this._cd.detectChanges();
	}

	public handleTabClose(tab: TabComponent): void {
		const index = firstIndex(this.tabs, i => i.id === tab.identifier);
		this.tabs.splice(index, 1);
		this.angularEventingService.sendAngularEvent(this.dashboardService.getUnderlyingUri(), AngularEventType.CLOSE_TAB, { id: tab.identifier });
	}

	private updateTheme(theme: IColorTheme): void {
		const border = theme.getColor(DASHBOARD_BORDER);
		this.toolbarContainer.nativeElement.style.borderBottomColor = border.toString();
	}

	public getContentAreaHeight() {
		return this.showToolbar ? `calc(100% - ${(<HTMLElement>this.toolbarContainer.nativeElement).clientHeight}px)` : '100%';
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	const overflowBackground = theme.getColor(EDITOR_PANE_BACKGROUND);
	if (overflowBackground) {
		collector.addRule(`dashboard-page .carbon-taskbar .overflow {
			background-color: ${overflowBackground};
		}`);
	}

	const overflowShadow = theme.getColor(TOOLBAR_OVERFLOW_SHADOW);
	if (overflowShadow) {
		collector.addRule(`dashboard-page .carbon-taskbar .overflow {
			box-shadow: 0px 4px 4px ${overflowShadow};
		}`);
	}

	const border = theme.getColor(DASHBOARD_BORDER);
	if (border) {
		collector.addRule(`dashboard-page .carbon-taskbar .overflow {
			border: 1px solid ${border};
		}`);
	}

	const activeOutline = theme.getColor(focusBorder);
	if (activeOutline) {
		collector.addRule(`dashboard-page .carbon-taskbar .overflow li.focused {
			outline: 1px solid;
			outline-offset: -3px;
			outline-color: ${activeOutline}
		}`);
	}
});
