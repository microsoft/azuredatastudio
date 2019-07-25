/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Action } from 'vs/base/common/actions';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import Severity from 'vs/base/common/severity';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { QueryHistoryNode } from 'sql/platform/queryHistory/common/queryHistoryNode';

export class DeleteAction extends Action {
	public static ID = 'queryHistory.delete';
	public static LABEL = localize('queryHistory.delete', 'Delete');

	constructor(
		id: string,
		label: string,
		@IErrorMessageService private _errorMessageService: IErrorMessageService
	) {
		super(id, label);
	}

	public async run(element: QueryHistoryNode): Promise<boolean> {
		if (element instanceof QueryHistoryNode) {
			/*
			try {

				let result = await this._taskService.cancelTask(element.providerName, element.id);
				if (!result) {
					let error = localize('errorMsgFromDeleteTask', 'Failed to delete Query History item.');
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

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}
}


export class OpenQueryAction extends Action {
	public static ID = 'queryHistory.openQuery';
	public static LABEL = localize('queryHistory.openQuery', "Open Query");

	constructor(
		id: string,
		label: string,
		@IErrorMessageService private _errorMessageService: IErrorMessageService,
		@IQueryEditorService private _queryEditorService: IQueryEditorService
	) {
		super(id, label);
	}

	public run(element: QueryHistoryNode): Promise<boolean> {
		if (element instanceof QueryHistoryNode) {
			if (element.queryText && element.queryText !== '') {
				this._queryEditorService.newSqlEditor(element.queryText);
			}
		}
		return Promise.resolve(true);
	}

	private showError(errorMessage: string) {
		if (this._errorMessageService) {
			this._errorMessageService.showDialog(Severity.Error, '', errorMessage);
		}
	}
}