/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardGridTab';

import { Component, Inject, Input, forwardRef, ViewChild, ElementRef, ViewChildren, QueryList, OnDestroy, ChangeDetectorRef, EventEmitter, OnChanges } from '@angular/core';
import { NgGridConfig, NgGrid, NgGridItem } from 'angular2-grid';

import { DashboardServiceInterface } from 'sql/parts/dashboard/services/dashboardServiceInterface.service';
import { TabConfig, WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardWidgetWrapper } from 'sql/parts/dashboard/common/dashboardWidgetWrapper.component';
import { subscriptionToDisposable } from 'sql/base/common/lifecycle';
import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';

import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import * as objects from 'vs/base/common/objects';
import Event, { Emitter } from 'vs/base/common/event';
import { concat } from 'rxjs/operator/concat';

export interface GridCellConfig {
	id?: string;
	row?: number;
	col?: number;
	colspan?: number;
	rowspan?: number;
}

export interface GridWidgetConfig extends GridCellConfig, WidgetConfig {
}

export interface GridWebviewConfig extends GridCellConfig {
	webview: {
		id?: string;
	};
}

@Component({
	selector: 'dashboard-grid-tab',
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/tabs/dashboardGridTab.component.html')),
	providers: [{ provide: DashboardTab, useExisting: forwardRef(() => DashboardGridTab) }]
})
export class DashboardGridTab extends DashboardTab implements OnDestroy, OnChanges {
	@Input() private tab: TabConfig;
	private _contents: GridCellConfig[];
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;

	protected SKELETON_WIDTH = 5;

	protected rows: number[];
	protected cols: number[];

	protected getContent(row: number, col: number): GridCellConfig {
		let widget = this._contents.filter(w => w.row === row && w.col === col);
		return widget ? widget[0] : undefined;
	}

	protected getWidgetContent(row: number, col: number): GridWidgetConfig {
		let content = this.getContent(row, col);
		if (content) {
			let widgetConfig = <GridWidgetConfig>content;
			if (widgetConfig && widgetConfig.widget) {
				return widgetConfig;
			}
		}
		return undefined;
	}

	protected getWebviewContent(row: number, col: number): GridWebviewConfig {
		let content = this.getContent(row, col);
		if (content) {
			let webviewConfig = <GridWebviewConfig>content;
			if (webviewConfig && webviewConfig.webview) {
				return webviewConfig;
			}
		}
		return undefined;
	}


	protected isWidget(row: number, col: number): boolean {
		let widgetConfig = this.getWidgetContent(row, col);
		return widgetConfig !== undefined;
	}

	protected isWebview(row: number, col: number): boolean {
		let webview = this.getWebviewContent(row, col);
		return webview !== undefined;
	}

	protected getWebviewId(row: number, col: number): string {
		let widgetConfig = this.getWebviewContent(row, col);
		if (widgetConfig && widgetConfig.webview) {
			return widgetConfig.webview.id;
		}
		return undefined;
	}

	protected getColspan(row: number, col: number): number {
		let content = this.getContent(row, col);
		let colspan: number = 1;
		if (content && content.colspan) {
			colspan = content.colspan;
		}
		return colspan;
	}

	protected getRowspan(row: number, col: number): number {
		let content = this.getContent(row, col);
		if (content && (content.rowspan)) {
			return content.rowspan;
		} else {
			return 1;
		}
	}

	@ViewChildren(DashboardWidgetWrapper) private _widgets: QueryList<DashboardWidgetWrapper>;
	constructor(
		@Inject(forwardRef(() => DashboardServiceInterface)) protected dashboardService: DashboardServiceInterface,
		@Inject(forwardRef(() => ElementRef)) protected _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
	}

	protected init() {
	}

	ngOnChanges() {
		if (this.tab.content) {
			this._contents = Object.values(this.tab.content)[0];
			this._contents.forEach(widget => {
				if (!widget.row) {
					widget.row = 0;
				}
				if (!widget.col) {
					widget.col = 0;
				}
				if (!widget.colspan) {
					widget.colspan = 1;
				}
				if (!widget.rowspan) {
					widget.rowspan = 1;
				}
			});
			this.rows = this.createIndexes(this._contents.map(w => w.row));
			this.cols = this.createIndexes(this._contents.map(w => w.col));

			this._cd.detectChanges();
		}
	}

	private createIndexes(indexes: number[]) {
		let max = Math.max(...indexes) + 1;
		return Array(max).fill(0).map((x, i) => i);
	}

	ngOnDestroy() {
		this.dispose();
	}

	public get id(): string {
		return this.tab.id;
	}

	public get editable(): boolean {
		return this.tab.editable;
	}

	public layout() {
		if (this._widgets) {
			this._widgets.forEach(item => {
				item.layout();
			});
		}
	}

	public refresh(): void {
		if (this._widgets) {
			this._widgets.forEach(item => {
				item.refresh();
			});
		}
	}

	public enableEdit(): void {
	}
}
