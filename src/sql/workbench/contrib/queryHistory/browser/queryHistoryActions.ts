/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { QUERY_HISTORY_VIEW_ID } from 'sql/workbench/contrib/queryHistory/common/constants';
import { RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { Action } from 'vs/base/common/actions';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { localize } from 'vs/nls';
import { IQueryHistoryService } from 'sql/workbench/services/queryHistory/common/queryHistoryService';
import { QueryHistoryNode } from 'sql/workbench/contrib/queryHistory/browser/queryHistoryNode';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { openNewQuery } from 'sql/workbench/contrib/query/browser/queryActions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IViewsService, IViewDescriptorService } from 'vs/workbench/common/views';
import { ToggleViewAction } from 'vs/workbench/browser/actions/layoutActions';

export class ToggleQueryHistoryAction extends ToggleViewAction {

	public static readonly ID = 'workbench.action.tasks.toggleQueryHistory';
	public static readonly LABEL = localize('toggleQueryHistory', "Toggle Query History");

	constructor(
		id: string, label: string,
		@IViewsService viewsService: IViewsService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService
	) {
		super(id, label, QUERY_HISTORY_VIEW_ID, viewsService, viewDescriptorService, contextKeyService, layoutService);
	}
}

export class DeleteAction extends Action {
	public static ID = 'queryHistory.delete';
	public static LABEL = localize('queryHistory.delete', "Delete");

	constructor(
		id: string,
		label: string,
		@IQueryHistoryService private _queryHistoryService: IQueryHistoryService
	) {
		super(id, label);
	}

	public async run(element: QueryHistoryNode): Promise<void> {
		if (element instanceof QueryHistoryNode && element.info) {
			this._queryHistoryService.deleteQueryHistoryInfo(element.info);
		}
	}
}

export class ClearHistoryAction extends Action {
	public static ID = 'queryHistory.clear';
	public static LABEL = localize('queryHistory.clearLabel', "Clear All History");

	constructor(
		id: string,
		label: string,
		@ICommandService private _commandService: ICommandService
	) {
		super(id, label, 'clear-query-history-action codicon-clear-all');
	}

	public async run(): Promise<void> {
		return this._commandService.executeCommand('queryHistory.clear');
	}
}


export class OpenQueryAction extends Action {
	public static ID = 'queryHistory.openQuery';
	public static LABEL = localize('queryHistory.openQuery', "Open Query");

	constructor(
		id: string,
		label: string,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public async run(element: QueryHistoryNode): Promise<void> {
		if (element instanceof QueryHistoryNode && element.info) {
			return this._instantiationService.invokeFunction(openNewQuery, element.info.connectionProfile, element.info.queryText, RunQueryOnConnectionMode.none).then();
		}
	}
}

export class RunQueryAction extends Action {
	public static ID = 'queryHistory.runQuery';
	public static LABEL = localize('queryHistory.runQuery', "Run Query");

	constructor(
		id: string,
		label: string,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		super(id, label);
	}

	public async run(element: QueryHistoryNode): Promise<void> {
		if (element instanceof QueryHistoryNode && element.info) {
			return this._instantiationService.invokeFunction(openNewQuery, element.info.connectionProfile, element.info.queryText, RunQueryOnConnectionMode.executeQuery).then();
		}
	}
}

export class ToggleQueryHistoryCaptureAction extends Action {
	public static ID = 'queryHistory.toggleCapture';
	public static LABEL = localize('queryHistory.toggleCaptureLabel', "Toggle Query History capture");

	constructor(
		id: string,
		label: string,
		@ICommandService private _commandService: ICommandService,
		@IQueryHistoryService queryHistoryService: IQueryHistoryService
	) {
		super(id, label);
		this.setClassAndLabel(queryHistoryService.captureEnabled);
		this._register(queryHistoryService.onQueryHistoryCaptureChanged((captureEnabled: boolean) => { this.setClassAndLabel(captureEnabled); }));
	}

	public async run(): Promise<void> {
		return this._commandService.executeCommand('queryHistory.toggleCapture');
	}

	private setClassAndLabel(enabled: boolean) {
		if (enabled) {
			this.class = 'toggle-query-history-capture-action codicon-debug-pause';
			this.label = localize('queryHistory.disableCapture', "Pause Query History Capture");
		} else {
			this.class = 'toggle-query-history-capture-action codicon-play';
			this.label = localize('queryHistory.enableCapture', "Start Query History Capture");
		}
	}
}

