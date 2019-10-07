/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Dimension } from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { Disposable } from 'vs/base/common/lifecycle';

import { Table } from 'sql/base/browser/ui/table/table';
import { PlanXmlParser } from 'sql/workbench/parts/queryPlan/common/planXmlParser';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { TopOperationsState } from 'sql/workbench/parts/queryPlan/common/topOperationsState';

const topOperationColumns: Array<Slick.Column<any>> = [
	{ name: localize('topOperations.operation', "Operation"), field: 'operation', sortable: true },
	{ name: localize('topOperations.object', "Object"), field: 'object', sortable: true },
	{ name: localize('topOperations.estCost', "Est Cost"), field: 'estCost', sortable: true },
	{ name: localize('topOperations.estSubtreeCost', "Est Subtree Cost"), field: 'estSubtreeCost', sortable: true },
	{ name: localize('topOperations.actualRows', "Actual Rows"), field: 'actualRows', sortable: true },
	{ name: localize('topOperations.estRows', "Est Rows"), field: 'estRows', sortable: true },
	{ name: localize('topOperations.actualExecutions', "Actual Executions"), field: 'actualExecutions', sortable: true },
	{ name: localize('topOperations.estCPUCost', "Est CPU Cost"), field: 'estCPUCost', sortable: true },
	{ name: localize('topOperations.estIOCost', "Est IO Cost"), field: 'estIOCost', sortable: true },
	{ name: localize('topOperations.parallel', "Parallel"), field: 'parallel', sortable: true },
	{ name: localize('topOperations.actualRebinds', "Actual Rebinds"), field: 'actualRebinds', sortable: true },
	{ name: localize('topOperations.estRebinds', "Est Rebinds"), field: 'estRebinds', sortable: true },
	{ name: localize('topOperations.actualRewinds', "Actual Rewinds"), field: 'actualRewinds', sortable: true },
	{ name: localize('topOperations.estRewinds', "Est Rewinds"), field: 'estRewinds', sortable: true },
	{ name: localize('topOperations.partitioned', "Partitioned"), field: 'partitioned', sortable: true }
];

export class TopOperationsTab extends Disposable implements IPanelTab {
	public readonly title = localize('topOperationsTitle', "Top Operations");
	public readonly identifier = 'TopOperationsTab';
	public readonly view: TopOperationsView;

	constructor(@IInstantiationService instantiationService: IInstantiationService) {
		super();
		this.view = this._register(instantiationService.createInstance(TopOperationsView));
	}

	public clear() {
		this.view.clear();
	}
}

export class TopOperationsView extends Disposable implements IPanelView {
	private _state: TopOperationsState;
	private table: Table<any>;
	private container = document.createElement('div');
	private dataView = new TableDataView();

	constructor(@IThemeService private themeService: IThemeService) {
		super();
		this.table = new Table(this.container, {
			columns: topOperationColumns,
			dataProvider: this.dataView,
			sorter: (args) => {
				this.dataView.sort(args);
			}
		});
		this._register(this.table);
		this._register(attachTableStyler(this.table, this.themeService));
	}

	public render(container: HTMLElement): void {
		container.appendChild(this.container);
	}

	public layout(dimension: Dimension): void {
		this.table.layout(dimension);
	}

	public focus(): void {
		this.table.focus();
	}

	public clear() {
		this.dataView.clear();
	}

	public showPlan(xml: string) {
		this.state.xml = xml;
		this.dataView.clear();
		let parser = new PlanXmlParser(xml);
		let operations = parser.topOperations;
		let data = operations.map(i => {
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
		this.dataView.push(data);
	}

	public set state(val: TopOperationsState) {
		this._state = val;
		if (this.state.xml) {
			this.showPlan(this.state.xml);
		}
	}

	public get state(): TopOperationsState {
		return this._state;
	}
}
