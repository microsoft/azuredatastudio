/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

import { ElementRef, Component, Inject, forwardRef, OnDestroy, Input, OnInit } from '@angular/core';
import { Subscription, Subject } from 'rxjs/Rx';

import { PlanXmlParser, PlanNode } from 'sql/parts/queryPlan/planXmlParser';
import { TabChild } from 'sql/base/browser/ui/panel/tab.component';
import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { IQueryComponentParams } from 'sql/services/bootstrap/bootstrapParams';
import * as GridContentEvents from 'sql/parts/grid/common/gridContentEvents';
import { DataService } from 'sql/parts/grid/services/dataService';
import { toDisposableSubscription } from 'sql/base/node/rxjsUtils';

import { localize } from 'vs/nls';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';

export const TOP_OPERATIONS_SELECTOR: string = 'top-operations-component';

@Component({
	selector: TOP_OPERATIONS_SELECTOR,
	template: '',
	providers: [{ provide: TabChild, useExisting: forwardRef(() => TopOperationsComponent) }]
})
export class TopOperationsComponent extends TabChild implements OnDestroy, OnInit {

	private _operations: Array<PlanNode> = [];
	private _table: Table<any>;
	private _dataService: DataService;
	private _columns: Array<Slick.Column<any>> = [
		{ name: localize('topOperations.operation', 'Operation'), field: 'operation' },
		{ name: localize('topOperations.object', 'Object'), field: 'object' },
		{ name: localize('topOperations.estCost', 'Est Cost'), field: 'estCost' },
		{ name: localize('topOperations.estSubtreeCost', 'Est Subtree Cost'), field: 'estSubtreeCost' },
		{ name: localize('topOperations.actualRows', 'Actual Rows'), field: 'actualRows' },
		{ name: localize('topOperations.estRows', 'Est Rows'), field: 'estRows' },
		{ name: localize('topOperations.actualExecutions', 'Actual Executions'), field: 'actualExecutions' },
		{ name: localize('topOperations.estCPUCost', 'Est CPU Cost'), field: 'estCPUCost' },
		{ name: localize('topOperations.estIOCost', 'Est IO Cost'), field: 'estIOCost' },
		{ name: localize('topOperations.parallel', 'Parallel'), field: 'parallel' },
		{ name: localize('topOperations.actualRebinds', 'Actual Rebinds'), field: 'actualRebinds' },
		{ name: localize('topOperations.estRebinds', 'Est Rebinds'), field: 'estRebinds' },
		{ name: localize('topOperations.actualRewinds', 'Actual Rewinds'), field: 'actualRewinds' },
		{ name: localize('topOperations.estRewinds', 'Est Rewinds'), field: 'estRewinds' },
		{ name: localize('topOperations.partitioned', 'Partitioned'), field: 'partitioned' }
	];

	@Input() public queryParameters: IQueryComponentParams;

	private _disposables: Array<IDisposable> = [];

	constructor(
		@Inject(forwardRef(() => ElementRef)) private _el: ElementRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService
	) {
		super();
	}

	ngOnInit() {
		this._dataService = this.queryParameters.dataService;
		this.subscribeWithDispose(this._dataService.gridContentObserver, (type) => {
			switch (type) {
				case GridContentEvents.ResizeContents:
					this.layout();
					break;
			}
		});
	}

	ngOnDestroy() {
		dispose(this._disposables);
	}

	public set planXml(val: string) {
		let parser: PlanXmlParser = new PlanXmlParser(val);
		this._operations = parser.topOperations;
		let data = this._operations.map(i => {
			return {
				operation: i.title,
				object: i.indexObject.title,
				estCost: i.estimatedOperatorCost,
				estSubtreeCost: i.subtreeCost,
				actualRows: i.runtimeInfo.actualRows,
				estRows: i.estimateRows,
				actualExecutions: i.runtimeInfo.actualExecutions,
				estCPUCost: i.estimateCpu,
				estIOCost: i.estimateIo,
				parallel: i.parallel,
				actualRebinds: '',
				estRebinds: i.estimateRebinds,
				actualRewinds: '',
				estRewinds: i.estimateRewinds,
				partitioned: i.partitioned
			};
		});
		if (!this._table) {
			let columns = this._columns.map((column) => {
				column.rerenderOnResize = true;
				return column;
			});
			this._table = new Table(this._el.nativeElement, { dataProvider: data, columns });
			this._disposables.push(attachTableStyler(this._table, this.themeService));
		}
	}

	public layout(): void {
		if (this._table) {
			setTimeout(() => {
				this._table.resizeCanvas();
				this._table.autosizeColumns();
			});
		}
	}

	protected subscribeWithDispose<T>(subject: Subject<T>, event: (value: any) => void): void {
		let sub: Subscription = subject.subscribe(event);
		this.toDispose.push(toDisposableSubscription(sub));
	}
}
