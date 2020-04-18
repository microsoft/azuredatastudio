/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DeleteAction, OpenQueryAction, RunQueryAction, ClearHistoryAction, ToggleQueryHistoryCaptureAction } from 'sql/workbench/contrib/queryHistory/browser/queryHistoryActions';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IAction } from 'vs/base/common/actions';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { QueryHistoryNode } from 'sql/workbench/contrib/queryHistory/browser/queryHistoryNode';

/**
 *  Provides query history actions
 */
export class QueryHistoryActionProvider {

	private _actions: {
		openQueryAction: IAction,
		runQueryAction: IAction,
		deleteAction: IAction,
		clearAction: IAction,
		toggleCaptureAction: IAction
	};

	constructor(
		@IInstantiationService instantiationService: IInstantiationService
	) {
		this._actions = {
			openQueryAction: instantiationService.createInstance(OpenQueryAction, OpenQueryAction.ID, OpenQueryAction.LABEL),
			runQueryAction: instantiationService.createInstance(RunQueryAction, RunQueryAction.ID, RunQueryAction.LABEL),
			deleteAction: instantiationService.createInstance(DeleteAction, DeleteAction.ID, DeleteAction.LABEL),
			clearAction: instantiationService.createInstance(ClearHistoryAction, ClearHistoryAction.ID, ClearHistoryAction.LABEL),
			toggleCaptureAction: instantiationService.createInstance(ToggleQueryHistoryCaptureAction, ToggleQueryHistoryCaptureAction.ID, ToggleQueryHistoryCaptureAction.LABEL)
		};
	}

	public hasActions(element: any): boolean {
		return element instanceof QueryHistoryNode;
	}

	/**
	 * Return actions for a selected node - or the default actions if no node is selected
	 */
	public getActions(element: any): IAction[] {
		const actions: IAction[] = [];
		// Actions we only want to display if we're on a valid QueryHistoryNode
		if (element instanceof QueryHistoryNode && element.info) {
			if (element.info && element.info.queryText && element.info.queryText !== '') {
				actions.push(this._actions.openQueryAction);
				actions.push(this._actions.runQueryAction);
			}
			actions.push(this._actions.deleteAction);
		}
		// Common actions we want to always display
		actions.push(this._actions.clearAction, this._actions.toggleCaptureAction);
		return actions;
	}

	public hasSecondaryActions(tree: ITree, element: any): boolean {
		return false;
	}
}
