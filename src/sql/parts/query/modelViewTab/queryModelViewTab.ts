/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Dimension } from 'vs/base/browser/dom';
import { dispose, IDisposable } from 'vs/base/common/lifecycle';
import { IPanelView, IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { bootstrapAngular } from 'sql/services/bootstrap/bootstrapService';
import { QueryModelViewTabModule } from 'sql/parts/query/modelViewTab/queryModelViewTab.module';

export class QueryModelViewTab implements IPanelTab {
	public identifier = 'QueryModelViewTab_';
	public readonly view: QueryModelViewTabView;

	constructor(public title: string, @IInstantiationService instantiationService: IInstantiationService) {
		this.identifier += title;
		this.view = instantiationService.createInstance(QueryModelViewTabView);
	}

	public dispose() {
		dispose(this.view);
	}

	public clear() {
		this.view.clear();
	}
}

export class QueryModelViewTabView implements IPanelView {

	public _componentId: string;
	private _isInitialized: boolean = false;

	private _selector: string;

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService) {
	}

	public render(container: HTMLElement): void {
		this.bootstrapAngular(container);
	}

	dispose() {
	}

	public clear() {
	}

	public layout(dimension: Dimension): void {
	}

	/**
	 * Load the angular components and record for this input that we have done so
	 */
	private bootstrapAngular(container: HTMLElement): string {
		let uniqueSelector = bootstrapAngular(this._instantiationService,
			QueryModelViewTabModule,
			container,
			'querytab-modelview-container',
			{ modelViewId: this._componentId });
		return uniqueSelector;
	}
}