/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Dimension } from 'vs/base/browser/dom';
import { dispose } from 'vs/base/common/lifecycle';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { bootstrapAngular } from 'sql/workbench/services/bootstrap/browser/bootstrapService';
import { QueryModelViewTabModule } from 'sql/workbench/contrib/query/browser/modelViewTab/queryModelViewTab.module';
import { QueryModelViewState } from 'sql/workbench/common/editor/query/modelViewState';

export class QueryModelViewTab implements IPanelTab {
	public identifier = 'QueryModelViewTab_';
	public readonly view: QueryModelViewTabView;

	constructor(public title: string, @IInstantiationService instantiationService: IInstantiationService) {
		this.identifier += title;
		this.view = instantiationService.createInstance(QueryModelViewTabView);
	}

	public putState(dynamicModelViewTabsState: Map<string, QueryModelViewState>): void {
		dynamicModelViewTabsState.set(this.view.componentId, this.view.state);
	}

	public captureState(dynamicModelViewTabsState: Map<string, QueryModelViewState>): void {
		for (let i = 0; i < dynamicModelViewTabsState.keys.length; ++i) {
			let currentIdentifier = dynamicModelViewTabsState[dynamicModelViewTabsState.keys[i]];
			if (currentIdentifier === this.view.componentId) {
				this.view.state = dynamicModelViewTabsState[dynamicModelViewTabsState.keys[i]];
				break;
			}
		}
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

export class QueryModelViewTabView implements IPanelView {
	public state: QueryModelViewState = new QueryModelViewState();

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService) {
	}

	public render(container: HTMLElement): void {
		this.bootstrapAngular(container);
	}

	public dispose() {
	}

	public clear() {
	}

	public layout(dimension: Dimension): void {
	}

	public focus(): void {
	}

	public get componentId(): string {
		return this.state.componentId;
	}

	public set componentId(value: string) {
		this.state.componentId = value;
	}

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private bootstrapAngular(container: HTMLElement): string {
		let uniqueSelector = this._instantiationService.invokeFunction(bootstrapAngular,
			QueryModelViewTabModule,
			container,
			'querytab-modelview-container',
			{ modelViewId: this.state.componentId });
		return uniqueSelector;
	}
}
