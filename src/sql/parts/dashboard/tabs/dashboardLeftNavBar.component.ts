/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardLeftNavBar';

import { Component, Inject, Input, forwardRef, ViewChild, ElementRef, ViewChildren, QueryList, OnDestroy, ChangeDetectorRef, EventEmitter, OnChanges, AfterContentInit } from '@angular/core';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { WidgetConfig, TabConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { IDashboardInnerTabRegistry, Extensions as InnerTabExtensions, IDashboardInnerTab } from 'sql/platform/dashboard/common/innerTabRegistry';
import { TabComponent } from 'sql/base/browser/ui/panel/tab.component';
import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { error } from 'sql/base/common/log';
import { WIDGETS_TAB } from 'sql/parts/dashboard/tabs/dashboardWidgetTab.contribution';
import * as widgetHelper from 'sql/parts/dashboard/common/dashboardWidgetHelper';

import { Registry } from 'vs/platform/registry/common/platform';
import Event, { Emitter } from 'vs/base/common/event';

const innerTabRegistry = Registry.as<IDashboardInnerTabRegistry>(InnerTabExtensions.InnerTabContributions);

@Component({
	selector: 'dashboard-left-nav-bar',
	providers: [{ provide: DashboardTab, useExisting: forwardRef(() => DashboardLeftNavBar) }],
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/tabs/dashboardLeftNavBar.component.html'))
})
export class DashboardLeftNavBar extends DashboardTab implements OnDestroy, OnChanges, AfterContentInit {
	@Input() private tab: TabConfig;
	protected tabs: Array<TabConfig> = [];
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	// tslint:disable-next-line:no-unused-variable
	private readonly panelOpt: IPanelOptions = {
		layout: NavigationBarLayout.vertical
	};

	// a set of config modifiers
	private readonly _configModifiers: Array<(item: Array<WidgetConfig>, dashboardServer: DashboardServiceInterface, context: string) => Array<WidgetConfig>> = [
		widgetHelper.removeEmpty,
		widgetHelper.initExtensionConfigs,
		widgetHelper.addProvider,
		widgetHelper.addEdition,
		widgetHelper.addContext,
		widgetHelper.filterConfigs
	];

	private readonly _gridModifiers: Array<(item: Array<WidgetConfig>, originalConfig: Array<WidgetConfig>) => Array<WidgetConfig>> = [
		widgetHelper.validateGridConfig
	];

	@ViewChildren(DashboardTab) private _tabs: QueryList<DashboardTab>;
	@ViewChild(PanelComponent) private _panel: PanelComponent;
	constructor(
		@Inject(forwardRef(() => DashboardServiceInterface)) protected dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
	}

	ngOnChanges() {
		this.tabs = [];
		let innerTabIds = [];
		let allPosibleInnerTab = innerTabRegistry.innerTabs;
		let filteredTabs: IDashboardInnerTab[] = [];
		if (this.tab.content) {
			innerTabIds = Object.values(this.tab.content)[0];
			if (innerTabIds && innerTabIds.length > 0) {
				innerTabIds.forEach(tabId => {
					let tab = allPosibleInnerTab.find(i => i.id === tabId);
					filteredTabs.push(tab);
				});
				this.loadNewTabs(filteredTabs);
			}
			this._cd.detectChanges();
		}
	}

	ngAfterContentInit(): void {
		if (this._tabs) {
			this._tabs.forEach(tabContent => {
				this._register(tabContent.onResize(() => {
					this._onResize.fire();
				}));
			});
		}
	}

	ngOnDestroy() {
		this.dispose();
	}

	private loadNewTabs(dashboardTabs: IDashboardInnerTab[]) {
		if (dashboardTabs && dashboardTabs.length > 0) {
			let selectedTabs = dashboardTabs.map(v => {

				if (Object.keys(v.content).length !== 1) {
					error('Exactly 1 content must be defined per space');
				}

				let key = Object.keys(v.content)[0];
				if (key === WIDGETS_TAB) {
					let configs = <WidgetConfig[]>Object.values(v.content)[0];
					this._configModifiers.forEach(cb => {
						configs = cb.apply(this, [configs, this.dashboardService, this.tab.context]);
					});
					this._gridModifiers.forEach(cb => {
						configs = cb.apply(this, [configs]);
					});
					return { id: v.id, title: v.title, content: { 'widgets-tab': configs } };
				}
				return { id: v.id, title: v.title, content: v.content };
			}).map(v => {
				let config = v as TabConfig;
				config.context = this.tab.context;
				config.editable = false;
				config.canClose = false;
				this.addNewTab(config);
				return config;
			});

			// put this immediately on the stack so that is ran *after* the tab is rendered
			setTimeout(() => {
				this._panel.selectTab(selectedTabs.pop().id);
			});
		}
	}

	private addNewTab(tab: TabConfig): void {
		let existedTab = this.tabs.find(i => i.id === tab.id);
		if (!existedTab) {
			this.tabs.push(tab);
			this._cd.detectChanges();
		}
	}

	private getContentType(tab: TabConfig): string {
		return tab.content ? Object.keys(tab.content)[0] : '';
	}

	public get id(): string {
		return this.tab.id;
	}

	public get editable(): boolean {
		return this.tab.editable;
	}

	public layout() {

	}

	public refresh(): void {
		if (this._tabs) {
			this._tabs.forEach(tabContent => {
				tabContent.refresh();
			});
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
		localtab.layout();
	}
}
