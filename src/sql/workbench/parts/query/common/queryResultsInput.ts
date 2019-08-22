/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor';

import { TopOperationsState } from 'sql/workbench/parts/queryPlan/common/topOperationsState';
import { ChartState } from 'sql/workbench/parts/charts/common/interfaces';
import { QueryPlanState } from 'sql/workbench/parts/queryPlan/common/queryPlanState';
import { MessagePanelState } from 'sql/workbench/parts/query/common/messagePanelState';
import { GridPanelState } from 'sql/workbench/parts/query/common/gridPanelState';
import { QueryModelViewState } from 'sql/workbench/parts/query/common/modelViewTab/modelViewState';

export class ResultsViewState {
	public readonly gridPanelState: GridPanelState = new GridPanelState();
	public readonly messagePanelState: MessagePanelState = new MessagePanelState();
	public readonly chartState: ChartState = new ChartState();
	public readonly queryPlanState: QueryPlanState = new QueryPlanState();
	public readonly topOperationsState = new TopOperationsState();
	public readonly dynamicModelViewTabsState: Map<string, QueryModelViewState> = new Map<string, QueryModelViewState>();

	public activeTab: string;
	public readonly visibleTabs: Set<string> = new Set<string>();

	dispose() {
		this.gridPanelState.dispose();
		this.messagePanelState.dispose();
		this.chartState.dispose();
		this.queryPlanState.dispose();
		this.dynamicModelViewTabsState.forEach((state: QueryModelViewState, identifier: string) => {
			state.dispose();
		});
		this.dynamicModelViewTabsState.clear();
	}
}

/**
 * Input for the QueryResultsEditor. This input helps with logic for the viewing and editing of
 * data in the results grid.
 */
export class QueryResultsInput extends EditorInput {

	private _state = new ResultsViewState();

	public get state(): ResultsViewState {
		return this._state;
	}

	constructor(private _uri: string) {
		super();
	}

	close() {
		this.state.dispose();
		this._state = undefined;
		super.close();
	}

	getTypeId(): string {
		return QueryResultsInput.ID;
	}

	getName(): string {
		return localize('extensionsInputName', "Extension");
	}

	matches(other: any): boolean {
		if (other instanceof QueryResultsInput) {
			return (other._uri === this._uri);
		}

		return false;
	}

	resolve(refresh?: boolean): Promise<any> {
		return Promise.resolve(null);
	}

	supportsSplitEditor(): boolean {
		return false;
	}

	public dispose(): void {
		super.dispose();
	}

	//// Properties

	static get ID() {
		return 'workbench.query.queryResultsInput';
	}

	get uri(): string {
		return this._uri;
	}
}
