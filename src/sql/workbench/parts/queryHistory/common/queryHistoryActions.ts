/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { QueryHistoryNode } from 'sql/platform/queryHistory/common/queryHistoryNode';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { IConnectionManagementService, RunQueryOnConnectionMode } from 'sql/platform/connection/common/connectionManagement';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';


export class DeleteAction extends Action {
	public static ID = 'queryHistory.delete';
	public static LABEL = localize('queryHistory.delete', "Delete");

	constructor(
		id: string,
		label: string
	) {
		super(id, label);
	}

	public async run(element: QueryHistoryNode): Promise<boolean> {
		if (element instanceof QueryHistoryNode) {
			/*
			try {

				let result = await this._taskService.cancelTask(element.providerName, element.id);
				if (!result) {
					let error = localize('errorMsgFromDeleteTask', "Failed to delete Query History item.");
					this.showError(error);
				}
			}
			catch (err) {
				this.showError(err.Message);
			}
			*/
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

	public run(element: QueryHistoryNode): Promise<boolean> {
		if (element instanceof QueryHistoryNode) {
			TaskUtilities.newQuery(
				element.connectionProfile,
				this._connectionManagementService,
				this._queryEditorService,
				this._objectExplorerService,
				this._editorService,
				element.queryText);
		}
		return Promise.resolve(true);
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
		if (element instanceof QueryHistoryNode) {
			TaskUtilities.newQuery(
				element.connectionProfile,
				this._connectionManagementService,
				this._queryEditorService,
				this._objectExplorerService,
				this._editorService,
				element.queryText,
				RunQueryOnConnectionMode.executeQuery);
		}
		return Promise.resolve(true);
	}
}
