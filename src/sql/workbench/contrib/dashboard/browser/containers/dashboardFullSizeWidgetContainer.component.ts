/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./DashboardFullSizeWidgetContainer';
import { Component, Inject, Input, forwardRef, ChangeDetectorRef, AfterContentInit, ViewChild } from '@angular/core';
import { TabConfig, WidgetConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { DashboardTab } from 'sql/workbench/contrib/dashboard/browser/core/interfaces';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { Event, Emitter } from 'vs/base/common/event';
import { values } from 'vs/base/common/collections';
import { DashboardWidgetWrapper } from 'sql/workbench/contrib/dashboard/browser/contents/dashboardWidgetWrapper.component';

@Component({
	selector: 'dashboard-full-size-widget-container',
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardFullSizeWidgetContainer) }],
	template: `
		<div class="full-size-widget-container">
			<dashboard-widget-wrapper [_config]="widget">
			</dashboard-widget-wrapper>
		</div>`
})
export class DashboardFullSizeWidgetContainer extends DashboardTab implements AfterContentInit {
	@Input() protected tab: TabConfig;
	@ViewChild(DashboardWidgetWrapper) private widgetWrapper: DashboardWidgetWrapper;

	protected widget: WidgetConfig;
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		if (this.tab.container) {
			this.widget = values(this.tab.container)[0];
			this._cd.detectChanges();
		}
	}

	ngAfterContentInit(): void {
	}

	public get id(): string {
		return this.tab.id;
	}

	public get editable(): boolean {
		return this.tab.editable;
	}

	public layout() {
		this.widgetWrapper.layout();
	}

	public refresh(): void {
		this.widgetWrapper.refresh();
	}
}
