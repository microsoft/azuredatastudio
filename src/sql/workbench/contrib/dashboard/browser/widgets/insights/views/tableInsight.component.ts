/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Input, Inject, forwardRef, ElementRef, OnInit } from '@angular/core';

import { getContentHeight, getContentWidth, Dimension } from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { Table } from 'sql/base/browser/ui/table/table';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { IInsightsView, IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { IComponentContextService } from 'sql/workbench/services/componentContext/browser/componentContextService';
import { defaultTableStyles } from 'sql/platform/theme/browser/defaultStyles';

@Component({
	template: ''
})
export default class TableInsight extends Disposable implements IInsightsView, OnInit {
	private table: Table<any>;
	private dataView: TableDataView<any>;
	private columns: Slick.Column<any>[];

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _elementRef: ElementRef,
		@Inject(IAccessibilityService) private accessibilityService: IAccessibilityService,
		@Inject(IQuickInputService) private quickInputService: IQuickInputService,
		@Inject(IComponentContextService) private componentContextService: IComponentContextService
	) {
		super();
	}

	ngOnInit() {
		this.createTable();
	}

	@Input() set data(data: IInsightData) {
		if (!this.dataView) {
			this.dataView = new TableDataView();
			if (this.table) {
				this.table.setData(this.dataView);
			}
		}

		this.dataView.clear();
		this.dataView.push(transformData(data.rows, data.columns));
		this.columns = transformColumns(data.columns);

		if (this.table) {
			this.table.columns = this.columns;
		} else if (this._elementRef && this._elementRef.nativeElement) {
			this.createTable();
		}
	}

	layout() {
		if (this.table) {
			this.table.layout(new Dimension(getContentWidth(this._elementRef.nativeElement), getContentHeight(this._elementRef.nativeElement)));
		}
	}

	private createTable() {
		if (!this.table) {
			this.table = new Table(this._elementRef.nativeElement, this.accessibilityService, this.quickInputService, defaultTableStyles, { dataProvider: this.dataView, columns: this.columns }, { showRowNumber: true });
			this.table.setSelectionModel(new CellSelectionModel());
			this._register(this.componentContextService.registerTable(this.table));
		}
	}
}

function transformData(rows: string[][], columns: string[]): { [key: string]: string }[] {
	return rows.map(row => {
		const object: { [key: string]: string } = {};
		row.forEach((val, index) => {
			object[columns[index]] = val;
		});
		return object;
	});
}

function transformColumns(columns: string[]): Slick.Column<any>[] {
	return columns.map(col => {
		return <Slick.Column<any>>{
			name: col,
			id: col,
			field: col
		};
	});
}
