/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardControlHostContainer';

import { Component, forwardRef, Input, AfterContentInit, ViewChild } from '@angular/core';

import { Event, Emitter } from 'vs/base/common/event';

import { DashboardTab } from 'sql/workbench/contrib/dashboard/browser/core/interfaces';
import { TabConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { ControlHostContent } from 'sql/workbench/contrib/dashboard/browser/contents/controlHostContent.component';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';

@Component({
	selector: 'dashboard-controlhost-container',
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardControlHostContainer) }],
	template: `
		<controlhost-content [webviewId]="tab.id">
		</controlhost-content>
	`
})

export class DashboardControlHostContainer extends DashboardTab implements AfterContentInit {
	@Input() private tab: TabConfig;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	@ViewChild(ControlHostContent) private _hostContent: ControlHostContent;
	constructor() {
		super();
	}

	ngAfterContentInit(): void {
		this._register(this._hostContent.onResize(() => {
			this._onResize.fire();
		}));

		const container = <any>this.tab.container;
		if (container['controlhost-container'] && container['controlhost-container'].type) {
			this._hostContent.setControlType(container['controlhost-container'].type);
		}
	}

	public layout(): void {
		this._hostContent.layout();
	}

	public get id(): string {
		return this.tab.id;
	}

	public get editable(): boolean {
		return this.tab.editable;
	}

	public refresh(): void {
		this._hostContent.refresh();
	}
}
