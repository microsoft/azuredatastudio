/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/queryPlan2';
import * as azdata from 'azdata';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';

import { localize } from 'vs/nls';
import { dispose } from 'vs/base/common/lifecycle';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import * as DOM from 'vs/base/browser/dom';
import { PropertiesAction } from 'sql/workbench/contrib/queryplan2/browser/actions/propertiesAction';

export class QueryPlan2Tab implements IPanelTab {
	public readonly title = localize('queryPlanTitle', "Query Plan 2");
	public readonly identifier = 'QueryPlan2Tab';
	public readonly view: QueryPlan2View;

	constructor() {
		this.view = new QueryPlan2View();
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

export class QueryPlan2View implements IPanelView {
	private qps?: QueryPlan2[] = [];
	private graphs?: azdata.QueryPlanGraph[] = [];
	private container = DOM.$('.qp2-container');

	public render(container: HTMLElement): void {
		container.appendChild(this.container);
		this.container.style.overflow = 'scroll';
	}

	dispose() {
		this.container.remove();
		delete this.qps;
		delete this.graphs;
	}

	public layout(dimension: DOM.Dimension): void {
		this.container.style.width = dimension.width + 'px';
		this.container.style.height = dimension.height + 'px';
	}

	public clear() {
		this.qps = [];
		this.graphs = [];
	}

	public addGraphs(newGraphs: azdata.QueryPlanGraph[]) {
		newGraphs.forEach(g => {
			const qp2 = new QueryPlan2(this.container, this.qps.length + 1);
			qp2.graph = g;
			this.qps.push(qp2);
			this.graphs.push(g);
			this.updateRelativeCosts();
		});
	}

	private updateRelativeCosts() {
		const sum = this.graphs.reduce((prevCost: number, cg) => {
			return prevCost += cg.root.subTreeCost + cg.root.cost;
		}, 0);

		this.qps.forEach(qp => {
			qp.relativeCost = ((qp.graph.root.subTreeCost + qp.graph.root.cost) / sum) * 100;
		});
	}
}

export class QueryPlan2 {
	private _graph?: azdata.QueryPlanGraph;
	private _relativeCost?: globalThis.Text;
	private actionBar: ActionBar;
	private _table: Slick.Grid<any>;
	public propContainer: HTMLElement;
	private dataView: Slick.Data.DataView<any>;
	private container: HTMLElement;
	private actionBarContainer: HTMLElement;
	private data: any[];

	constructor(
		parent: HTMLElement,
		private graphIndex: number,

	) {
		this.container = DOM.$('.query-plan2-container');
		parent.appendChild(this.container);


		this.actionBarContainer = DOM.$('.actionbar-container');
		this.actionBar = new ActionBar(this.actionBarContainer, {
			orientation: ActionsOrientation.VERTICAL, context: this
		});

		this.propContainer = DOM.$('.properties-container');
		const propHeader = document.createElement('div');
		propHeader.className = 'properties-header';
		propHeader.innerText = 'Properties';
		this.propContainer.appendChild(propHeader);

		this.propContainer.style.visibility = 'hidden';

		this.dataView = new Slick.Data.DataView({ inlineFilters: false });
		let self = this;
		this.data = [];
		const TaskNameFormatter = function (row, cell, value, columnDef, dataContext) {
			value = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			const spacer = '<span style="display:inline-block;height:1px;width' + (15 * dataContext['indent']) + 'px"></span>';
			const idx = self.dataView.getIdxById(dataContext.id);
			if (self.data[idx + 1] && self.data[idx + 1].indent > self.data[idx].indent) {
				if (dataContext._collapsed) {
					return spacer + '<span class="toggle expand"></span>&nbsp;' + value;
				} else {
					return spacer + '<span class="toggle collapse"></span>&nbsp;' + value;
				}
			} else {
				return spacer + '<span class="toggle"></span>&nbsp;' + value;
			}
		};

		const columns: Slick.Column<any>[] = [
			{
				id: 'name',
				name: 'Name',
				field: 'name',
				width: 250,
				editor: Slick.Editors.Text,
				formatter: TaskNameFormatter,
				headerCssClass: 'prop-table-header'
			},
			{
				id: 'value',
				name: 'Value',
				field: 'propValue',
				width: 250,
				editor: Slick.Editors.Text,
				headerCssClass: 'prop-table-header'
			}
		];

		const options: Slick.GridOptions<any> = {
			editable: false,
			enableAddRow: false,
			enableCellNavigation: true,
			autoHeight: true
		};

		const tableContainer = DOM.$('.table-container');
		tableContainer.style.height = '500px';
		tableContainer.style.width = '490px';
		this.propContainer.appendChild(tableContainer);
		this._table = new Slick.Grid(tableContainer, this.dataView, columns, options);

		this._table.onClick.subscribe((e: any, args) => {

			const item = this.dataView.getItem(args.row);
			if (item) {
				if (!item._collapsed) {
					item._collapsed = true;
				} else {
					item._collapsed = false;
				}

				this.dataView.updateItem(item.id, item);
			}
			e.stopImmediatePropagation();

		});

		this.dataView.setFilter((item) => {
			if (item.parent !== null) {
				let parent = this.data[item.parent];
				while (parent) {
					if (parent._collapsed) {
						return false;
					}

					parent = this.data[parent.parent];
				}
			}
			return true;
		});


		// wire up model events to drive the grid
		this.dataView.onRowCountChanged.subscribe((e, args) => {
			this._table.updateRowCount();
			this._table.render();
		});

		this.dataView.onRowsChanged.subscribe((e, args) => {
			this._table.invalidateRows(args.rows);
			this._table.render();
		});

		const actions = [
			new PropertiesAction()
		];
		this.actionBar.push(actions, { icon: true, label: false });
	}

	public set graph(graph: azdata.QueryPlanGraph | undefined) {
		this._graph = graph;
		if (this._graph) {
			/**
			 * Create a show plan graph here.
			 */
			this.container.appendChild(document.createTextNode(`Query ${this.graphIndex}: `));
			this._relativeCost = document.createTextNode('(relative to the script):');
			this.container.appendChild(this._relativeCost);
			this.container.appendChild(document.createElement('br'));
			this.container.appendChild(document.createTextNode(`${graph.query}`));
			this.container.appendChild(document.createTextNode('Need to add graph control here'));
			this.container.appendChild(document.createElement('br'));
			this.container.appendChild(this.propContainer);
			this.setData(this._graph.root.properties);
			this.container.appendChild(this.actionBarContainer);
		}
	}

	public get graph(): azdata.QueryPlanGraph | undefined {
		return this._graph;
	}

	public set relativeCost(newCost: number) {
		this._relativeCost.nodeValue = `(relative to the script): ${newCost.toFixed(2)}%`;
	}

	public setData(props: azdata.QueryPlanGraphElementProperty[]): void {
		this.data = [];
		props.forEach((p, i) => {
			this.data.push({
				id: p.name,
				name: p.name,
				propValue: p.formattedValue,
				//parent: i % 2 === 0 ? undefined : i - 1,
				//indent: i % 2 === 0 ? 0 : 2,
				_collapsed: true
			});
		});
		this.dataView.beginUpdate();
		this.dataView.setItems(this.data);
		this.dataView.endUpdate();
		this.dataView.refresh();
		this._table.autosizeColumns();
		this._table.updateRowCount();
		this._table.resizeCanvas();
		this._table.render();
	}
}

/**
 * Registering a feature flag for query plan.
 * TODO: This should be removed before taking the feature to public preview.
 */
const QUERYPLAN2_CONFIG_ID = 'queryPlan2';
Registry.as<IConfigurationRegistry>(ConfigExtensions.Configuration).registerConfiguration({
	id: QUERYPLAN2_CONFIG_ID,
	title: localize('queryPlan2.configTitle', "Query Plan 2"),
	type: 'object',
	properties: {
		'queryPlan2.enableFeature': {
			'type': 'boolean',
			'default': false,
			'description': localize('queryPlan2.featureEnabledDescription', "Controls whether the new query plan feature is enabled. Default value is false.")
		}
	}
});


