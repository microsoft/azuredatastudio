/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardPage';
import './dashboardPanelStyles';

import { Component, Inject, forwardRef, ViewChild, ElementRef, ViewChildren, QueryList, OnDestroy, ChangeDetectorRef } from '@angular/core';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { WidgetConfig, TabConfig, PinConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { ConnectionManagementInfo } from 'sql/parts/connection/common/connectionManagementInfo';
import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/common/insightRegistry';
import { DashboardWidgetWrapper } from 'sql/parts/dashboard/common/dashboardWidgetWrapper.component';
import { IPropertiesConfig } from 'sql/parts/dashboard/pages/serverDashboardPage.contribution';
import { PanelComponent } from 'sql/base/browser/ui/panel/panel.component';
import { subscriptionToDisposable } from 'sql/base/common/lifecycle';
import { IDashboardRegistry, Extensions as DashboardExtensions, IDashboardTab } from 'sql/platform/dashboard/common/dashboardRegistry';
import { PinUnpinTabAction, AddFeatureTabAction } from './actions';
import { TabComponent } from 'sql/base/browser/ui/panel/tab.component';
import { IBootstrapService, BOOTSTRAP_SERVICE_ID } from 'sql/services/bootstrap/bootstrapService';
import { AngularEventType, IAngularEvent } from 'sql/services/angularEventing/angularEventingService';
import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { error } from 'sql/base/common/log';
import { WIDGETS_TAB } from 'sql/parts/dashboard/tabs/dashboardWidgetTab.contribution';
import { WEBVIEW_TAB } from 'sql/parts/dashboard/tabs/dashboardWebviewTab.contribution';

import { Registry } from 'vs/platform/registry/common/platform';
import * as types from 'vs/base/common/types';
import { Severity } from 'vs/platform/message/common/message';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import * as nls from 'vs/nls';
import { ScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { addDisposableListener, getContentHeight, EventType } from 'vs/base/browser/dom';
import { IColorTheme } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as colors from 'vs/platform/theme/common/colorRegistry';
import * as themeColors from 'vs/workbench/common/theme';
import { generateUuid } from 'vs/base/common/uuid';
import * as objects from 'vs/base/common/objects';
import Event, { Emitter } from 'vs/base/common/event';
import { Action } from 'vs/base/common/actions';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';

const dashboardRegistry = Registry.as<IDashboardRegistry>(DashboardExtensions.DashboardContributions);

/**
 * @returns whether the provided parameter is a JavaScript Array and each element in the array is a number.
 */
function isNumberArray(value: any): value is number[] {
	return types.isArray(value) && (<any[]>value).every(elem => types.isNumber(elem));
}

@Component({
	selector: 'dashboard-page',
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/common/dashboardPage.component.html'))
})
export abstract class DashboardPage extends Disposable implements OnDestroy {

	protected SKELETON_WIDTH = 5;
	protected tabs: Array<TabConfig> = [];

	private _originalConfig: WidgetConfig[];
	private _scrollableElement: ScrollableElement;

	private _widgetConfigLocation: string;
	private _propertiesConfigLocation: string;

	protected panelActions: Action[];
	private _tabsDispose: Array<IDisposable> = [];
	private _pinnedTabs: Array<PinConfig> = [];

	@ViewChild('properties') private _properties: DashboardWidgetWrapper;
	@ViewChild('scrollable', { read: ElementRef }) private _scrollable: ElementRef;
	@ViewChild('scrollContainer', { read: ElementRef }) private _scrollContainer: ElementRef;
	@ViewChild('propertiesContainer', { read: ElementRef }) private _propertiesContainer: ElementRef;
	@ViewChildren(DashboardTab) private _tabs: QueryList<DashboardTab>;
	@ViewChild(PanelComponent) private _panel: PanelComponent;

	private _editEnabled = new Emitter<boolean>();
	public readonly editEnabled: Event<boolean> = this._editEnabled.event;


	// tslint:disable:no-unused-variable
	private readonly homeTabTitle: string = nls.localize('home', 'Home');

	// a set of config modifiers
	private readonly _configModifiers: Array<(item: Array<WidgetConfig>) => Array<WidgetConfig>> = [
		this.removeEmpty,
		this.initExtensionConfigs,
		this.addProvider,
		this.addEdition,
		this.addContext,
		this.filterConfigs
	];

	private readonly _gridModifiers: Array<(item: Array<WidgetConfig>) => Array<WidgetConfig>> = [
		this.validateGridConfig
	];

	constructor(
		@Inject(forwardRef(() => DashboardServiceInterface)) protected dashboardService: DashboardServiceInterface,
		@Inject(BOOTSTRAP_SERVICE_ID) protected bootstrapService: IBootstrapService,
		@Inject(forwardRef(() => ElementRef)) protected _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
	}

	protected init() {
		if (!this.dashboardService.connectionManagementService.connectionInfo) {
			this.dashboardService.messageService.show(Severity.Warning, nls.localize('missingConnectionInfo', 'No connection information could be found for this dashboard'));
		} else {
			let tempWidgets = this.dashboardService.getSettings<Array<WidgetConfig>>([this.context, 'widgets'].join('.'));
			this._widgetConfigLocation = 'default';
			this._originalConfig = objects.deepClone(tempWidgets);
			let properties = this.getProperties();
			this._configModifiers.forEach((cb) => {
				tempWidgets = cb.apply(this, [tempWidgets]);
				properties = properties ? cb.apply(this, [properties]) : undefined;
			});
			this._gridModifiers.forEach(cb => {
				tempWidgets = cb.apply(this, [tempWidgets]);
			});
			this.propertiesWidget = properties ? properties[0] : undefined;

			this.createTabs(tempWidgets);

		}
	}

	ngAfterViewInit(): void {
		this._register(this.dashboardService.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.dashboardService.themeService.getColorTheme());
		let container = this._scrollContainer.nativeElement as HTMLElement;
		let scrollable = this._scrollable.nativeElement as HTMLElement;
		container.removeChild(scrollable);
		this._scrollableElement = new ScrollableElement(scrollable, {
			horizontal: ScrollbarVisibility.Hidden,
			vertical: ScrollbarVisibility.Auto,
			useShadows: false
		});

		this._scrollableElement.onScroll(e => {
			scrollable.style.bottom = e.scrollTop + 'px';
		});

		container.appendChild(this._scrollableElement.getDomNode());
		let initalHeight = getContentHeight(scrollable);
		this._scrollableElement.setScrollDimensions({
			scrollHeight: Math.max(getContentHeight(scrollable), getContentHeight(container)),
			height: getContentHeight(container)
		});

		this._register(addDisposableListener(window, EventType.RESIZE, () => {
			// Todo: Need to set timeout because we have to make sure that the grids have already rearraged before the getContentHeight gets called.
			setTimeout(() => {
				this._scrollableElement.setScrollDimensions({
					scrollHeight: Math.max(getContentHeight(scrollable), getContentHeight(container)),
					height: getContentHeight(container)
				});
			}, 100);
		}));

		// unforunately because of angular rendering behavior we need to do a double check to make sure nothing changed after this point
		setTimeout(() => {
			let currentheight = getContentHeight(scrollable);
			if (initalHeight !== currentheight) {
				this._scrollableElement.setScrollDimensions({
					scrollHeight: Math.max(getContentHeight(scrollable), getContentHeight(container)),
					height: getContentHeight(container)
				});
			}
		}, 100);
	}

	private createTabs(homeWidgets: WidgetConfig[]) {
		// Clear all tabs
		this.tabs = [];
		this._pinnedTabs = [];
		this._tabsDispose.forEach(i => i.dispose());
		this._tabsDispose = [];

		// Create home tab
		let homeTab: TabConfig = {
			id: 'homeTab',
			publisher: undefined,
			title: this.homeTabTitle,
			content: { 'widgets-tab': homeWidgets },
			context: this.context,
			originalConfig: this._originalConfig,
			editable: true,
			canClose: false,
			actions: []
		};
		this.addNewTab(homeTab);
		this._panel.selectTab(homeTab.id);

		let allTabs = this.filterConfigs(dashboardRegistry.tabs);

		// Load always show tabs
		let alwaysShowTabs = allTabs.filter(tab => tab.alwaysShow);
		this.loadNewTabs(alwaysShowTabs);

		// Load pinned tabs
		this._pinnedTabs = this.dashboardService.getSettings<Array<PinConfig>>([this.context, 'tabs'].join('.'));
		let pinnedDashboardTabs: IDashboardTab[] = [];
		this._pinnedTabs.forEach(pinnedTab => {
			let tab = allTabs.find(i => i.id === pinnedTab.tabId);
			if (tab) {
				pinnedDashboardTabs.push(tab);
			}
		});
		this.loadNewTabs(pinnedDashboardTabs);

		// Set panel actions
		let openedTabs = [...pinnedDashboardTabs, ...alwaysShowTabs];
		let addNewTabAction = this.dashboardService.instantiationService.createInstance(AddFeatureTabAction, allTabs, openedTabs, this.dashboardService.getUnderlyingUri());
		this._tabsDispose.push(addNewTabAction);
		this.panelActions = [addNewTabAction];
		this._cd.detectChanges();

		this._tabsDispose.push(this.dashboardService.onPinUnpinTab(e => {
			if (e.isPinned) {
				this._pinnedTabs.push(e);
			} else {
				let index = this._pinnedTabs.findIndex(i => i.tabId === e.tabId);
				this._pinnedTabs.splice(index, 1);
			}
			this.rewriteConfig();
		}));

		this._tabsDispose.push(this.dashboardService.onAddNewTabs(e => {
			this.loadNewTabs(e);
		}));
	}

	private rewriteConfig(): void {
		let writeableConfig = objects.deepClone(this._pinnedTabs);

		writeableConfig.forEach(i => {
			delete i.isPinned;
		});
		let target: ConfigurationTarget = ConfigurationTarget.USER;
		this.dashboardService.writeSettings([this.context, 'tabs'].join('.'), writeableConfig, target);
	}

	private loadNewTabs(dashboardTabs: IDashboardTab[]) {
		if (dashboardTabs && dashboardTabs.length > 0) {
			let selectedTabs = dashboardTabs.map(v => {

				if (Object.keys(v.content).length !== 1) {
					error('Exactly 1 widget must be defined per space');
				}

				let key = Object.keys(v.content)[0];
				if (key === WIDGETS_TAB) {
					let configs = <WidgetConfig[]>Object.values(v.content)[0];
					this._configModifiers.forEach(cb => {
						configs = cb.apply(this, [configs]);
					});
					this._gridModifiers.forEach(cb => {
						configs = cb.apply(this, [configs]);
					});
					return { id: v.id, title: v.title, content: { 'widgets-tab': configs }, alwaysShow: v.alwaysShow };
				}
				return v;
			}).map(v => {
				let actions = [];
				if (!v.alwaysShow) {
					let pinnedTab = this._pinnedTabs.find(i => i.tabId === v.id);
					actions.push(this.dashboardService.instantiationService.createInstance(PinUnpinTabAction, v.id, this.dashboardService.getUnderlyingUri(), !!pinnedTab));
				}

				let config = v as TabConfig;
				config.context = this.context;
				config.editable = false;
				config.canClose = true;
				config.actions = actions;
				this.addNewTab(config);
				return config;
			});

			// put this immediately on the stack so that is ran *after* the tab is rendered
			setTimeout(() => {
				this._panel.selectTab(selectedTabs.pop().id);
			});
		}
	}


	private getContentType(tab: TabConfig): string {
		return tab.content ? Object.keys(tab.content)[0] : '';
	}

	private addNewTab(tab: TabConfig): void {
		let existedTab = this.tabs.find(i => i.id === tab.id);
		if (!existedTab) {
			this.tabs.push(tab);
			this._cd.detectChanges();
			let tabComponents = this._tabs.find(i => i.id === tab.id);
			this._register(tabComponents.onResize(() => {
				this._scrollableElement.setScrollDimensions({
					scrollHeight: Math.max(getContentHeight(this._scrollable.nativeElement), getContentHeight(this._scrollContainer.nativeElement)),
					height: getContentHeight(this._scrollContainer.nativeElement)
				});
			}));
		}
	}

	private updateTheme(theme: IColorTheme): void {
		let el = this._propertiesContainer.nativeElement as HTMLElement;
		let border = theme.getColor(colors.contrastBorder, true);
		let borderColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true);

		if (border) {
			el.style.borderColor = border.toString();
			el.style.borderBottomWidth = '1px';
			el.style.borderBottomStyle = 'solid';
		} else if (borderColor) {
			el.style.borderBottom = '1px solid ' + borderColor.toString();
		} else {
			el.style.border = 'none';
		}

	}

	ngOnDestroy() {
		this.dispose();
	}

	protected abstract propertiesWidget: WidgetConfig;
	protected abstract get context(): string;

	/**
	 * Returns a filtered version of the widgets passed based on edition and provider
	 * @param config widgets to filter
	 */
	private filterConfigs<T extends { provider?: string | string[], edition?: number | number[] }>(config: T[]): Array<T> {
		let connectionInfo: ConnectionManagementInfo = this.dashboardService.connectionManagementService.connectionInfo;
		let edition = connectionInfo.serverInfo.engineEditionId;
		let provider = connectionInfo.providerId;

		// filter by provider
		return config.filter((item) => {
			if (item.provider) {
				return this.stringCompare(item.provider, provider);
			} else {
				return true;
			}
		}).filter((item) => {
			if (item.edition) {
				if (edition) {
					return this.stringCompare(isNumberArray(item.edition) ? item.edition.map(item => item.toString()) : item.edition.toString(), edition.toString());
				} else {
					this.dashboardService.messageService.show(Severity.Warning, nls.localize('providerMissingEdition', 'Widget filters based on edition, but the provider does not have an edition'));
					return true;
				}
			} else {
				return true;
			}
		});
	}

	/**
	 * Does a compare against the val passed in and the compare string
	 * @param val string or array of strings to compare the compare value to; if array, it will compare each val in the array
	 * @param compare value to compare to
	 */
	private stringCompare(val: string | Array<string>, compare: string): boolean {
		if (types.isUndefinedOrNull(val)) {
			return true;
		} else if (types.isString(val)) {
			return val === compare;
		} else if (types.isStringArray(val)) {
			return val.some(item => item === compare);
		} else {
			return false;
		}
	}

	/**
	 * Add provider to the passed widgets and returns the new widgets
	 * @param widgets Array of widgets to add provider onto
	 */
	protected addProvider(config: WidgetConfig[]): Array<WidgetConfig> {
		let provider = this.dashboardService.connectionManagementService.connectionInfo.providerId;
		return config.map((item) => {
			if (item.provider === undefined) {
				item.provider = provider;
			}
			return item;
		});
	}

	/**
	 * Adds the edition to the passed widgets and returns the new widgets
	 * @param widgets Array of widgets to add edition onto
	 */
	protected addEdition(config: WidgetConfig[]): Array<WidgetConfig> {
		let connectionInfo: ConnectionManagementInfo = this.dashboardService.connectionManagementService.connectionInfo;
		let edition = connectionInfo.serverInfo.engineEditionId;
		return config.map((item) => {
			if (item.edition === undefined) {
				item.edition = edition;
			}
			return item;
		});
	}

	/**
	 * Adds the context to the passed widgets and returns the new widgets
	 * @param widgets Array of widgets to add context to
	 */
	protected addContext(config: WidgetConfig[]): Array<WidgetConfig> {
		let context = this.context;
		return config.map((item) => {
			if (item.context === undefined) {
				item.context = context;
			}
			return item;
		});
	}

	/**
	 * Validates configs to make sure nothing will error out and returns the modified widgets
	 * @param config Array of widgets to validate
	 */
	protected removeEmpty(config: WidgetConfig[]): Array<WidgetConfig> {
		return config.filter(widget => {
			return !types.isUndefinedOrNull(widget);
		});
	}

	/**
	 * Validates configs to make sure nothing will error out and returns the modified widgets
	 * @param config Array of widgets to validate
	 */
	protected validateGridConfig(config: WidgetConfig[]): Array<WidgetConfig> {
		return config.map((widget, index) => {
			if (widget.gridItemConfig === undefined) {
				widget.gridItemConfig = {};
			}
			const id = generateUuid();
			widget.gridItemConfig.payload = { id };
			widget.id = id;
			this._originalConfig[index].id = id;
			return widget;
		});
	}

	protected initExtensionConfigs(configurations: WidgetConfig[]): Array<WidgetConfig> {
		let widgetRegistry = <IInsightRegistry>Registry.as(Extensions.InsightContribution);
		return configurations.map((config) => {
			if (config.widget && Object.keys(config.widget).length === 1) {
				let key = Object.keys(config.widget)[0];
				let insightConfig = widgetRegistry.getRegisteredExtensionInsights(key);
				if (insightConfig !== undefined) {
					// Setup the default properties for this extension if needed
					if (!config.provider && insightConfig.provider) {
						config.provider = insightConfig.provider;
					}
					if (!config.name && insightConfig.name) {
						config.name = insightConfig.name;
					}
					if (!config.edition && insightConfig.edition) {
						config.edition = insightConfig.edition;
					}
					if (!config.gridItemConfig && insightConfig.gridItemConfig) {
						config.gridItemConfig = {
							sizex: insightConfig.gridItemConfig.x,
							sizey: insightConfig.gridItemConfig.y
						};
					}
					if (config.gridItemConfig && !config.gridItemConfig.sizex && insightConfig.gridItemConfig && insightConfig.gridItemConfig.x) {
						config.gridItemConfig.sizex = insightConfig.gridItemConfig.x;
					}
					if (config.gridItemConfig && !config.gridItemConfig.sizey && insightConfig.gridItemConfig && insightConfig.gridItemConfig.y) {
						config.gridItemConfig.sizey = insightConfig.gridItemConfig.y;
					}
				}
			}
			return config;
		});
	}

	private getProperties(): Array<WidgetConfig> {
		let properties = this.dashboardService.getSettings<IPropertiesConfig[]>([this.context, 'properties'].join('.'));
		this._propertiesConfigLocation = 'default';
		if (types.isUndefinedOrNull(properties)) {
			return [this.propertiesWidget];
		} else if (types.isBoolean(properties)) {
			return properties ? [this.propertiesWidget] : [];
		} else if (types.isArray(properties)) {
			return properties.map((item) => {
				let retVal = Object.assign({}, this.propertiesWidget);
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
			this.refreshProperties();
		} else {
			this.refreshProperties();
			if (this._tabs) {
				this._tabs.forEach(tabContent => {
					tabContent.refresh();
				});
			}
		}
	}

	private refreshProperties(): void {
		if (this._properties) {
			this._properties.refresh();
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
		let localtab = this._tabs.find(i => i.id === tab.identifier);
		this._editEnabled.fire(localtab.editable);
		this._cd.detectChanges();
		localtab.layout();
	}

	public handleTabClose(tab: TabComponent): void {
		let index = this.tabs.findIndex(i => i.id === tab.identifier);
		this.tabs.splice(index, 1);
		this._cd.detectChanges();
		this.bootstrapService.angularEventingService.sendAngularEvent(this.dashboardService.getUnderlyingUri(), AngularEventType.CLOSE_TAB, { id: tab.identifier });
	}
}
