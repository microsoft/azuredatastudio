/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardPage';
import 'sql/workbench/parts/dashboard/browser/core/dashboardPanelStyles';

import { Component, Inject, forwardRef, ViewChild, ElementRef, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';

import { DashboardServiceInterface } from 'sql/workbench/parts/dashboard/browser/services/dashboardServiceInterface.service';
import { CommonServiceInterface, SingleConnectionManagementService } from 'sql/platform/bootstrap/browser/commonServiceInterface.service';
import { WidgetConfig, TabConfig, TabSettingConfig } from 'sql/workbench/parts/dashboard/browser/core/dashboardWidget';
import { IPropertiesConfig } from 'sql/workbench/parts/dashboard/browser/pages/serverDashboardPage.contribution';
import { PanelComponent } from 'sql/base/browser/ui/panel/panel.component';
import { IDashboardRegistry, Extensions as DashboardExtensions, IDashboardTab } from 'sql/platform/dashboard/browser/dashboardRegistry';
import { PinUnpinTabAction, AddFeatureTabAction } from './actions';
import { TabComponent, TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { AngularEventType, IAngularEventingService } from 'sql/platform/angularEventing/common/angularEventingService';
import { DashboardTab, IConfigModifierCollection } from 'sql/workbench/parts/dashboard/browser/core/interfaces';
import * as dashboardHelper from 'sql/workbench/parts/dashboard/browser/core/dashboardHelper';
import { WIDGETS_CONTAINER } from 'sql/workbench/parts/dashboard/browser/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER } from 'sql/workbench/parts/dashboard/browser/containers/dashboardGridContainer.contribution';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import * as Constants from 'sql/platform/connection/common/constants';

import { Registry } from 'vs/platform/registry/common/platform';
import * as types from 'vs/base/common/types';
import { IDisposable } from 'vs/base/common/lifecycle';
import * as nls from 'vs/nls';
import * as objects from 'vs/base/common/objects';
import { Event, Emitter } from 'vs/base/common/event';
import { Action } from 'vs/base/common/actions';
import { ConfigurationTarget, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import Severity from 'vs/base/common/severity';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILogService } from 'vs/platform/log/common/log';

const dashboardRegistry = Registry.as<IDashboardRegistry>(DashboardExtensions.DashboardContributions);

@Component({
	selector: 'dashboard-page',
	templateUrl: decodeURI(require.toUrl('./dashboardPage.component.html'))
})
export abstract class DashboardPage extends AngularDisposable implements IConfigModifierCollection {

	protected tabs: Array<TabConfig> = [];

	private _originalConfig: WidgetConfig[];

	private _widgetConfigLocation: string;
	private _propertiesConfigLocation: string;

	protected panelActions: Action[];
	private _tabsDispose: Array<IDisposable> = [];
	private _tabSettingConfigs: Array<TabSettingConfig> = [];

	@ViewChildren(TabChild) private _tabs: QueryList<DashboardTab>;
	@ViewChild(PanelComponent) private _panel: PanelComponent;

	private _editEnabled = new Emitter<boolean>();
	public readonly editEnabled: Event<boolean> = this._editEnabled.event;

	// tslint:disable:no-unused-variable
	private readonly homeTabTitle: string = nls.localize('home', "Home");

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

	private readonly _gridModifiers: Array<(item: Array<WidgetConfig>, originalConfig: Array<WidgetConfig>) => Array<WidgetConfig>> = [
		dashboardHelper.validateGridConfig
	];

	protected abstract propertiesWidget: WidgetConfig;
	protected abstract get context(): string;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) protected dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ElementRef)) protected _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef,
		@Inject(IInstantiationService) private instantiationService: IInstantiationService,
		@Inject(INotificationService) private notificationService: INotificationService,
		@Inject(IAngularEventingService) private angularEventingService: IAngularEventingService,
		@Inject(IConfigurationService) private configurationService: IConfigurationService,
		@Inject(ILogService) private logService: ILogService
	) {
		super();
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
			this._widgetConfigLocation = 'default';
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

			this.createTabs(tempWidgets);
		}
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

		// If preview features are disabled only show the home tab
		const extensionTabsEnabled = this.configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (!extensionTabsEnabled) {
			allTabs = [];
		}

		// Load tab setting configs
		this._tabSettingConfigs = this.dashboardService.getSettings<Array<TabSettingConfig>>([this.context, 'tabs'].join('.'));

		const pinnedDashboardTabs: IDashboardTab[] = [];
		const alwaysShowTabs = allTabs.filter(tab => tab.alwaysShow);

		this._tabSettingConfigs.forEach(config => {
			if (config.tabId && types.isBoolean(config.isPinned)) {
				const tab = allTabs.find(i => i.id === config.tabId);
				if (tab) {
					if (config.isPinned) {
						pinnedDashboardTabs.push(tab);
					} else {
						// overwrite always show if specify in user settings
						const index = alwaysShowTabs.findIndex(i => i.id === tab.id);
						alwaysShowTabs.splice(index, 1);
					}
				}
			}
		});

		this.loadNewTabs(pinnedDashboardTabs);
		this.loadNewTabs(alwaysShowTabs);

		// Set panel actions
		const openedTabs = [...pinnedDashboardTabs, ...alwaysShowTabs];
		if (extensionTabsEnabled) {
			const addNewTabAction = this.instantiationService.createInstance(AddFeatureTabAction, allTabs, openedTabs, this.dashboardService.getUnderlyingUri());
			this._tabsDispose.push(addNewTabAction);
			this.panelActions = [addNewTabAction];
		} else {
			this.panelActions = [];
		}
		this._cd.detectChanges();

		this._tabsDispose.push(this.dashboardService.onPinUnpinTab(e => {
			const tabConfig = this._tabSettingConfigs.find(i => i.tabId === e.tabId);
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

	private setAndRemoveHomeTab(allTabs: IDashboardTab[], homeWidgets: WidgetConfig[]): IDashboardTab[] {
		const homeTabConfig: TabConfig = {
			id: 'homeTab',
			provider: Constants.anyProviderName,
			publisher: undefined,
			title: this.homeTabTitle,
			container: { 'widgets-container': homeWidgets },
			context: this.context,
			originalConfig: this._originalConfig,
			editable: true,
			canClose: false,
			actions: []
		};

		const homeTabIndex = allTabs.findIndex((tab) => tab.isHomeTab === true);
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
				const actions = [];
				const tabSettingConfig = this._tabSettingConfigs.find(i => i.tabId === v.id);
				let isPinned = false;
				if (tabSettingConfig) {
					isPinned = tabSettingConfig.isPinned;
				} else if (v.alwaysShow) {
					isPinned = true;
				}
				actions.push(this.instantiationService.createInstance(PinUnpinTabAction, v.id, this.dashboardService.getUnderlyingUri(), isPinned));

				const config = v as TabConfig;
				config.context = this.context;
				config.editable = false;
				config.canClose = true;
				config.actions = actions;
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

	private initTabComponents(value: IDashboardTab): { id: string; title: string; container: object; alwaysShow: boolean; } {
		const containerResult = dashboardHelper.getDashboardContainer(value.container, this.logService);
		if (!containerResult.result) {
			return { id: value.id, title: value.title, container: { 'error-container': undefined }, alwaysShow: value.alwaysShow };
		}
		const key = Object.keys(containerResult.container)[0];
		if (key === WIDGETS_CONTAINER || key === GRID_CONTAINER) {
			let configs = <WidgetConfig[]>Object.values(containerResult.container)[0];
			this._configModifiers.forEach(cb => {
				configs = cb.apply(this, [configs, this, this.context]);
			});
			this._gridModifiers.forEach(cb => {
				configs = cb.apply(this, [configs]);
			});
			if (key === WIDGETS_CONTAINER) {
				return { id: value.id, title: value.title, container: { 'widgets-container': configs }, alwaysShow: value.alwaysShow };
			}
			else {
				return { id: value.id, title: value.title, container: { 'grid-container': configs }, alwaysShow: value.alwaysShow };
			}
		}
		return { id: value.id, title: value.title, container: containerResult.container, alwaysShow: value.alwaysShow };
	}

	protected getContentType(tab: TabConfig): string {
		return tab.container ? Object.keys(tab.container)[0] : '';
	}

	private addNewTab(tab: TabConfig): void {
		const existedTab = this.tabs.find(i => i.id === tab.id);
		if (!existedTab) {
			this.tabs.push(tab);
			this._cd.detectChanges();
		}
	}

	private getProperties(): Array<WidgetConfig> {
		const properties = this.dashboardService.getSettings<IPropertiesConfig[] | string | boolean>([this.context, 'properties'].join('.'));
		this._propertiesConfigLocation = 'default';
		if (types.isUndefinedOrNull(properties)) {
			return [this.propertiesWidget];
		} else if (types.isBoolean(properties)) {
			return properties ? [this.propertiesWidget] : [];
		} else if (types.isString(properties) && properties === 'collapsed') {
			return [this.propertiesWidget];
		} else if (types.isArray(properties)) {
			return properties.map((item) => {
				const retVal = Object.assign({}, this.propertiesWidget);
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
				this._tabs.forEach(tabContent => {
					tabContent.refresh();
				});
			}
		}
	}

	public enableEdit(): void {
		if (this._tabs) {
			this._tabs.forEach(tabContent => {
				tabContent.enableEdit();
			});
		}
	}

	public handleTabChange(tab: TabComponent): void {
		this._cd.detectChanges();
		const localtab = this._tabs.find(i => i.id === tab.identifier);
		this._editEnabled.fire(localtab.editable);
		this._cd.detectChanges();
	}

	public handleTabClose(tab: TabComponent): void {
		const index = this.tabs.findIndex(i => i.id === tab.identifier);
		this.tabs.splice(index, 1);
		this.angularEventingService.sendAngularEvent(this.dashboardService.getUnderlyingUri(), AngularEventType.CLOSE_TAB, { id: tab.identifier });
	}
}
