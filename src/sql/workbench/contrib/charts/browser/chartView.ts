/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/chartView';

import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Insight } from './insight';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';
import * as DOM from 'vs/base/browser/dom';
import { Disposable } from 'vs/base/common/lifecycle';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { CreateInsightAction, CopyAction, SaveImageAction, ConfigureChartAction } from 'sql/workbench/contrib/charts/browser/actions';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';
import { IInsightOptions, ChartType, DataDirection } from 'sql/workbench/contrib/charts/common/interfaces';
import { ChartState } from 'sql/workbench/common/editor/query/chartState';
import * as nls from 'vs/nls';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { DbCellValue } from 'azdata';

export class ChartView extends Disposable implements IPanelView {
	private insight: Insight;
	private _queryRunner: QueryRunner;
	private _data: IInsightData;
	private _currentData: { batchId: number, resultId: number };
	private taskbar: Taskbar;

	private _createInsightAction: CreateInsightAction;
	private _configureChartAction: ConfigureChartAction;
	private _copyAction: CopyAction;
	private _saveAction: SaveImageAction;

	private _state: ChartState;

	private _options: IInsightOptions;

	/** parent container */
	private container: HTMLElement;
	/** container for the insight */
	private insightContainer: HTMLElement;
	/** container for the action bar */
	private taskbarContainer: HTMLElement;
	/** container for the charting (includes insight and options) */
	private chartingContainer: HTMLElement;

	private optionMap: { [x: string]: { element: HTMLElement; set: (val) => void } } = {};

	constructor(
		@IInstantiationService private _instantiationService: IInstantiationService,
		@INotificationService private readonly _notificationService: INotificationService
	) {
		super();
		this.taskbarContainer = DOM.$('div.taskbar-container');
		this.taskbar = new Taskbar(this.taskbarContainer);

		this._createInsightAction = this._instantiationService.createInstance(CreateInsightAction);
		this._configureChartAction = this._instantiationService.createInstance(ConfigureChartAction, this);
		this._copyAction = this._instantiationService.createInstance(CopyAction);
		this._saveAction = this._instantiationService.createInstance(SaveImageAction);

		this._options = {
			type: ChartType.Bar,
			dataDirection: DataDirection.Vertical
		};
	}

	public clear() {

	}

	public dispose() {
		super.dispose();
	}

	render(container: HTMLElement): void {
		if (!this.container) {
			this.container = DOM.$('div.chart-parent-container');
			this.insightContainer = DOM.$('div.insight-container');
			this.chartingContainer = DOM.$('div.charting-container');
			this.container.appendChild(this.taskbarContainer);
			this.container.appendChild(this.chartingContainer);
			this.chartingContainer.appendChild(this.insightContainer);
			this.insight = new Insight(this.insightContainer, this._options, this._instantiationService);
			this.updateActionbar();
		}

		container.appendChild(this.container);

		if (this._data) {
			this.insight.data = this._data;
		} else {
			this.queryRunner = this._queryRunner;
		}
	}

	public chart(dataId: { batchId: number, resultId: number }) {
		this.state.dataId = dataId;
		this._currentData = dataId;
		this.shouldGraph();
	}

	layout(dimension: DOM.Dimension): void {
		if (this.insight) {
			this.insight.layout(new DOM.Dimension(DOM.getContentWidth(this.insightContainer), DOM.getContentHeight(this.insightContainer)));
		}
	}

	focus(): void {
	}

	public set queryRunner(runner: QueryRunner) {
		this._queryRunner = runner;
		this.shouldGraph();
	}

	public setData(rows: DbCellValue[][], columns: string[]): void {
		if (!rows) {
			this._data = { columns: [], rows: [] };
			this._notificationService.error(nls.localize('charting.failedToGetRows', "Failed to get rows for the dataset to chart."));
		} else {
			this._data = {
				columns: columns,
				rows: rows.map(r => r.map(c => c.displayValue))
			};
		}

		if (this.insight) {
			this.insight.data = this._data;
		}
	}

	public set options(options: IInsightOptions) {
		this._options = options;
		if (this.insight) {
			this.insight.options = options;
			this.updateActionbar();
		}
	}

	public get options() {
		return this._options;
	}

	private shouldGraph() {
		// Check if we have the necessary information
		if (this._currentData && this._queryRunner) {
			// check if we are being asked to graph something that is available
			let batch = this._queryRunner.batchSets[this._currentData.batchId];
			if (batch) {
				let summary = batch.resultSetSummaries[this._currentData.resultId];
				if (summary) {
					this._queryRunner.getQueryRows(0, summary.rowCount, this._currentData.batchId, this._currentData.resultId).then(d => {
						let rows = d.resultSubset.rows;
						let columns = summary.columnInfo.map(c => c.columnName);
						this.setData(rows, columns);
					});
				}
			}
			// if we have the necessary information but the information isn't available yet,
			// we should be smart and retrying when the information might be available
		}
	}

	private updateActionbar() {
		if (this.insight && this.insight.isCopyable) {
			this.taskbar.context = { insight: this.insight.insight, options: this._options };
			this.taskbar.setContent([
				{ action: this._createInsightAction },
				{ action: this._copyAction },
				{ action: this._saveAction },
				{ action: this._configureChartAction }
			]);
		} else {
			this.taskbar.setContent([{ action: this._createInsightAction }, { action: this._configureChartAction }]);
		}
	}

	public set state(val: ChartState) {
		this._state = val;
		if (this.state.options) {
			for (let key in this.state.options) {
				if (this.state.options.hasOwnProperty(key) && this.optionMap[key]) {
					this._options[key] = this.state.options[key];
					this.optionMap[key].set(this.state.options[key]);
				}
			}
		}
		if (this.state.dataId) {
			this.chart(this.state.dataId);
		}
	}

	public get state(): ChartState {
		return this._state;
	}
}
