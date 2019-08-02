/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { QUERY_HISTORY_PANEL_ID } from 'sql/workbench/parts/queryHistory/common/constants';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectionManagementService, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { Action } from 'vs/base/common/actions';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IPanelService } from 'vs/workbench/services/panel/common/panelService';
import { TogglePanelAction } from 'vs/workbench/browser/panel';
import { localize } from 'vs/nls';
import { IQueryHistoryService } from 'sql/platform/queryHistory/common/queryHistoryService';
import { QueryHistoryNode } from 'sql/workbench/parts/queryHistory/browser/queryHistoryNode';

export class ToggleQueryHistoryAction extends TogglePanelAction {

	public static readonly ID = 'workbench.action.tasks.toggleQueryHistory';
	public static readonly LABEL = localize('toggleQueryHistory', "Toggle Query History");

	constructor(
		id: string, label: string,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IPanelService panelService: IPanelService,
	) {
		super(id, label, QUERY_HISTORY_PANEL_ID, panelService, layoutService);
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

	public async run(element: QueryHistoryNode): Promise<boolean> {
		if (element instanceof QueryHistoryNode && element.info) {
			this._queryHistoryService.deleteQueryHistoryInfo(element.info);
		}
		return true;
	}
}


export class OpenQueryAction extends Action {
	public static ID = 'queryHistory.openQuery';
	public static LABEL = localize('queryHistory.openQuery', "Open Query");

	constructor(
		id: string,
		label: string,
		@IQueryEditorService private _queryEditorService: IQueryEditorService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
	}

	public async run(element: QueryHistoryNode): Promise<boolean> {
		if (element instanceof QueryHistoryNode && element.info) {
			TaskUtilities.newQuery(
				element.info.connectionProfile,
				this._connectionManagementService,
				this._queryEditorService,
				this._objectExplorerService,
				this._editorService,
				element.info.queryText);
		}
		return true;
	}
}

export class RunQueryAction extends Action {
	public static ID = 'queryHistory.runQuery';
	public static LABEL = localize('queryHistory.runQuery', "Run Query");

	constructor(
		id: string,
		label: string,
		@IQueryEditorService private _queryEditorService: IQueryEditorService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IObjectExplorerService private _objectExplorerService: IObjectExplorerService,
		@IEditorService private _editorService: IEditorService
	) {
		super(id, label);
	}

	public async run(element: QueryHistoryNode): Promise<boolean> {
		if (element instanceof QueryHistoryNode && element.info) {
			TaskUtilities.newQuery(
				element.info.connectionProfile,
				this._connectionManagementService,
				this._queryEditorService,
				this._objectExplorerService,
				this._editorService,
				element.info.queryText,
				RunQueryOnConnectionMode.executeQuery);
		}
		return true;
	}
}

