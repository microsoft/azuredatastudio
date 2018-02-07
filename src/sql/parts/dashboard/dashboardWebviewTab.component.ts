/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import { Component, forwardRef, Input } from '@angular/core';

import Event, { Emitter } from 'vs/base/common/event';

import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { TabConfig } from 'sql/parts/dashboard/common/dashboardWidget';

@Component({
	template: '',
	selector: 'dashboard-webview-widget',
	providers: [{ provide: DashboardTab, useExisting: forwardRef(() => DashboardWebviewWidget) }]
})
export class DashboardWebviewWidget extends DashboardTab {
	@Input() private tab: TabConfig;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	public layout(): void {
		// no op
	}

	public id: string;

	public editable: boolean;

	public refresh(): void {
		// no op
	}
}
