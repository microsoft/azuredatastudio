/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IntervalTimer } from 'vs/base/common/async';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { localize } from 'vs/nls';
import { parseNumAsTimeString } from 'sql/platform/connection/common/utils';
import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { IStatusbarService, IStatusbarEntryAccessor, StatusbarAlignment } from 'vs/workbench/services/statusbar/common/statusbar';
import { IQuery, QueryState } from 'sql/platform/query/common/queryService';

export class TimeElapsedStatusBarContributions extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.query.timeElapsed';

	private statusItem: IStatusbarEntryAccessor;
	private intervalTimer = new IntervalTimer();

	private disposable = this._register(new DisposableStore());

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super();
		this.statusItem = this._register(
			this.statusbarService.addEntry({
				text: '',
			},
				TimeElapsedStatusBarContributions.ID,
				localize('status.query.timeElapsed', "Time Elapsed"),
				StatusbarAlignment.RIGHT, 100)
		);

		this._register(editorService.onDidActiveEditorChange(this.update, this));
		this.update();
	}

	private hide() {
		this.statusbarService.updateEntryVisibility(TimeElapsedStatusBarContributions.ID, false);
	}

	private show() {
		this.statusbarService.updateEntryVisibility(TimeElapsedStatusBarContributions.ID, true);
	}

	private update() {
		this.intervalTimer.cancel();
		this.disposable.clear();
		this.hide();
		const activeEditor = this.editorService.activeEditor;
		if (activeEditor instanceof QueryEditorInput) {
			const query = activeEditor.query;
			if (query) {
				this._displayValue(query);
			} else {
				this.disposable.add(activeEditor.state.onChange(e => e.executingChange && this.update()));
			}
		}
	}

	private _displayValue(query: IQuery) {
		this.intervalTimer.cancel();
		if (query.state === QueryState.EXECUTING) {
			this.intervalTimer.cancelAndSet(() => {
				const value = Date.now() - query.startTime!;
				this.statusItem.update({
					text: parseNumAsTimeString(value, false)
				});
			}, 1000);

			const value = Date.now() - query.startTime!;
			this.statusItem.update({
				text: parseNumAsTimeString(value, false)
			});
			this.show();
		} else if (query.startTime && query.endTime) {
			const value = query.endTime - query.startTime;
			this.statusItem.update({
				text: parseNumAsTimeString(value, false)
			});
			this.show();
		} else {
			this.hide();
		}
	}
}

export class RowCountStatusBarContributions extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.query.rowCount';

	private statusItem: IStatusbarEntryAccessor;

	private disposable = this._register(new DisposableStore());

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super();
		this.statusItem = this._register(
			this.statusbarService.addEntry({
				text: '',
			},
				RowCountStatusBarContributions.ID,
				localize('status.query.rowCount', "Row Count"),
				StatusbarAlignment.RIGHT, 100)
		);

		this._register(editorService.onDidActiveEditorChange(this.update, this));
		this.update();
	}

	private hide() {
		this.statusbarService.updateEntryVisibility(RowCountStatusBarContributions.ID, false);
	}

	private show() {
		this.statusbarService.updateEntryVisibility(RowCountStatusBarContributions.ID, true);
	}

	private update() {
		this.disposable.clear();
		this.hide();
		const activeEditor = this.editorService.activeEditor;
		if (activeEditor instanceof QueryEditorInput) {
			const query = activeEditor.query;
			if (query) {
				if (query.resultSets.length > 0) {
					this.displayValue(query);
				}
				this.disposable.add(query.onResultSetAvailable(e => this.displayValue(query)));
				this.disposable.add(query.onResultSetUpdated(e => this.displayValue(query)));
			} else {
				this.disposable.add(activeEditor.state.onChange(e => e.executingChange && this.update()));
			}
		}
	}

	private displayValue(query: IQuery) {
		const rowCount = query.resultSets.reduce((p, c) =>  p + c.rowCount, 0);
		const text = localize('rowCount', "{0} rows", rowCount.toLocaleString());
		this.statusItem.update({ text });
		this.show();
	}
}

export class QueryStatusStatusBarContributions extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.query.status';

	private disposable = this._register(new DisposableStore());

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IEditorService private readonly editorService: IEditorService,
	) {
		super();
		this._register(
			this.statusbarService.addEntry({
				text: localize('query.status.executing', "Executing query..."),
			},
				QueryStatusStatusBarContributions.ID,
				localize('status.query.status', "Execution Status"),
				StatusbarAlignment.RIGHT, 100)
		);

		this._register(this.editorService.onDidActiveEditorChange(this.update, this));
		this.update();
	}

	private update() {
		this.disposable.clear();
		const activeEditor = this.editorService.activeEditor;
		if (activeEditor instanceof QueryEditorInput) {
			const query = activeEditor.query;
			if (query) {
				if (query.state === QueryState.EXECUTING) {
					this.show();
				} else {
					this.hide();
				}
				this.disposable.add(query.onDidStateChange(() => this.update()));
			} else {
				this.disposable.add(activeEditor.state.onChange(e => e.executingChange && this.update()));
			}
		} else {
			this.hide();
		}
	}

	private hide() {
		this.statusbarService.updateEntryVisibility(QueryStatusStatusBarContributions.ID, false);
	}

	private show() {
		this.statusbarService.updateEntryVisibility(QueryStatusStatusBarContributions.ID, true);
	}
}
