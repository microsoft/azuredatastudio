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
	public readonly title = 'Model View';
	public readonly identifier = 'QueryModelViewTab';
	public readonly view: QueryModelViewTabView;

	constructor(@IInstantiationService instantiationService: IInstantiationService) {
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

		// if (!this._isInitialized) {
		// 	this._selector = this.bootstrapAngular(container);
		// 	this._isInitialized = true;
		// } else {
		// 	container.innerHTML = '<' + this._selector + ' />';
		// }
	}

	dispose() {
		//dispose(this.disposables);
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