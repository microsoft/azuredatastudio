/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, forwardRef, Input, AfterContentInit, ViewChild } from '@angular/core';

import { Event, Emitter } from 'vs/base/common/event';

import { DashboardTab } from 'sql/workbench/contrib/dashboard/browser/core/interfaces';
import { TabConfig } from 'sql/workbench/contrib/dashboard/browser/core/dashboardWidget';
import { ModelViewContent } from 'sql/workbench/browser/modelComponents/modelViewContent.component';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';

@Component({
	selector: 'dashboard-modelview-container',
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardModelViewContainer) }],
	template: `
		<modelview-content [modelViewId]="tab.id">
		</modelview-content>
	`
})
export class DashboardModelViewContainer extends DashboardTab implements AfterContentInit {
	@Input() private tab: TabConfig;

	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	@ViewChild(ModelViewContent) private _modelViewContent: ModelViewContent;
	constructor() {
		super();
	}

	ngAfterContentInit(): void {
		this._register(this._modelViewContent.onResize(() => {
			this._onResize.fire();
		}));
	}

	public layout(): void {
		this._modelViewContent.layout();
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
