/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import QueryRunner from 'sql/platform/query/common/queryRunner';

import { IStatusbarItem } from 'vs/workbench/browser/parts/statusbar/statusbar';
import { IDisposable, combinedDisposable, dispose } from 'vs/base/common/lifecycle';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorCloseEvent } from 'vs/workbench/common/editor';
import { append, $, hide, show } from 'vs/base/browser/dom';
import * as nls from 'vs/nls';
import { EditorServiceImpl } from 'vs/workbench/browser/parts/editor/editor';

export class RowCountStatusBarItem implements IStatusbarItem {

	private _element: HTMLElement;
	private _flavorElement: HTMLElement;

	private dispose: IDisposable;

	constructor(
		@IEditorService private _editorService: EditorServiceImpl,
		@IQueryModelService private _queryModelService: IQueryModelService
	) { }

	render(container: HTMLElement): IDisposable {
		let disposables = [
			this._editorService.onDidVisibleEditorsChange(() => this._onEditorsChanged()),
			this._editorService.onDidCloseEditor(event => this._onEditorClosed(event))
		];

		this._element = append(container, $('.query-statusbar-group'));
		this._flavorElement = append(this._element, $('.editor-status-selection'));
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
		let activeEditor = this._editorService.activeControl;
		if (activeEditor) {
			let currentUri = WorkbenchUtils.getEditorUri(activeEditor.input);
			if (currentUri) {
				let queryRunner = this._queryModelService.getQueryRunner(currentUri);
				if (queryRunner) {
					if (queryRunner.hasCompleted) {
						this._displayValue(queryRunner);
					}
					this.dispose = queryRunner.onQueryEnd(e => {
						this._displayValue(queryRunner);
					});
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
		let rowCount = runner.batchSets.reduce((p, c) => {
			return p + c.resultSetSummaries.reduce((rp, rc) => {
				return rp + rc.rowCount;
			}, 0);
		}, 0);
		this._flavorElement.innerText = nls.localize('rowCount', "{0} rows", rowCount);
		show(this._flavorElement);
	}
}
