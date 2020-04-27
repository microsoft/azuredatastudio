/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IQueryModelService } from 'sql/workbench/services/query/common/queryModel';
import { IntervalTimer } from 'vs/base/common/async';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { localize } from 'vs/nls';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { parseNumAsTimeString } from 'sql/platform/connection/common/utils';
import { Event } from 'vs/base/common/event';
import { QueryEditorInput } from 'sql/workbench/common/editor/query/queryEditorInput';
import { IStatusbarService, IStatusbarEntryAccessor, StatusbarAlignment } from 'vs/workbench/services/statusbar/common/statusbar';

export class TimeElapsedStatusBarContributions extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.query.timeElapsed';

	private statusItem: IStatusbarEntryAccessor;
	private intervalTimer = new IntervalTimer();

	private disposable = this._register(new DisposableStore());

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IEditorService private readonly editorService: IEditorService,
		@IQueryModelService private readonly queryModelService: IQueryModelService
	) {
		super();
		this.statusItem = this._register(
			this.statusbarService.addEntry({
				text: '',
				ariaLabel: ''
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
		const activeInput = this.editorService.activeEditor;
		if (activeInput && activeInput instanceof QueryEditorInput && activeInput.uri) {
			const uri = activeInput.uri;
			const runner = this.queryModelService.getQueryRunner(uri);
			if (runner) {
				if (runner.hasCompleted || runner.isExecuting) {
					this._displayValue(runner);
				}
				this.disposable.add(runner.onQueryStart(e => {
					this._displayValue(runner);
				}));
				this.disposable.add(runner.onQueryEnd(e => {
					this._displayValue(runner);
				}));
			} else {
				this.disposable.add(this.queryModelService.onRunQueryStart(e => {
					if (e === uri) {
						this._displayValue(this.queryModelService.getQueryRunner(uri));
					}
				}));
				this.disposable.add(this.queryModelService.onRunQueryComplete(e => {
					if (e === uri) {
						this._displayValue(this.queryModelService.getQueryRunner(uri));
					}
				}));
			}
		}
	}

	private _displayValue(runner: QueryRunner) {
		this.intervalTimer.cancel();
		if (runner.isExecuting) {
			this.intervalTimer.cancelAndSet(() => {
				const value = runner.queryStartTime ? Date.now() - runner.queryStartTime.getTime() : 0;
				const timeString = parseNumAsTimeString(value, false);
				this.statusItem.update({
					text: timeString,
					ariaLabel: timeString
				});
			}, 1000);

			const value = runner.queryStartTime ? Date.now() - runner.queryStartTime.getTime() : 0;
			const timeString = parseNumAsTimeString(value, false);
			this.statusItem.update({
				text: timeString,
				ariaLabel: timeString
			});
		} else {
			const value = runner.queryStartTime && runner.queryEndTime
				? runner.queryEndTime.getTime() - runner.queryStartTime.getTime() : 0;
			const timeString = parseNumAsTimeString(value, false);
			this.statusItem.update({
				text: timeString,
				ariaLabel: timeString
			});
		}
		this.show();
	}
}

export class RowCountStatusBarContributions extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.query.rowCount';

	private statusItem: IStatusbarEntryAccessor;

	private disposable = this._register(new DisposableStore());

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IEditorService private readonly editorService: IEditorService,
		@IQueryModelService private readonly queryModelService: IQueryModelService
	) {
		super();
		this.statusItem = this._register(
			this.statusbarService.addEntry({
				text: '',
				ariaLabel: ''
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
		const activeInput = this.editorService.activeEditor;
		if (activeInput && activeInput instanceof QueryEditorInput && activeInput.uri) {
			const uri = activeInput.uri;
			const runner = this.queryModelService.getQueryRunner(uri);
			if (runner) {
				if (runner.hasCompleted || runner.isExecuting) {
					this._displayValue(runner);
				}
				this.disposable.add(runner.onQueryStart(e => {
					this._displayValue(runner);
				}));
				this.disposable.add(runner.onResultSetUpdate(e => {
					this._displayValue(runner);
				}));
				this.disposable.add(runner.onQueryEnd(e => {
					this._displayValue(runner);
				}));
			} else {
				this.disposable.add(this.queryModelService.onRunQueryStart(e => {
					if (e === uri) {
						this._displayValue(this.queryModelService.getQueryRunner(uri));
					}
				}));
				this.disposable.add(this.queryModelService.onRunQueryUpdate(e => {
					if (e === uri) {
						this._displayValue(this.queryModelService.getQueryRunner(uri));
					}
				}));
				this.disposable.add(this.queryModelService.onRunQueryComplete(e => {
					if (e === uri) {
						this._displayValue(this.queryModelService.getQueryRunner(uri));
					}
				}));
			}
		}
	}

	private _displayValue(runner: QueryRunner) {
		const rowCount = runner.batchSets.reduce((p, c) => {
			return p + c.resultSetSummaries.reduce((rp, rc) => {
				return rp + rc.rowCount;
			}, 0);
		}, 0);
		const text = localize('rowCount', "{0} rows", rowCount.toLocaleString());
		this.statusItem.update({ text, ariaLabel: text });
		this.show();
	}
}

export class QueryStatusStatusBarContributions extends Disposable implements IWorkbenchContribution {

	private static readonly ID = 'status.query.status';

	private visisbleUri: string | undefined;

	constructor(
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IEditorService private readonly editorService: IEditorService,
		@IQueryModelService private readonly queryModelService: IQueryModelService
	) {
		super();
		this._register(
			this.statusbarService.addEntry({
				text: localize('query.status.executing', "Executing query..."),
				ariaLabel: localize('query.status.executing', "Executing query...")
			},
				QueryStatusStatusBarContributions.ID,
				localize('status.query.status', "Execution Status"),
				StatusbarAlignment.RIGHT, 100)
		);

		this._register(Event.filter(this.queryModelService.onRunQueryStart, uri => uri === this.visisbleUri)(this.update, this));
		this._register(Event.filter(this.queryModelService.onRunQueryComplete, uri => uri === this.visisbleUri)(this.update, this));
		this._register(this.editorService.onDidActiveEditorChange(this.update, this));
		this.update();
	}

	private update() {
		this.hide();
		this.visisbleUri = undefined;
		const activeInput = this.editorService.activeEditor;
		if (activeInput && activeInput instanceof QueryEditorInput && activeInput.uri) {
			this.visisbleUri = activeInput.uri;
			const runner = this.queryModelService.getQueryRunner(this.visisbleUri);
			if (runner && runner.isExecuting) {
				this.show();
			}
		}
	}

	private hide() {
		this.statusbarService.updateEntryVisibility(QueryStatusStatusBarContributions.ID, false);
	}

	private show() {
		this.statusbarService.updateEntryVisibility(QueryStatusStatusBarContributions.ID, true);
	}
}
