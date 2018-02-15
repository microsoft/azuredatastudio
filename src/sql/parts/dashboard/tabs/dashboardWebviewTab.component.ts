/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./dashboardWebviewTab';

import { Component, forwardRef, Input, AfterContentInit, ViewChild } from '@angular/core';

import Event, { Emitter } from 'vs/base/common/event';

import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { TabConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { WebviewTabContent } from 'sql/parts/dashboard/tabContents/webviewTabContent.component';

@Component({
	selector: 'dashboard-webview-tab',
	providers: [{ provide: DashboardTab, useExisting: forwardRef(() => DashboardWebviewTab) }],
	template: `
		<webview-tab-content [webviewId]="tab.id">
		</webview-tab-content>
	`
})
export class DashboardWebviewTab extends DashboardTab implements AfterContentInit {
	@Input() private tab: TabConfig;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	@ViewChild(WebviewTabContent) private _webviewTabContent: WebviewTabContent;
	constructor() {
		super();
	}

	ngAfterContentInit(): void {
		this._register(this._webviewTabContent.onResize(() => {
			this._onResize.fire();
		}));
	}

	public layout(): void {
		this._webviewTabContent.layout();
	}

	public get id(): string {
		return this.tab.id;
	}

	public get editable(): boolean {
		return this.tab.editable;
	}

	public refresh(): void {
		// no op
	}
}
