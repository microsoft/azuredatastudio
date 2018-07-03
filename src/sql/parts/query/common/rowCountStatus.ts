/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import { IQueryModelService } from '../execution/queryModel';
import QueryRunner from 'sql/parts/query/execution/queryRunner';

import { IStatusbarItem } from 'vs/workbench/browser/parts/statusbar/statusbar';
import { IDisposable, combinedDisposable, dispose } from 'vs/base/common/lifecycle';
import { IEditorGroupService } from 'vs/workbench/services/group/common/groupService';
import { IWorkbenchEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorCloseEvent } from 'vs/workbench/common/editor';
import { append, $, hide, show } from 'vs/base/browser/dom';
import * as nls from 'vs/nls';

export class RowCountStatusBarItem implements IStatusbarItem {

	private _element: HTMLElement;
	private _flavorElement: HTMLElement;

	private dispose: IDisposable;

	constructor(
		@IWorkbenchEditorService private _editorService: IWorkbenchEditorService,
		@IEditorGroupService private _editorGroupService: IEditorGroupService,
		@IQueryModelService private _queryModelService: IQueryModelService
	) { }

	render(container: HTMLElement): IDisposable {
		let disposables = [
			this._editorGroupService.onEditorsChanged(this._onEditorsChanged, this),
			this._editorGroupService.getStacksModel().onEditorClosed(this._onEditorClosed, this)
		];

		this._element = append(container, $('.query-statusbar-group'));
		this._flavorElement = append(this._element, $('a.editor-status-selection'));
		this._flavorElement.title = nls.localize('rowStatus', "Row Count");
		hide(this._flavorElement);

		this._showStatus();

		return combinedDisposable(disposables);
	}

	private _onEditorsChanged() {
		this._showStatus();
	}

	private _onEditorClosed(event: IEditorCloseEvent) {
		hide(this._flavorElement);
	}

	// Show/hide query status for active editor
	private _showStatus(): void {
		hide(this._flavorElement);
		dispose(this.dispose);
		let activeEditor = this._editorService.getActiveEditor();
		if (activeEditor) {
			let currentUri = WorkbenchUtils.getEditorUri(activeEditor.input);
			if (currentUri) {
				let queryRunner = this._queryModelService.getQueryRunner(currentUri);
				if (queryRunner) {
					if (queryRunner.hasCompleted) {
						this._displayValue(queryRunner);
					} else if (queryRunner.isExecuting) {
						this.dispose = queryRunner.addListener('complete', () => {
							this._displayValue(queryRunner);
						});
					}
				} else {
					this.dispose = this._queryModelService.onRunQueryComplete(e => {
						if (e === currentUri) {
							this._displayValue(this._queryModelService.getQueryRunner(currentUri));
						}
					});
				}
			}
		}
	}

	private _displayValue(runner: QueryRunner) {
		let number = runner.batchSets.reduce((p, c) => {
			return p + c.resultSetSummaries.reduce((rp, rc) => {
				return rp + rc.rowCount;
			}, 0);
		}, 0);
		this._flavorElement.innerText = nls.localize('rowCount', "{0} rows", number);
		show(this._flavorElement);
	}
}
