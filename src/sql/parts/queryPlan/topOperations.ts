/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';

import { Dimension } from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { dispose } from 'vs/base/common/lifecycle';
import { Table } from 'sql/base/browser/ui/table/table';
import { PlanXmlParser } from 'sql/parts/queryPlan/planXmlParser';

const topOperationColumns: Array<Slick.Column<any>> = [
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

export class TopOperationsState {
	xml: string;
	dispose() {

	}
}

export class TopOperationsTab implements IPanelTab {
	public readonly title = localize('topOperationsTitle', 'Top Operation');
	public readonly identifier = 'TopOperationsTab';
	public readonly view: TopOperationsView;

	constructor() {
		this.view = new TopOperationsView();
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

export class TopOperationsView implements IPanelView {
	private xml: string;
	private _state: TopOperationsState;
	private table: Table<any>;

	public render(container: HTMLElement): void {
		this.table = new Table(container, { columns: topOperationColumns });
	}

	dispose() {
		this.table.dispose();
	}

	public layout(dimension: Dimension): void {
		this.table.layout(dimension);
	}

	public clear() {
	}

	public showPlan(xml: string) {
		this.xml = xml;
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
