/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardNavSection';

import { Component, Inject, Input, forwardRef, ViewChild, ViewChildren, QueryList, OnDestroy, ChangeDetectorRef, OnChanges, AfterContentInit } from '@angular/core';

import { CommonServiceInterface, SingleConnectionManagementService } from 'sql/workbench/services/bootstrap/browser/commonServiceInterface.service';
import { WidgetConfig, TabConfig, NavSectionConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { PanelComponent, IPanelOptions, NavigationBarLayout } from 'sql/base/browser/ui/panel/panel.component';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { DashboardTab, IConfigModifierCollection } from 'sql/workbench/contrib/dashboard/browser/core/interfaces';
import { WIDGETS_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardWidgetContainer.contribution';
import { GRID_CONTAINER } from 'sql/workbench/contrib/dashboard/browser/containers/dashboardGridContainer.contribution';
import * as dashboardHelper from 'sql/workbench/contrib/dashboard/browser/core/dashboardHelper';

import { Event, Emitter } from 'vs/base/common/event';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { ILogService } from 'vs/platform/log/common/log';
import { find } from 'vs/base/common/arrays';
import { values } from 'vs/base/common/collections';

@Component({
	selector: 'dashboard-nav-section',
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardNavSection) }],
	templateUrl: decodeURI(require.toUrl('./dashboardNavSection.component.html'))
})
export class DashboardNavSection extends DashboardTab implements OnDestroy, OnChanges, AfterContentInit, IConfigModifierCollection {
	@Input() private tab: TabConfig;
	protected tabs: Array<TabConfig> = [];
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	// tslint:disable-next-line:no-unused-variable
	private readonly panelOpt: IPanelOptions = {
		layout: NavigationBarLayout.horizontal
	};

	// a set of config modifiers
	private readonly _configModifiers: Array<(item: Array<WidgetConfig>, collection: IConfigModifierCollection, context: string) => Array<WidgetConfig>> = [
		dashboardHelper.removeEmpty,
		dashboardHelper.initExtensionConfigs,
		dashboardHelper.addProvider,
		dashboardHelper.addEdition,
		dashboardHelper.addContext,
		dashboardHelper.filterConfigs
	];

	private readonly _gridModifiers: Array<(item: Array<WidgetConfig>, originalConfig?: Array<WidgetConfig>) => Array<WidgetConfig>> = [
		dashboardHelper.validateGridConfig
	];

	@ViewChildren(TabChild) private _tabs: QueryList<DashboardTab>;
	@ViewChild(PanelComponent) private _panel: PanelComponent;
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) protected dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef,
		@Inject(ILogService) private logService: ILogService
	) {
		super();
	}

	ngOnChanges() {
		this.tabs = [];
		let navSectionContainers: NavSectionConfig[] = [];
		if (this.tab.container) {
			navSectionContainers = values(this.tab.container)[0];
			let hasIcon = true;
			navSectionContainers.forEach(navSection => {
				if (!navSection.iconClass) {
					hasIcon = false;
				}
			});
			this.panelOpt.showIcon = hasIcon;
			this.loadNewTabs(navSectionContainers);
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

	private loadNewTabs(dashboardTabs: NavSectionConfig[]) {
		if (dashboardTabs && dashboardTabs.length > 0) {
			dashboardTabs.map(v => {
				const containerResult = dashboardHelper.getDashboardContainer(v.container, this.logService);
				if (!containerResult.result) {
					return { id: v.id, title: v.title, container: { 'error-container': undefined } };
				}

				const key = Object.keys(containerResult.container)[0];
				if (key === WIDGETS_CONTAINER || key === GRID_CONTAINER) {
					let configs = <WidgetConfig[]>values(containerResult.container)[0];
					this._configModifiers.forEach(cb => {
						configs = cb.apply(this, [configs, this, this.tab.context]);
					});
					this._gridModifiers.forEach(cb => {
						configs = cb.apply(this, [configs]);
					});
					if (key === WIDGETS_CONTAINER) {
						return { id: v.id, title: v.title, container: { 'widgets-container': configs }, iconClass: v.iconClass };

					} else {
						return { id: v.id, title: v.title, container: { 'grid-container': configs }, iconClass: v.iconClass };
					}
				}
				return { id: v.id, title: v.title, container: containerResult.container, iconClass: v.iconClass };
			}).map(v => {
				const config = v as TabConfig;
				config.context = this.tab.context;
				config.editable = false;
				config.canClose = false;
				this.addNewTab(config);
				return config;
			});
		}
	}

	private addNewTab(tab: TabConfig): void {
		const existedTab = find(this.tabs, i => i.id === tab.id);
		if (!existedTab) {
			this.tabs.push(tab);
			this._cd.detectChanges();
		}
	}

	protected getContentType(tab: TabConfig): string {
		return tab.container ? Object.keys(tab.container)[0] : '';
	}

	public get id(): string {
		return this.tab.id;
	}

	public get editable(): boolean {
		return this.tab.editable;
	}

	public layout() {
		if (this._tabs) {
			const activeTabId = this._panel.getActiveTab;
			const localtab = this._tabs.find(i => i.id === activeTabId);
			this._cd.detectChanges();
			localtab.layout();
		}
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

	public get connectionManagementService(): SingleConnectionManagementService {
		return this.dashboardService.connectionManagementService;
	}

	public get contextKeyService(): IContextKeyService {
		return this.dashboardService.scopedContextKeyService;
	}
}
