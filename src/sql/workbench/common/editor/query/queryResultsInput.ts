/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { EditorInput } from 'vs/workbench/common/editor';

import { TopOperationsState } from 'sql/workbench/common/editor/query/topOperationsState';
import { ChartState } from 'sql/workbench/common/editor/query/chartState';
import { QueryPlanState } from 'sql/workbench/common/editor/query/queryPlanState';
import { GridPanelState } from 'sql/workbench/common/editor/query/gridTableState';
import { QueryModelViewState } from 'sql/workbench/common/editor/query/modelViewState';
import { URI } from 'vs/base/common/uri';

export class ResultsViewState {
	public readonly gridPanelState: GridPanelState = new GridPanelState();
	public readonly chartState: ChartState = new ChartState();
	public readonly queryPlanState: QueryPlanState = new QueryPlanState();
	public readonly topOperationsState = new TopOperationsState();
	public readonly dynamicModelViewTabsState: Map<string, QueryModelViewState> = new Map<string, QueryModelViewState>();

	public activeTab?: string;
	public readonly visibleTabs: Set<string> = new Set<string>();

	dispose() {
		this.gridPanelState.dispose();
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

	private _state?= new ResultsViewState();

	public get state(): ResultsViewState | undefined {
		return this._state;
	}

	constructor(private _uri: string) {
		super();
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

	get resource(): URI | undefined {
		return undefined;
	}
}
