/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor/editorInput';

import { TopOperationsState } from 'sql/workbench/common/editor/query/topOperationsState';
import { ChartState } from 'sql/workbench/common/editor/query/chartState';
import { QueryPlanState } from 'sql/workbench/common/editor/query/queryPlanState';
import { GridPanelState } from 'sql/workbench/common/editor/query/gridTableState';
import { QueryModelViewState } from 'sql/workbench/common/editor/query/modelViewState';
import { URI } from 'vs/base/common/uri';
import { QueryPlan2State } from 'sql/workbench/common/editor/query/queryPlan2State';

export class ResultsViewState {
	public readonly gridPanelState: GridPanelState = new GridPanelState();
	public readonly chartState: ChartState = new ChartState();
	public readonly queryPlanState: QueryPlanState = new QueryPlanState();
	public readonly topOperationsState = new TopOperationsState();
	public readonly dynamicModelViewTabsState: Map<string, QueryModelViewState> = new Map<string, QueryModelViewState>();
	public readonly queryPlan2State: QueryPlan2State = new QueryPlan2State();

	public activeTab?: string;
	public readonly visibleTabs: Set<string> = new Set<string>();

	dispose() {
		this.gridPanelState.dispose();
		this.chartState.dispose();
		this.queryPlanState.dispose();
		this.queryPlan2State.clearQueryPlan2State();
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

	constructor(public uri: string) {
		super();
	}

	override get typeId(): string {
		return QueryResultsInput.ID;
	}

	override getName(): string {
		return localize('extensionsInputName', "Extension");
	}

	override matches(other: any): boolean {
		if (other instanceof QueryResultsInput) {
			return (other.uri === this.uri);
		}

		return false;
	}

	override resolve(refresh?: boolean): Promise<any> {
		return Promise.resolve(null);
	}

	supportsSplitEditor(): boolean {
		return false;
	}

	public override dispose(): void {
		super.dispose();
	}

	//// Properties

	static get ID() {
		return 'workbench.query.queryResultsInput';
	}

	get resource(): URI | undefined {
		return undefined;
	}
}
