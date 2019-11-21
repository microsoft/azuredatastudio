/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardWebviewContainer';

import { Component, forwardRef, Input, AfterContentInit, ViewChild } from '@angular/core';

import { Event, Emitter } from 'vs/base/common/event';

import { DashboardTab } from 'sql/workbench/contrib/dashboard/browser/core/interfaces';
import { TabConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { WebviewContent } from 'sql/workbench/contrib/dashboard/browser/contents/webviewContent.component';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';

@Component({
	selector: 'dashboard-webview-container',
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardWebviewContainer) }],
	template: `
		<webview-content [webviewId]="tab.id">
		</webview-content>
	`
})
export class DashboardWebviewContainer extends DashboardTab implements AfterContentInit {
	@Input() private tab: TabConfig;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	@ViewChild(WebviewContent) private _webviewContent: WebviewContent;
	constructor() {
		super();
	}

	ngAfterContentInit(): void {
		this._register(this._webviewContent.onResize(() => {
			this._onResize.fire();
		}));
	}

	public layout(): void {
		this._webviewContent.layout();
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
