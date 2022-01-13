/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/queryPlan2';
import type * as azdata from 'azdata';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { dispose } from 'vs/base/common/lifecycle';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import { ActionBar, ActionsOrientation } from 'vs/base/browser/ui/actionbar/actionbar';
import * as DOM from 'vs/base/browser/dom';
import { PropertiesAction } from 'sql/workbench/contrib/queryplan2/browser/actions/propertiesAction';
import * as azdataGraphModule from 'azdataGraph';
import { escape } from 'sql/base/common/strings';
let azdataGraph = azdataGraphModule();

export class QueryPlan2Tab implements IPanelTab {
	public readonly title = localize('queryPlanTitle', "Query Plan");
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
	private _qps?: QueryPlan2[] = [];
	private _graphs?: azdata.QueryPlanGraph[] = [];
	private _container = DOM.$('.qp-container');

	public render(container: HTMLElement): void {
		container.appendChild(this._container);
		this._container.style.overflow = 'scroll';
	}

	dispose() {
		this._container.remove();
		delete this._qps;
		delete this._graphs;
	}

	public layout(dimension: DOM.Dimension): void {
		this._container.style.width = dimension.width + 'px';
		this._container.style.height = dimension.height + 'px';
	}

	public clear() {
		this._qps = [];
		this._graphs = [];
		DOM.clearNode(this._container);
	}

	public addGraphs(newGraphs: azdata.QueryPlanGraph[]) {
		newGraphs.forEach(g => {
			const qp2 = new QueryPlan2(this._container, this._qps.length + 1);
			qp2.graph = g;
			this._qps.push(qp2);
			this._graphs.push(g);
			this.updateRelativeCosts();
		});
	}

	private updateRelativeCosts() {
		const sum = this._graphs.reduce((prevCost: number, cg) => {
			return prevCost += cg.root.subTreeCost + cg.root.cost;
		}, 0);

		if (sum > 0) {
			this._qps.forEach(qp => {
				qp.relativeCost = ((qp.graph.root.subTreeCost + qp.graph.root.cost) / sum) * 100;
			});
		}
	}
}

export class QueryPlan2 {
	private _graph?: azdata.QueryPlanGraph;
	private _relativeCost?: globalThis.Text;
	private _actionBar: ActionBar;
	private _table: Slick.Grid<any>;
	private _dataView: Slick.Data.DataView<any>;
	private _container: HTMLElement;
	private _actionBarContainer: HTMLElement;
	private _data: any[];
	private _iconMap: any = new Object();
	private _iconPaths: any = new Object();

	public propContainer: HTMLElement;

	constructor(
		parent: HTMLElement,
		private _graphIndex: number,

	) {
		this._container = DOM.$('.query-plan');
		parent.appendChild(this._container);


		this._actionBarContainer = DOM.$('.actionbar-container');
		this._actionBar = new ActionBar(this._actionBarContainer, {
			orientation: ActionsOrientation.VERTICAL, context: this
		});

		this.propContainer = DOM.$('.properties-container');
		const propHeader = document.createElement('div');
		propHeader.className = 'properties-header';
		propHeader.innerText = 'Properties';
		this.propContainer.appendChild(propHeader);

		this.propContainer.style.visibility = 'hidden';

		this._dataView = new Slick.Data.DataView({ inlineFilters: false });
		let self = this;
		this._data = [];
		const TaskNameFormatter = function (row, cell, value, columnDef, dataContext) {
			value = escape(value);
			const spacer = '<span style="display:inline-block;height:1px;width' + (15 * dataContext['indent']) + 'px"></span>';
			const idx = self._dataView.getIdxById(dataContext.id);
			if (self._data[idx + 1] && self._data[idx + 1].indent > self._data[idx].indent) {
				if (dataContext._collapsed) {
					return spacer + '<span class="properties-toggle expand"></span>&nbsp;' + value;
				} else {
					return spacer + '<span class="properties-toggle collapse"></span>&nbsp;' + value;
				}
			} else {
				return spacer + '<span class="properties-toggle"></span>&nbsp;' + value;
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
		this._table = new Slick.Grid(tableContainer, this._dataView, columns, options);

		this._table.onClick.subscribe((e: any, args) => {

			const item = this._dataView.getItem(args.row);
			if (item) {
				item._collapsed = !item._collapsed;
				this._dataView.updateItem(item.id, item);
			}
			e.stopImmediatePropagation();
		});

		this._dataView.setFilter((item) => {
			if (item.parent !== null) {
				let parent = this._data[item.parent];
				while (parent) {
					if (parent._collapsed) {
						return false;
					}

					parent = this._data[parent.parent];
				}
			}
			return true;
		});


		// wire up model events to drive the grid
		this._dataView.onRowCountChanged.subscribe((e, args) => {
			this._table.updateRowCount();
			this._table.render();
		});

		this._dataView.onRowsChanged.subscribe((e, args) => {
			this._table.invalidateRows(args.rows);
			this._table.render();
		});

		const actions = [
			new PropertiesAction()
		];
		this._actionBar.push(actions, { icon: true, label: false });

		this._iconMap['Adaptive_Join_32x.ico'] = 'adaptiveJoin';
		this._iconMap['Assert_32x.ico'] = 'assert';
		this._iconMap['Bitmap_32x.ico'] = 'bitmap';
		this._iconMap['Clustered_index_delete_32x.ico'] = 'clusteredIndexDelete';
		this._iconMap['Clustered_index_insert_32x.ico'] = 'ClusteredIndexInsert';
		this._iconMap['Clustered_index_scan_32x.ico'] = 'ClusteredIndexScan';
		this._iconMap['Clustered_index_seek_32x.ico'] = 'ClusteredIndexSeek';
		this._iconMap['Clustered_index_update_32x.ico'] = 'ClusteredIndexUpdate';
		this._iconMap['Clustered_index_merge_32x.icoo'] = 'ClusteredIndexMerge';


		this._iconMap['Filter_32x.ico'] = 'filter';
		this._iconMap['Clustered_index_scan_32x.ico'] = 'clusteredIndexScan';
		this._iconMap['Clustered_index_seek_32x.ico'] = 'clusteredIndexSeek';
		this._iconMap['Compute_scalar_32x.ico'] = 'computeScalar';
		this._iconMap['Concatenation_32x.ico'] = 'concatenation';

		this._iconMap['Concatenation_32x.ico'] = 'concatenation';

		this._iconMap['Nested_loops_32x.ico'] = 'nestedLoops';
		this._iconMap['Result_32x.ico'] = 'result';
		this._iconMap['Table_spool_32x.ico'] = 'tableSpool';
		this._iconMap['Top_32x.ico'] = 'top';
		let imageBasePath = URI.parse(decodeURI(require.toUrl('./images/icons/'))).fsPath;
		this._iconPaths =
		{
			// generic icons
			iteratorCatchAll: imageBasePath + 'iterator_catch_all.png',

			cursorCatchAll: imageBasePath + 'cursor_catch_all.png',

			languageConstructCatchAll: imageBasePath + 'language_construct_catch_all.png',

			// operator icons
			adaptiveJoin: imageBasePath + 'adaptive_join.png',

			assert: imageBasePath + 'assert.png',

			bitmap: imageBasePath + 'bitmap.png',

			clusteredIndexDelete: imageBasePath + 'clustered_index_delete.png',

			clusteredIndexInsert: imageBasePath + 'clustered_index_insert.png',

			clusteredIndexScan: imageBasePath + 'clustered_index_scan.png',

			clusteredIndexSeek: imageBasePath + 'clustered_index_seek.png',

			clusteredIndexUpdate: imageBasePath + 'clustered_index_update.png',

			clusteredIndexMerge: imageBasePath + 'clustered_index_merge.png',

			clusteredUpdate: imageBasePath + 'clustered_update.png',

			collapse: imageBasePath + 'collapse.png',

			computeScalar: imageBasePath + 'compute_scalar.png',

			concatenation: imageBasePath + 'concatenation.png',

			constantScan: imageBasePath + 'constant_scan.png',

			deletedScan: imageBasePath + 'deleted_scan.png',

			filter: imageBasePath + 'filter.png',

			hashMatch: imageBasePath + 'hash_match.png',

			indexDelete: imageBasePath + 'index_delete.png',

			indexInsert: imageBasePath + 'index_insert.png',

			indexScan: imageBasePath + 'index_scan.png',

			columnstoreIndexDelete: imageBasePath + 'columnstore_index_delete.png',

			columnstoreIndexInsert: imageBasePath + 'columnstore_index_insert.png',

			columnstoreIndexMerge: imageBasePath + 'columnstore_index_merge.png',

			columnstoreIndexScan: imageBasePath + 'columnstore_index_scan.png',

			columnstoreIndexUpdate: imageBasePath + 'columnstore_index_update.png',

			indexSeek: imageBasePath + 'index_seek.png',

			indexSpool: imageBasePath + 'index_spool.png',

			indexUpdate: imageBasePath + 'index_update.png',

			insertedScan: imageBasePath + 'inserted_scan.png',

			logRowScan: imageBasePath + 'log_row_scan.png',

			mergeInterval: imageBasePath + 'merge_interval.png',

			mergeJoin: imageBasePath + 'merge_join.png',

			nestedLoops: imageBasePath + 'nested_loops.png',

			parallelism: imageBasePath + 'parallelism.png',

			parameterTableScan: imageBasePath + 'parameter_table_scan.png',

			print: imageBasePath + 'print.png',

			rank: imageBasePath + 'rank.png',

			foreignKeyReferencesCheck: imageBasePath + 'foreign_key_references_check.png',

			remoteDelete: imageBasePath + 'remote_delete.png',

			remoteIndexScan: imageBasePath + 'remote_index_scan.png',

			remoteIndexSeek: imageBasePath + 'remote_index_seek.png',

			remoteInsert: imageBasePath + 'remote_insert.png',

			remoteQuery: imageBasePath + 'remote_query.png',

			remoteScan: imageBasePath + 'remote_scan.png',

			remoteUpdate: imageBasePath + 'remote_update.png',

			ridLookup: imageBasePath + 'rid_lookup.png',

			rowCountSpool: imageBasePath + 'row_count_spool.png',

			segment: imageBasePath + 'segment.png',

			sequence: imageBasePath + 'sequence.png',

			sequenceProject: imageBasePath + 'sequence_project.png',

			sort: imageBasePath + 'sort.png',

			split: imageBasePath + 'split.png',

			streamAggregate: imageBasePath + 'stream_aggregate.png',

			switchStatement: imageBasePath + 'switch.png',

			tableValuedFunction: imageBasePath + 'table_valued_function.png',

			tableDelete: imageBasePath + 'table_delete.png',

			tableInsert: imageBasePath + 'table_insert.png',

			tableScan: imageBasePath + 'table_scan.png',

			tableSpool: imageBasePath + 'table_spool.png',

			tableUpdate: imageBasePath + 'table_update.png',

			tableMerge: imageBasePath + 'table_merge.png',

			tfp: imageBasePath + 'predict.png',

			top: imageBasePath + 'top.png',

			udx: imageBasePath + 'udx.png',

			batchHashTableBuild: imageBasePath + 'batch_hash_table_build.png',

			windowSpool: imageBasePath + 'table_spool.png',

			windowAggregate: imageBasePath + 'window_aggregate.png',

			// cursor operators
			fetchQuery: imageBasePath + 'fetch_query.png',

			populateQuery: imageBasePath + 'population_query.png',

			refreshQuery: imageBasePath + 'refresh_query.png',

			// shiloh operators
			result: imageBasePath + 'result.png',

			aggregate: imageBasePath + 'aggregate.png',

			assign: imageBasePath + 'assign.png',

			arithmeticExpression: imageBasePath + 'arithmetic_expression.png',

			bookmarkLookup: imageBasePath + 'bookmark_lookup.png',

			convert: imageBasePath + 'convert.png',

			declare: imageBasePath + 'declare.png',

			deleteOperator: imageBasePath + 'delete.png',

			dynamic: imageBasePath + 'dynamic.png',

			hashMatchRoot: imageBasePath + 'hash_match_root.png',

			hashMatchTeam: imageBasePath + 'hash_match_team.png',

			ifOperator: imageBasePath + 'if.png',

			insert: imageBasePath + 'insert.png',

			intrinsic: imageBasePath + 'intrinsic.png',

			keyset: imageBasePath + 'keyset.png',

			locate: imageBasePath + 'locate.png',

			populationQuery: imageBasePath + 'population_query.png',

			setFunction: imageBasePath + 'set_function.png',

			snapshot: imageBasePath + 'snapshot.png',

			spool: imageBasePath + 'spool.png',

			tsql: imageBasePath + 'sql.png',

			update: imageBasePath + 'update.png',

			// fake operators
			keyLookup: imageBasePath + 'bookmark_lookup.png',

			// PDW operators
			apply: imageBasePath + 'apply.png',

			broadcast: imageBasePath + 'broadcast.png',

			computeToControlNode: imageBasePath + 'compute_to_control_node.png',

			constTableGet: imageBasePath + 'const_table_get.png',

			controlToComputeNodes: imageBasePath + 'control_to_compute_nodes.png',

			externalBroadcast: imageBasePath + 'external_broadcast.png',

			externalExport: imageBasePath + 'external_export.png',

			externalLocalStreaming: imageBasePath + 'external_local_streaming.png',

			externalRoundRobin: imageBasePath + 'external_round_robin.png',

			externalShuffle: imageBasePath + 'external_shuffle.png',

			get: imageBasePath + 'get.png',

			groupByApply: imageBasePath + 'apply.png',

			groupByAggregate: imageBasePath + 'group_by_aggregate.png',

			join: imageBasePath + 'join.png',

			localCube: imageBasePath + 'intrinsic.png',

			project: imageBasePath + 'project.png',

			shuffle: imageBasePath + 'shuffle.png',

			singleSourceRoundRobin: imageBasePath + 'single_source_round_robin.png',

			singleSourceShuffle: imageBasePath + 'single_source_shuffle.png',

			trim: imageBasePath + 'trim.png',

			union: imageBasePath + 'union.png',

			unionAll: imageBasePath + 'union_all.png'
		};
	}

	private populate(node: azdata.QueryPlanGraphNode, diagramNode: any): any {

		diagramNode.label = node.name;
		if (node.properties && node.properties.length > 0) {
			diagramNode.metrics = node.properties.map(e => { return { name: e.name, value: e.formattedValue.substring(0, 75) }; });
		}

		let icon = this._iconMap[node.type];
		if (icon) {
			diagramNode.icon = icon;
		}

		if (node.children) {
			diagramNode.children = [];
			for (let i = 0; i < node.children.length; ++i) {
				diagramNode.children.push(this.populate(node.children[i], new Object()));
			}
		}
		return diagramNode;
	}

	private createPlanDiagram(container: HTMLDivElement): void {
		let diagramRoot: any = new Object();
		let graphRoot: azdata.QueryPlanGraphNode = this._graph.root;
		this.populate(graphRoot, diagramRoot);

		new azdataGraph.azdataQueryPlan(container, diagramRoot, this._iconPaths);
	}


	public set graph(graph: azdata.QueryPlanGraph | undefined) {
		this._graph = graph;
		if (this._graph) {
			this._container.appendChild(document.createTextNode(localize('queryIndex', "Query {0}: ", this._graphIndex)));
			this._relativeCost = document.createTextNode(localize('relativeToTheScript', "(relative to the script):"));
			this._container.appendChild(this._relativeCost);
			this._container.appendChild(document.createElement('br'));
			this._container.appendChild(document.createTextNode(`${graph.query}`));
			let diagramContainer = document.createElement('div');
			this.createPlanDiagram(diagramContainer);
			this._container.appendChild(diagramContainer);

			this._container.appendChild(this.propContainer);
			this.setData(this._graph.root.properties);
			this._container.appendChild(this._actionBarContainer);
		}
	}

	public get graph(): azdata.QueryPlanGraph | undefined {
		return this._graph;
	}

	public set relativeCost(newCost: number) {
		this._relativeCost.nodeValue = localize('relativeToTheScriptWithCost', "(relative to the script): {0}%", newCost.toFixed(2));
	}

	public setData(props: azdata.QueryPlanGraphElementProperty[]): void {
		this._data = [];
		props.forEach((p, i) => {
			this._data.push({
				id: p.name,
				name: p.name,
				propValue: p.formattedValue,
				_collapsed: true
			});
		});
		this._dataView.beginUpdate();
		this._dataView.setItems(this._data);
		this._dataView.endUpdate();
		this._dataView.refresh();
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
	title: localize('queryPlan2.configTitle', "Query Plan"),
	type: 'object',
	properties: {
		'queryPlan2.enableFeature': {
			'type': 'boolean',
			'default': false,
			'description': localize('queryPlan2.featureEnabledDescription', "Controls whether the new query plan feature is enabled. Default value is false.")
		}
	}
});


