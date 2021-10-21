/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IQueryEditorConfiguration } from 'sql/platform/query/common/query';
import { GridPanelState, GridTableState } from 'sql/workbench/common/editor/query/gridTableState';
import { GridTable } from 'sql/workbench/contrib/query/browser/gridPanel';
import { MessagePanel } from 'sql/workbench/contrib/query/browser/messagePanel';
import { ResultSetSummary } from 'sql/workbench/services/query/common/query';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { dispose } from 'vs/base/common/lifecycle';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILogService } from 'vs/platform/log/common/log';
import { IThemeService } from 'vs/platform/theme/common/themeService';

export class TextResultsMessagePanel extends MessagePanel {
	private tables: Array<GridTable<any>> = [];
	private _state: GridPanelState | undefined;
	private runner: QueryRunner;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IClipboardService clipboardService: IClipboardService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IConfigurationService configurationService: IConfigurationService
	) {
		super(instantiationService,
			themeService,
			contextMenuService,
			clipboardService,
			textResourcePropertiesService,
			configurationService);
	}

	public override clear() {
		const reset = () => {
			dispose(this.tables);
			this.tables = [];

			super.reset();
		};

		reset();
	}

	public override set queryRunner(runner: QueryRunner) {
		super.queryRunner = runner;

		this.runner = runner;

		this.queryRunnerDisposables.add(runner.onResultSet(this.onResultSet, this));
		this.queryRunnerDisposables.add(runner.onResultSetUpdate(this.updateResultSet, this));
		this.queryRunnerDisposables.add(this.runner.onQueryStart(() => {
			if (this.state) {
				this.state.tableStates = [];
			}
			this.clear();
		}));
	}

	private onResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
		let resultsToAdd: ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToAdd = [resultSet];
		} else {
			resultsToAdd = resultSet.splice(0);
		}

		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.streaming) {
			this.addResultSet(resultsToAdd);
		} else {
			resultsToAdd = resultsToAdd.filter(e => e.complete);
			if (resultsToAdd.length > 0) {
				this.addResultSet(resultsToAdd);
			}
		}

		// this.tree.setInput(this.model, this._treeStates.get(this.currenturi));
	}

	private updateResultSet(resultSet: ResultSetSummary | ResultSetSummary[]) {
		let resultsToUpdate: ResultSetSummary[];
		if (!Array.isArray(resultSet)) {
			resultsToUpdate = [resultSet];
		} else {
			resultsToUpdate = resultSet.splice(0);
		}

		if (this.configurationService.getValue<IQueryEditorConfiguration>('queryEditor').results.streaming) {
			for (let set of resultsToUpdate) {
				let table = this.tables.find(t => t.resultSet.batchId === set.batchId && t.resultSet.id === set.id);
				if (table) {
					table.updateResult(set);
				} else {
					this.logService.warn('Got result set update request for non-existant table');
				}
			}
		} else {
			resultsToUpdate = resultsToUpdate.filter(e => e.complete);
			if (resultsToUpdate.length > 0) {
				this.addResultSet(resultsToUpdate);
			}
		}
	}

	// TODO lewissanchez - Will need to move away from using a GridTable type to a newly defined Table DTO.
	private addResultSet(resultSet: ResultSetSummary[]) {
		const tables: Array<GridTable<any>> = [];

		for (const set of resultSet) {
			// ensure we aren't adding a resultSet that is already visible
			if (this.tables.find(t => t.resultSet.batchId === set.batchId && t.resultSet.id === set.id)) {
				continue;
			}

			// Searching for the table state with a matching batch ID and result ID.
			let tableState: GridTableState;
			if (this.state) {
				tableState = this.state.tableStates.find(e => e.batchId === set.batchId && e.resultId === set.id);
			}
			// Creates an instance of a GridTable State if we couldn't find one with specified set ID and batch ID.
			// GridTableState is to track the UI state of the grid (i.e. Is it sorted, expanded, etc?)
			if (!tableState) {
				tableState = new GridTableState(set.id, set.batchId);
				if (this.state) {
					this.state.tableStates.push(tableState);
				}
			}

			// Instantiates and pushes table
			const table = this.instantiationService.createInstance(GridTable, this.runner, set, tableState);
			tables.push(table);
		}

		this.tables = this.tables.concat(tables);

		// turn-off special-case process when only a single table is being displayed
		if (this.tables.length > 1) {
			for (let i = 0; i < this.tables.length; ++i) {
				this.tables[i].isOnlyTable = false;
			}
		}
	}

	// These are not needed if we're just rendering text query results that are stateless.
	public set state(val: GridPanelState) {
		this._state = val;
		if (this.state) {
			this.tables.map(t => {
				let state = this.state.tableStates.find(s => s.batchId === t.resultSet.batchId && s.resultId === t.resultSet.id);
				if (!state) {
					this.state.tableStates.push(t.state);
				}
				if (state) {
					t.state = state;
				}
			});
		}
	}

	public get state() {
		return this._state;
	}
}
