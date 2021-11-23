/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//import 'vs/css!./media/qp';
import * as azdata from 'azdata';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';

import { Dimension, clearNode } from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { dispose } from 'vs/base/common/lifecycle';
import { IConfigurationRegistry, Extensions as ConfigExtensions } from 'vs/platform/configuration/common/configurationRegistry';
import { Registry } from 'vs/platform/registry/common/platform';

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
	private container = document.createElement('div');

	public render(container: HTMLElement): void {
		container.appendChild(this.container);
		this.container.style.overflow = 'scroll';
	}

	dispose() {
		this.container.remove();
		delete this.qps;
		delete this.graphs;
	}

	public layout(dimension: Dimension): void {
		this.container.style.width = dimension.width + 'px';
		this.container.style.height = dimension.height + 'px';
	}

	public clear() {
		this.qps = [];
		this.graphs = [];
		clearNode(this.container);
	}

	public addGraphs(newGraphs: azdata.QueryPlanGraph[]) {
		newGraphs.forEach(g => {
			const qp2 = new QueryPlan2(this.container, this.qps.length + 1);
			qp2.graph = g;
			this.qps.push(qp2);
			this.graphs.push(g);
		});
	}
}

export class QueryPlan2 {
	private _graph?: azdata.QueryPlanGraph;
	constructor(private container: HTMLElement, private graphIndex: number) {
	}

	public set graph(graph: azdata.QueryPlanGraph | undefined) {
		this._graph = graph;
		if (this._graph) {
			/**
			 * Create a show plan graph here.
			 */
			this.container.appendChild(document.createElement('hr'));
			this.container.appendChild(document.createTextNode(localize("qp2.grpah", 'Query {0}: Query Cost (Relative to the batch): {1}%', this.graphIndex, this.graph.root.relativeCost)));
			this.container.appendChild(document.createElement('br'));
			this.container.appendChild(document.createTextNode(graph.query));
			this.container.appendChild(document.createElement('br'));
			this.container.appendChild(document.createElement('hr'));
			this.container.appendChild(document.createTextNode('Need to add graph control here'));
			this.container.appendChild(document.createElement('br'));
		}
	}

	public get graph(): azdata.QueryPlanGraph | undefined {
		return this._graph;
	}
}

/**
 * Registering a feature flag for query plan. This should be removed before taking the feature to public preview.
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


