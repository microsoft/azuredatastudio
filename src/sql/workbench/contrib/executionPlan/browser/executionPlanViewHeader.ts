/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdata from 'azdata';
import * as DOM from 'vs/base/browser/dom';
import { localize } from 'vs/nls';
import { openNewQuery } from 'sql/workbench/contrib/query/browser/queryActions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { Button } from 'sql/base/browser/ui/button/button';
import { removeLineBreaks } from 'sql/base/common/strings';
import { Disposable } from 'vs/base/common/lifecycle';

export class ExecutionPlanViewHeader extends Disposable {

	private _graphIndex: number;    // Index of the graph in the view
	private _relativeCost: number;  // Relative cost of the graph to the script
	private _graphIndexAndCostContainer: HTMLElement; //Container that holds the graph index and relative cost


	private _query: string;
	private _queryContainer: HTMLElement; // container that holds query text

	private _recommendations: azdata.executionPlan.ExecutionPlanRecommendations[];
	private _recommendationsContainer: HTMLElement; // container that holds graph recommendations

	public constructor(
		private _parentContainer: HTMLElement,
		headerData: PlanHeaderData | undefined,
		@IInstantiationService public readonly _instantiationService: IInstantiationService
	) {
		super();

		if (headerData) {
			this._graphIndex = headerData.planIndex;
			this._relativeCost = headerData.relativeCost;
			this._query = headerData.query;
			this._recommendations = headerData.recommendations ?? [];
		}

		this._graphIndexAndCostContainer = DOM.$('.index-row');
		this._queryContainer = DOM.$('.query-row');
		this._recommendationsContainer = DOM.$('.recommendations');

		this._parentContainer.appendChild(this._graphIndexAndCostContainer);
		this._parentContainer.appendChild(this._queryContainer);
		this._parentContainer.appendChild(this._recommendationsContainer);

		this.renderGraphIndexAndCost();
		this.renderQueryText();
		this.renderRecommendations();
	}

	public set graphIndex(index: number) {
		this._graphIndex = index;
		this.renderGraphIndexAndCost();
	}
	public set relativeCost(cost: number) {
		this._relativeCost = cost;
		this.renderGraphIndexAndCost();
	}
	public set query(query: string) {
		this._query = removeLineBreaks(query, ' ');
		this.renderQueryText();
	}

	public set recommendations(recommendations: azdata.executionPlan.ExecutionPlanRecommendations[]) {
		recommendations.forEach(r => {
			r.displayString = removeLineBreaks(r.displayString);
		});

		this._recommendations = recommendations;
		this.renderRecommendations();
	}

	private renderGraphIndexAndCost(): void {
		if (this._graphIndex && this._relativeCost) {
			this._graphIndexAndCostContainer.innerText = localize(
				{
					key: 'planHeaderIndexAndCost',
					comment: [
						'{0} is the index of the graph in the execution plan tab',
						'{1} is the relative cost in percentage of the graph to the rest of the graphs in execution plan tab '
					]
				},
				"Query {0}: Query cost (relative to the script): {1}%", this._graphIndex, this._relativeCost.toFixed(2));
		}
	}

	private renderQueryText(): void {
		if (this._query) {
			this._queryContainer.innerText = this._query;
			this._queryContainer.title = this._query;
		}
	}

	private renderRecommendations(): void {
		if (this._recommendations) {
			while (this._recommendationsContainer.firstChild) {
				this._recommendationsContainer.removeChild(this._recommendationsContainer.firstChild);
			}

			this._recommendations.forEach(r => {
				const link = this._register(new Button(this._recommendationsContainer, {
					title: r.displayString,
					secondary: true,
				}));

				link.label = r.displayString;

				//Enabling on click action for recommendations. It will open the recommendation File
				this._register(link.onDidClick(e => {
					this._instantiationService.invokeFunction(openNewQuery, undefined, r.queryWithDescription, RunQueryOnConnectionMode.none);
				}));
			});
		}
	}
}

export interface PlanHeaderData {
	planIndex?: number;
	relativeCost?: number;
	query?: string;
	recommendations?: azdata.executionPlan.ExecutionPlanRecommendations[];
}
