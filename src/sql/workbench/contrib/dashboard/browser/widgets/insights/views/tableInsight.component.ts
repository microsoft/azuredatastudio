/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, Input, Inject, forwardRef, ElementRef, OnInit } from '@angular/core';

import { getContentHeight, getContentWidth, Dimension } from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';

import { Table } from 'sql/base/browser/ui/table/table';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';
import { IInsightsView, IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';

@Component({
	template: ''
})
export default class TableInsight extends Disposable implements IInsightsView, OnInit {
	private table: Table<any>;
	private dataView: TableDataView<any>;
	private columns: Slick.Column<any>[];

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _elementRef: ElementRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
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
			this.table = new Table(this._elementRef.nativeElement, { dataProvider: this.dataView, columns: this.columns }, { showRowNumber: true });
			this.table.setSelectionModel(new CellSelectionModel());
			this._register(attachTableStyler(this.table, this.themeService));
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
