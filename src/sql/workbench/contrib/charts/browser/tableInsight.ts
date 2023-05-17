/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IInsight } from './interfaces';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { CellSelectionModel } from 'sql/base/browser/ui/table/plugins/cellSelectionModel.plugin';

import { $, Dimension } from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInsightOptions, InsightType } from 'sql/workbench/contrib/charts/common/interfaces';
import { IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';
import { IAccessibilityService } from 'vs/platform/accessibility/common/accessibility';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { ITableService } from 'sql/workbench/services/table/browser/tableService';

export class TableInsight extends Disposable implements IInsight {
	public static readonly types = [InsightType.Table];
	public readonly types = TableInsight.types;

	private table: Table<any>;
	private dataView: TableDataView<any>;
	private columns?: Slick.Column<any>[];
	public options: IInsightOptions = { type: InsightType.Table };

	constructor(container: HTMLElement, options: any,
		@IThemeService themeService: IThemeService,
		@IAccessibilityService accessibilityService: IAccessibilityService,
		@IQuickInputService quickInputService: IQuickInputService,
		@ITableService private tableService: ITableService
	) {
		super();
		let tableContainer = $('div');
		tableContainer.style.width = '100%';
		tableContainer.style.height = '100%';
		container.appendChild(tableContainer);
		this.dataView = new TableDataView();
		this.table = new Table(tableContainer, accessibilityService, quickInputService, { dataProvider: this.dataView }, { showRowNumber: true });
		this.table.setSelectionModel(new CellSelectionModel());
		this._register(attachTableStyler(this.table, themeService));
		this._register(this.tableService.registerTable(this.table));
	}

	set data(data: IInsightData) {
		this.dataView.clear();
		this.dataView.push(transformData(data.rows, data.columns));
		this.columns = transformColumns(data.columns);
		this.table.columns = this.columns;
	}

	layout(dim: Dimension) {
		this.table.layout(dim);
	}
}

function transformData(rows: string[][], columns: string[]): { [key: string]: string }[] {
	return rows.map(row => {
		let object: { [key: string]: string } = {};
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
