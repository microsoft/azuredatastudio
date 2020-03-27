/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardWidgetContainer';

import { Component, Inject, Input, forwardRef, ViewChild, ChangeDetectorRef, AfterContentInit } from '@angular/core';

import { TabConfig, WidgetConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { DashboardTab } from 'sql/workbench/contrib/dashboard/browser/core/interfaces';
import { WidgetContent } from 'sql/workbench/contrib/dashboard/browser/contents/widgetContent.component';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';

import { Event, Emitter } from 'vs/base/common/event';
import { values } from 'vs/base/common/collections';

@Component({
	selector: 'dashboard-widget-container',
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardWidgetContainer) }],
	template: `
		<widget-content [widgets]="widgets" [originalConfig]="tab.originalConfig" [context]="tab.context">
		</widget-content>
	`
})
export class DashboardWidgetContainer extends DashboardTab implements AfterContentInit {
	@Input() protected tab: TabConfig;
	protected widgets: WidgetConfig[];
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	@ViewChild(WidgetContent) protected _widgetContent: WidgetContent;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
	}

	ngOnInit() {
		if (this.tab.container) {
			this.widgets = values(this.tab.container)[0];
			this._cd.detectChanges();
		}
	}

	ngAfterContentInit(): void {
		this._register(this._widgetContent.onResize(() => {
			this._onResize.fire();
		}));
	}

	public get id(): string {
		return this.tab.id;
	}

	public get editable(): boolean {
		return this.tab.editable;
	}

	public layout() {
		this._widgetContent.layout();
	}

	public refresh(): void {
		this._widgetContent.refresh();
	}

	public enableEdit(): void {
		this._widgetContent.enableEdit();
	}
}
