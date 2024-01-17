/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from 'vs/base/common/lifecycle';

export abstract class ExecutionPlanWidgetBase extends Disposable {
	/**
	 *
	 * @param container HTML Element that contains the UI for the plan action view.
	 * @param identifier Uniquely identify the view to be added or removed. Note: Only 1 view with the same id can be added to the controller
	 */
	constructor(public container: HTMLElement, public identifier: string) {
		super();

		this.container = container;
		this.identifier = identifier;
	}

	/**
	 * This method is called when the view is added to PlanActionView.
	 * Generally, the view should focus the first input element in the view
	 */
	public abstract focus();
}
