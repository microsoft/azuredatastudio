/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as WorkbenchUtils from 'sql/workbench/common/sqlWorkbenchUtils';
import { IQueryModelService } from 'sql/platform/query/common/queryModel';
import QueryRunner from 'sql/platform/query/common/queryRunner';
import { parseNumAsTimeString } from 'sql/platform/connection/common/utils';

import { IStatusbarItem } from 'vs/workbench/browser/parts/statusbar/statusbar';
import { IDisposable, combinedDisposable, dispose } from 'vs/base/common/lifecycle';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditorCloseEvent } from 'vs/workbench/common/editor';
import { append, $, hide, show } from 'vs/base/browser/dom';
import * as nls from 'vs/nls';
import { EditorServiceImpl } from 'vs/workbench/browser/parts/editor/editor';
import { IntervalTimer } from 'vs/base/common/async';

export class TimeElapsedStatusBarItem implements IStatusbarItem {

	private _element: HTMLElement;
	private _flavorElement: HTMLElement;

	private dispose: IDisposable[] = [];
	private intervalTimer = new IntervalTimer();

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
		this._flavorElement.title = nls.localize('timeElapsed', "Time Elapsed");
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
		this.intervalTimer.cancel();
		hide(this._flavorElement);
		dispose(this.dispose);
		this._flavorElement.innerText = '';
		this.dispose = [];
		let activeEditor = this._editorService.activeControl;
		if (activeEditor) {
			let currentUri = WorkbenchUtils.getEditorUri(activeEditor.input);
			if (currentUri) {
				let queryRunner = this._queryModelService.getQueryRunner(currentUri);
				if (queryRunner) {
					if (queryRunner.hasCompleted || queryRunner.isExecuting) {
						this._displayValue(queryRunner);
					}
					this.dispose.push(queryRunner.onQueryStart(e => {
						this._displayValue(queryRunner);
					}));
					this.dispose.push(queryRunner.onQueryEnd(e => {
						this._displayValue(queryRunner);
					}));
				} else {
					this.dispose.push(this._queryModelService.onRunQueryStart(e => {
						if (e === currentUri) {
							this._displayValue(this._queryModelService.getQueryRunner(currentUri));
						}
					}));
					this.dispose.push(this._queryModelService.onRunQueryComplete(e => {
						if (e === currentUri) {
							this._displayValue(this._queryModelService.getQueryRunner(currentUri));
						}
					}));
				}
			}
		}
	}

	private _displayValue(runner: QueryRunner) {
		this.intervalTimer.cancel();
		if (runner.isExecuting) {
			this.intervalTimer.cancelAndSet(() => {
				this._flavorElement.innerText = parseNumAsTimeString(Date.now() - runner.queryStartTime.getTime(), false);
			}, 1000);
			this._flavorElement.innerText = parseNumAsTimeString(Date.now() - runner.queryStartTime.getTime(), false);
		} else {
			this._flavorElement.innerText = parseNumAsTimeString(runner.queryEndTime.getTime() - runner.queryStartTime.getTime(), false);
		}
		show(this._flavorElement);
	}
}
