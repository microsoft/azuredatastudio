/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { QueryPlanWidgetBase } from 'sql/workbench/contrib/queryplan2/browser/queryPlanWidgetBase';

export class QueryPlanWidgetController {
	private _queryPlanWidgetMap: Map<string, QueryPlanWidgetBase> = new Map();

	constructor(private _parentContainer: HTMLElement) {

	}

	private addWidget(widget: QueryPlanWidgetBase) {
		if (widget.identifier && !this._queryPlanWidgetMap.has(widget.identifier)) {
			this._queryPlanWidgetMap.set(widget.identifier, widget);
			if (widget.container) {
				widget.container.classList.add('child');
				this._parentContainer.appendChild(widget.container);
				widget.focus();
			}
		}
	}

	public removeWidget(widget: QueryPlanWidgetBase) {
		if (widget.identifier) {
			if (this._queryPlanWidgetMap.has(widget.identifier)) {
				this._parentContainer.removeChild(this._queryPlanWidgetMap.get(widget.identifier).container);
				this._queryPlanWidgetMap.delete(widget.identifier);
			} else {
				throw new Error('The view is not present in the container');
			}
		}
	}

	/**
	 * Adds or removes view from the controller.
	 * @param widget PlanActionView to be added.
	 */
	public toggleWidget(widget: QueryPlanWidgetBase) {
		if (!this._queryPlanWidgetMap.has(widget.identifier)) {
			this.addWidget(widget);
		} else {
			this.removeWidget(widget);
		}
	}
}
