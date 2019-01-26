/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./dashboardGridContainer';

import { Component, Inject, Input, forwardRef, ElementRef, ViewChildren, QueryList, OnDestroy, ChangeDetectorRef } from '@angular/core';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { TabConfig, WidgetConfig } from 'sql/parts/dashboard/common/dashboardWidget';
import { DashboardWidgetWrapper } from 'sql/parts/dashboard/contents/dashboardWidgetWrapper.component';
import { DashboardTab } from 'sql/parts/dashboard/common/interfaces';
import { WebviewContent } from 'sql/parts/dashboard/contents/webviewContent.component';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';

import { Event, Emitter } from 'vs/base/common/event';

export interface GridCellConfig {
	id?: string;
	row?: number;
	col?: number;
	colspan?: string | number;
	rowspan?: string | number;
}

export interface GridWidgetConfig extends GridCellConfig, WidgetConfig {
}

export interface GridWebviewConfig extends GridCellConfig {
	webview: {
		id?: string;
	};
}

@Component({
	selector: 'dashboard-grid-container',
	templateUrl: decodeURI(require.toUrl('sql/parts/dashboard/containers/dashboardGridContainer.component.html')),
	providers: [{ provide: TabChild, useExisting: forwardRef(() => DashboardGridContainer) }]
})
export class DashboardGridContainer extends DashboardTab implements OnDestroy {
	@Input() private tab: TabConfig;
	private _contents: GridCellConfig[];
	private _onResize = new Emitter<void>();
	public readonly onResize: Event<void> = this._onResize.event;
	private cellWidth: number = 270;
	private cellHeight: number = 270;

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

	protected getColspan(row: number, col: number): string {
		let content = this.getContent(row, col);
		let colspan: string = '1';
		if (content && content.colspan) {
			colspan = this.convertToNumber(content.colspan, this.cols.length).toString();
		}
		return colspan;
	}

	protected getRowspan(row: number, col: number): string {
		let content = this.getContent(row, col);
		if (content && (content.rowspan)) {
			return this.convertToNumber(content.rowspan, this.rows.length).toString();
		} else {
			return '1';
		}
	}

	protected getWidgetWidth(row: number, col: number): string {
		let content = this.getContent(row, col);
		let colspan = this.getColspan(row, col);
		let columnCount = this.convertToNumber(colspan, this.cols.length);

		return columnCount * this.cellWidth + 'px';
	}

	protected getWidgetHeight(row: number, col: number): string {
		let content = this.getContent(row, col);
		let rowspan = this.getRowspan(row, col);
		let rowCount = this.convertToNumber(rowspan, this.rows.length);

		return rowCount * this.cellHeight + 'px';
	}

	private convertToNumber(value: string | number, maxNumber: number): number {
		if (!value) {
			return 1;
		}
		if (value === '*') {
			return maxNumber;
		}
		try {
			return +value;
		} catch {
			return 1;
		}
	}

	@ViewChildren(DashboardWidgetWrapper) private _widgets: QueryList<DashboardWidgetWrapper>;
	@ViewChildren(WebviewContent) private _webViews: QueryList<WebviewContent>;
	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) protected dashboardService: CommonServiceInterface,
		@Inject(forwardRef(() => ElementRef)) protected _el: ElementRef,
		@Inject(forwardRef(() => ChangeDetectorRef)) protected _cd: ChangeDetectorRef
	) {
		super();
	}

	protected init() {
	}

	ngOnInit() {
		if (this.tab.container) {
			this._contents = Object.values(this.tab.container)[0];
			this._contents.forEach(widget => {
				if (!widget.row) {
					widget.row = 0;
				}
				if (!widget.col) {
					widget.col = 0;
				}
				if (!widget.colspan) {
					widget.colspan = '1';
				}
				if (!widget.rowspan) {
					widget.rowspan = '1';
				}
			});
			this.rows = this.createIndexes(this._contents.map(w => w.row));
			this.cols = this.createIndexes(this._contents.map(w => w.col));
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
		if (this._webViews) {
			this._webViews.forEach(item => {
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
