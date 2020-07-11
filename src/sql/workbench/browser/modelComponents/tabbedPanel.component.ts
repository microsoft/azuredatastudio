/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./media/tabbedPanel';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnDestroy, ViewChild } from '@angular/core';
import { NavigationBarLayout, PanelComponent } from 'sql/base/browser/ui/panel/panel.component';
import { TabType } from 'sql/base/browser/ui/panel/tab.component';
import { ContainerBase, ItemDescriptor } from 'sql/workbench/browser/modelComponents/componentBase';
import { ComponentEventType, IComponent, IComponentDescriptor, IModelStore, ModelViewAction } from 'sql/platform/dashboard/browser/interfaces';
import { IUserFriendlyIcon, createIconCssClass } from 'sql/workbench/browser/modelComponents/iconUtils';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { attachTabbedPanelStyler } from 'sql/workbench/common/styler';
import { TabbedPanelLayout } from 'azdata';
import { ILogService } from 'vs/platform/log/common/log';

export interface TabConfig {
	title: string;
	id?: string;
	group: string;
	icon?: IUserFriendlyIcon;
}

interface Tab {
	title: string;
	content?: IComponentDescriptor;
	id?: string;
	type: TabType;
	iconClass?: string;
}

/**
 * Defines the tab orientation of TabbedPanelComponent
 */
export enum TabOrientation {
	Vertical = 'vertical',
	Horizontal = 'horizontal'
}

@Component({
	templateUrl: decodeURI(require.toUrl('./tabbedPanel.component.html'))
})
export default class TabbedPanelComponent extends ContainerBase<TabConfig> implements IComponent, OnDestroy, AfterViewInit {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;
	@ViewChild(PanelComponent) private _panel: PanelComponent;

	private _tabs: Tab[] = [];
	private _itemIndexToProcess: number = 0;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(ILogService) private logService: ILogService
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngAfterViewInit(): void {
		this._register(attachTabbedPanelStyler(this._panel, this.themeService));
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	setLayout(layout: TabbedPanelLayout): void {
		this._panel.options = {
			alwaysShowTabs: layout.alwaysShowTabs ?? false,
			layout: (layout.orientation ?? TabOrientation.Horizontal) === TabOrientation.Horizontal ? NavigationBarLayout.horizontal : NavigationBarLayout.vertical,
			showIcon: layout.showIcon ?? false
		};
	}

	handleTabChange(event: any): void {
		this.fireEvent({
			eventType: ComponentEventType.onDidChange,
			args: event.identifier
		});
	}

	get tabs(): Tab[] {
		if (this.items.length > this._itemIndexToProcess) {
			let currentGroup: string | undefined = this.items.length === 1 ? undefined : this.items[this._itemIndexToProcess - 1].config.group;
			for (let i = this._itemIndexToProcess; i < this.items.length; i++) {
				const item = this.items[i];
				if (item.config.group !== currentGroup) {
					currentGroup = item.config.group;
					if (currentGroup) {
						this._tabs.push({
							title: currentGroup,
							type: 'group-header'
						});
					}
				}

				this._tabs.push({
					title: item.config.title,
					id: item.config.id,
					content: item.descriptor,
					iconClass: item.config.icon ? createIconCssClass(item.config.icon) : undefined,
					type: 'tab'
				});
			}
			this._itemIndexToProcess = this.items.length;
		}
		return this._tabs;
	}

	onItemsUpdated(): void {
		if (this.items.length === 0) {
			this._itemIndexToProcess = 0;
			this._tabs = [];
		}

		const firstTabIndex = this._tabs.findIndex(tab => tab.type === 'tab');
		if (firstTabIndex >= 0) {
			this._panel.selectTab(firstTabIndex);
		}
	}

	onItemLayoutUpdated(item: ItemDescriptor<TabConfig>): void {
		this._panel.updateTab(item.config.id, { title: item.config.title, iconClass: item.config.icon ? createIconCssClass(item.config.icon) : undefined });
	}

	public doAction(action: string, ...args: any[]): void {
		switch (action) {
			case ModelViewAction.SelectTab:
				if (typeof args?.[0] !== 'string') {
					this.logService.warn(`Got unknown arg type for SelectTab action ${args?.[0]}`);
					return;
				}
				this.selectTab(args[0]);
		}
	}

	public selectTab(id: string): void {
		this._panel.selectTab(id);
	}
}
