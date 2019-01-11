/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { localize } from 'vs/nls';
import { TPromise } from 'vs/base/common/winjs.base';
import { EditorInput } from 'vs/workbench/common/editor';
import { Emitter } from 'vs/base/common/event';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';

import { GridPanelState } from 'sql/parts/query/editor/gridPanel';
import { MessagePanelState } from 'sql/parts/query/editor/messagePanel';
import { QueryPlanState } from 'sql/parts/queryPlan/queryPlan';
import { ChartState } from 'sql/parts/query/editor/charting/chartView';
import { TopOperationsState } from 'sql/parts/queryPlan/topOperations';

export class ResultsViewState {
	public gridPanelState: GridPanelState = new GridPanelState();
	public messagePanelState: MessagePanelState = new MessagePanelState(this.configurationService);
	public chartState: ChartState = new ChartState();
	public queryPlanState: QueryPlanState = new QueryPlanState();
	public topOperationsState = new TopOperationsState();
	public gridPanelSize: number;
	public messagePanelSize: number;
	public activeTab: string;
	public visibleTabs: Set<string> = new Set<string>();

	constructor(@IConfigurationService private configurationService: IConfigurationService) {

	}

	dispose() {
		this.gridPanelState.dispose();
		this.messagePanelState.dispose();
		this.chartState.dispose();
		this.queryPlanState.dispose();
	}
}

/**
 * Input for the QueryResultsEditor. This input helps with logic for the viewing and editing of
 * data in the results grid.
 */
export class QueryResultsInput extends EditorInput {

	// Tracks if the editor that holds this input should be visible (i.e. true if a query has been run)
	private _visible: boolean;

	// Tracks if the editor has holds this input has has bootstrapped angular yet
	private _hasBootstrapped: boolean;

	// Holds the HTML content for the editor when the editor discards this input and loads another
	private _editorContainer: HTMLElement;
	public css: HTMLStyleElement;

	public readonly onRestoreViewStateEmitter = new Emitter<void>();
	public readonly onSaveViewStateEmitter = new Emitter<void>();

	private _state = new ResultsViewState(this.configurationService);

	public get state(): ResultsViewState {
		return this._state;
	}

	constructor(private _uri: string,
		@IConfigurationService private configurationService: IConfigurationService
	) {
		super();
		this._visible = false;
		this._hasBootstrapped = false;
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
		return localize('extensionsInputName', 'Extension');
	}

	matches(other: any): boolean {
		if (other instanceof QueryResultsInput) {
			return (other._uri === this._uri);
		}

		return false;
	}

	resolve(refresh?: boolean): TPromise<any> {
		return TPromise.as(null);
	}

	supportsSplitEditor(): boolean {
		return false;
	}

	public setBootstrappedTrue(): void {
		this._hasBootstrapped = true;
	}

	public dispose(): void {
		this._disposeContainer();
		super.dispose();
	}

	private _disposeContainer() {
		if (!this._editorContainer) {
			return;
		}

		let parentContainer = this._editorContainer.parentNode;
		if (parentContainer) {
			parentContainer.removeChild(this._editorContainer);
			this._editorContainer = null;
		}
	}

	//// Properties

	static get ID() {
		return 'workbench.query.queryResultsInput';
	}

	set container(container: HTMLElement) {
		this._disposeContainer();
		this._editorContainer = container;
	}

	get container(): HTMLElement {
		return this._editorContainer;
	}

	get hasBootstrapped(): boolean {
		return this._hasBootstrapped;
	}

	get visible(): boolean {
		return this._visible;
	}

	set visible(visible: boolean) {
		this._visible = visible;
	}

	get uri(): string {
		return this._uri;
	}

}