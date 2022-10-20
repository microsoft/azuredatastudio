/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ExecutionPlanWidgetBase as ExecutionPlanWidgetBase } from 'sql/workbench/contrib/executionPlan/browser/executionPlanWidgetBase';

export class ExecutionPlanWidgetController {
	private _executionPlanWidgetMap: Map<string, ExecutionPlanWidgetBase> = new Map();

	constructor(private _parentContainer: HTMLElement) {

	}

	private addWidget(widget: ExecutionPlanWidgetBase) {
		if (widget.identifier && !this._executionPlanWidgetMap.has(widget.identifier)) {
			this._executionPlanWidgetMap.set(widget.identifier, widget);

			if (widget.container) {
				widget.container.classList.add('child');
				this._parentContainer.appendChild(widget.container);
				widget.focus();
			}
		}
	}

	public removeWidget(widget: ExecutionPlanWidgetBase) {
		if (widget.identifier) {
			if (this._executionPlanWidgetMap.has(widget.identifier)) {
				widget.dispose();
				this._parentContainer.removeChild(this._executionPlanWidgetMap.get(widget.identifier).container);
				this._executionPlanWidgetMap.delete(widget.identifier);
			} else {
				throw new Error('The view is not present in the container');
			}
		}
	}

	/**
	 * Adds or removes view from the controller.
	 * @param widget PlanActionView to be added.
	 */
	public toggleWidget(widget: ExecutionPlanWidgetBase) {
		if (!this._executionPlanWidgetMap.has(widget.identifier)) {
			this.addWidget(widget);
		} else {
			this.removeWidget(widget);
		}
	}
}
