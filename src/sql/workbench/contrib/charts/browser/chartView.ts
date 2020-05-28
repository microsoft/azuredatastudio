/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/chartView';

import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Insight } from './insight';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';
import { ICellValue } from 'sql/workbench/services/query/common/query';
import { ChartOptions, IChartOption, ControlType } from './chartOptions';
import { Extensions, IInsightRegistry, IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';
import { Registry } from 'vs/platform/registry/common/platform';
import * as DOM from 'vs/base/browser/dom';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { attachSelectBoxStyler, attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { CreateInsightAction, CopyAction, SaveImageAction, IChartActionContext, ConfigureChartAction } from 'sql/workbench/contrib/charts/browser/actions';
import { Taskbar, ITaskbarContent } from 'sql/base/browser/ui/taskbar/taskbar';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { IInsightOptions, ChartType } from 'sql/workbench/contrib/charts/common/interfaces';
import { ChartState } from 'sql/workbench/common/editor/query/chartState';
import * as nls from 'vs/nls';
import { find } from 'vs/base/common/arrays';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Event, Emitter } from 'vs/base/common/event';

const insightRegistry = Registry.as<IInsightRegistry>(Extensions.InsightContribution);

//Map used to store names and alternative names for chart types.
//This is mainly used for comparison when options are parsed into the constructor.
const altNameHash: { [oldName: string]: string } = {
	'horizontalBar': nls.localize('horizontalBarAltName', "Horizontal Bar"),
	'bar': nls.localize('barAltName', "Bar"),
	'line': nls.localize('lineAltName', "Line"),
	'pie': nls.localize('pieAltName', "Pie"),
	'scatter': nls.localize('scatterAltName', "Scatter"),
	'timeSeries': nls.localize('timeSeriesAltName', "Time Series"),
	'image': nls.localize('imageAltName', "Image"),
	'count': nls.localize('countAltName', "Count"),
	'table': nls.localize('tableAltName', "Table"),
	'doughnut': nls.localize('doughnutAltName', "Doughnut")
};

export class ChartView extends Disposable implements IPanelView {
	private insight: Insight;
	private _queryRunner: QueryRunner;
	private _data: IInsightData;
	private _currentData: { batchId: number, resultId: number };
	private taskbar: Taskbar;

	private _createInsightAction: CreateInsightAction;
	private _copyAction: CopyAction;
	private _saveAction: SaveImageAction;
	private _configureChartAction: ConfigureChartAction;

	private _state: ChartState;

	private _options: IInsightOptions = {
		type: ChartType.Bar
	};

	/** parent container */
	private container: HTMLElement;
	/** container for the options controls */
	public readonly optionsControl: HTMLElement;
	/** container for type specific controls */
	private typeControls: HTMLElement;
	/** container for the insight */
	private insightContainer: HTMLElement;
	/** container for the action bar */
	private taskbarContainer: HTMLElement;
	/** container for the charting (includes insight and options) */
	private chartingContainer: HTMLElement;

	private optionDisposables: IDisposable[] = [];
	private optionMap: { [x: string]: { element: HTMLElement; set: (val) => void } } = {};

	private readonly _onOptionsChange: Emitter<IInsightOptions> = this._register(new Emitter<IInsightOptions>());
	public readonly onOptionsChange: Event<IInsightOptions> = this._onOptionsChange.event;

	constructor(
		private readonly _isQueryEditorChart: boolean,
		@IContextViewService private _contextViewService: IContextViewService,
		@IThemeService private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@INotificationService private readonly _notificationService: INotificationService
	) {
		super();
		this.taskbarContainer = DOM.$('div.taskbar-container');
		this.taskbar = new Taskbar(this.taskbarContainer);

		this.optionsControl = DOM.$('div.options-container');
		const generalControls = DOM.$('div.general-controls');
		this.optionsControl.appendChild(generalControls);
		this.typeControls = DOM.$('div.type-controls');
		this.optionsControl.appendChild(this.typeControls);

		this._copyAction = this._instantiationService.createInstance(CopyAction);
		this._saveAction = this._instantiationService.createInstance(SaveImageAction);

		if (this._isQueryEditorChart) {
			this._createInsightAction = this._instantiationService.createInstance(CreateInsightAction);
			this.taskbar.setContent([{ action: this._createInsightAction }]);
		} else {
			this._configureChartAction = this._instantiationService.createInstance(ConfigureChartAction, this);
			this.taskbar.setContent([{ action: this._configureChartAction }]);
		}

		const self = this;
		this._options = new Proxy(this._options, {
			get: function (target, key) {
				return target[key];
			},
			set: function (target, key, value) {
				let change = false;
				if (target[key] !== value) {
					change = true;
				}

				target[key] = value;
				// mirror the change in our state
				if (self.state) {
					self.state.options[key] = value;
				}

				if (change) {
					self.taskbar.context = <IChartActionContext>{ options: self._options, insight: self.insight ? self.insight.insight : undefined };
					if (key === 'type') {
						self.buildOptions();
					} else {
						self.verifyOptions();
					}
					self._onOptionsChange.fire(self._options);
				}

				return true;
			}
		}) as IInsightOptions;


		ChartOptions.general[0].options = insightRegistry.getAllIds();
		ChartOptions.general.map(o => {
			this.createOption(o, generalControls);
		});
		this.buildOptions();
	}

	public clear() {

	}

	/**
	 * Function used to generate list of alternative names for use with SelectBox
	 * @param option - the original option names.
	 */
	private changeToAltNames(option: string[]): string[] {
		return option.map(o => altNameHash[o] || o);
	}

	public dispose() {
		dispose(this.optionDisposables);
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
			if (this._isQueryEditorChart) {
				this.chartingContainer.appendChild(this.optionsControl);
			}
			this.insight = new Insight(this.insightContainer, this._options, this._instantiationService);
		}

		container.appendChild(this.container);

		if (this._data) {
			this.insight.data = this._data;
		} else {
			this.queryRunner = this._queryRunner;
		}
		this.verifyOptions();
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

	public setData(rows: ICellValue[][], columns: string[]): void {
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

	private shouldGraph() {
		// Check if we have the necessary information
		if (this._currentData && this._queryRunner) {
			// check if we are being asked to graph something that is available
			let batch = this._queryRunner.batchSets[this._currentData.batchId];
			if (batch) {
				let summary = batch.resultSetSummaries[this._currentData.resultId];
				if (summary) {
					this._queryRunner.getQueryRows(0, summary.rowCount, this._currentData.batchId, this._currentData.resultId).then(d => {
						let rows = d.rows;
						let columns = summary.columnInfo.map(c => c.columnName);
						this.setData(rows, columns);
					});
				}
			}
			// if we have the necessary information but the information isn't available yet,
			// we should be smart and retrying when the information might be available
		}
	}

	private buildOptions() {
		// The first element in the disposables list is for the chart type: the master dropdown that controls other option controls.
		// whiling rebuilding the options we should not dispose it, otherwise it would react to the theme change event
		if (this.optionDisposables.length > 1) { // this logic needs to be rewritten
			dispose(this.optionDisposables.slice(1));
			this.optionDisposables.splice(1);
		}

		this.optionMap = {
			'type': this.optionMap['type']
		};
		DOM.clearNode(this.typeControls);

		this.updateActionbar();
		this.getChartTypeOptions().map(o => {
			this.createOption(o, this.typeControls);
		});
		if (this.insight) {
			this.insight.options = this._options;
		}
		this.verifyOptions();
	}

	private verifyOptions() {
		this.updateActionbar();
		for (let key in this.optionMap) {
			if (this.optionMap.hasOwnProperty(key)) {
				let option = find(this.getChartTypeOptions(), e => e.configEntry === key);
				if (option && option.if) {
					if (option.if(this._options)) {
						DOM.show(this.optionMap[key].element);
					} else {
						DOM.hide(this.optionMap[key].element);
					}
				}
			}
		}
	}

	private getChartTypeOptions(): IChartOption[] {
		let options = ChartOptions[this._options.type];
		if (!options) {
			throw new Error(nls.localize('charting.unsupportedType', "Chart type '{0}' is not supported.", this._options.type));
		}
		return options;
	}

	private updateActionbar() {
		let actions: ITaskbarContent[];
		if (this.insight && this.insight.isCopyable) {
			this.taskbar.context = { insight: this.insight.insight, options: this._options };
			actions = [
				{ action: this._copyAction },
				{ action: this._saveAction }
			];
		} else {
			actions = [];
		}
		if (this._isQueryEditorChart) {
			actions.unshift({ action: this._createInsightAction });
		} else {
			actions.push({ action: this._configureChartAction });
		}
		this.taskbar.setContent(actions);
	}

	private createOption(option: IChartOption, container: HTMLElement) {
		const label = DOM.$('div.option-label');
		label.innerText = option.label;
		const optionContainer = DOM.$('div.option-container');
		const optionInput = DOM.$('div.option-input');
		optionContainer.appendChild(label);
		optionContainer.appendChild(optionInput);
		let setFunc: (val) => void;
		let value = this.state ? this.state.options[option.configEntry] || option.default : option.default;
		switch (option.type) {
			case ControlType.checkbox:
				let checkbox = new Checkbox(optionInput, {
					label: '',
					ariaLabel: option.label,
					checked: value,
					onChange: () => {
						if (this._options[option.configEntry] !== checkbox.checked) {
							this._options[option.configEntry] = checkbox.checked;
							if (this.insight) {
								this.insight.options = this._options;
							}
						}
					}
				});
				setFunc = (val: boolean) => {
					checkbox.checked = val;
				};
				break;
			case ControlType.combo:
				//pass options into changeAltNames in order for SelectBox to show user-friendly names.
				let dropdown = new SelectBox(option.displayableOptions || this.changeToAltNames(option.options), undefined, this._contextViewService);
				dropdown.setAriaLabel(option.label);
				dropdown.select(option.options.indexOf(value));
				dropdown.render(optionInput);
				dropdown.onDidSelect(e => {
					if (this._options[option.configEntry] !== option.options[e.index]) {
						this._options[option.configEntry] = option.options[e.index];
						if (this.insight) {
							this.insight.options = this._options;
						}
					}
				});
				setFunc = (val: string) => {
					if (!isUndefinedOrNull(val)) {
						dropdown.select(option.options.indexOf(val));
					}
				};
				this.optionDisposables.push(attachSelectBoxStyler(dropdown, this._themeService));
				break;
			case ControlType.input:
				let input = new InputBox(optionInput, this._contextViewService);
				input.setAriaLabel(option.label);
				input.value = value || '';
				input.onDidChange(e => {
					if (this._options[option.configEntry] !== e) {
						this._options[option.configEntry] = e;
						if (this.insight) {
							this.insight.options = this._options;
						}
					}
				});
				setFunc = (val: string) => {
					if (!isUndefinedOrNull(val)) {
						input.value = val;
					}
				};
				this.optionDisposables.push(attachInputBoxStyler(input, this._themeService));
				break;
			case ControlType.numberInput:
				let numberInput = new InputBox(optionInput, this._contextViewService, { type: 'number' });
				numberInput.setAriaLabel(option.label);
				numberInput.value = value || '';
				numberInput.onDidChange(e => {
					if (this._options[option.configEntry] !== Number(e)) {
						this._options[option.configEntry] = Number(e);
						if (this.insight) {
							this.insight.options = this._options;
						}
					}
				});
				setFunc = (val: string) => {
					if (!isUndefinedOrNull(val)) {
						numberInput.value = val;
					}
				};
				this.optionDisposables.push(attachInputBoxStyler(numberInput, this._themeService));
				break;
			case ControlType.dateInput:
				let dateInput = new InputBox(optionInput, this._contextViewService, { type: 'datetime-local' });
				dateInput.setAriaLabel(option.label);
				dateInput.value = value || '';
				dateInput.onDidChange(e => {
					if (this._options[option.configEntry] !== e) {
						this._options[option.configEntry] = e;
						if (this.insight) {
							this.insight.options = this._options;
						}
					}
				});
				setFunc = (val: string) => {
					if (!isUndefinedOrNull(val)) {
						dateInput.value = val;
					}
				};
				this.optionDisposables.push(attachInputBoxStyler(dateInput, this._themeService));
				break;
		}
		this.optionMap[option.configEntry] = { element: optionContainer, set: setFunc };
		container.appendChild(optionContainer);
		this._options[option.configEntry] = value;
	}

	public set state(val: ChartState) {
		this._state = val;
		this.options = this._state.options;
		if (this._state.dataId) {
			this.chart(this._state.dataId);
		}
	}

	public get state(): ChartState {
		return this._state;
	}

	public get options(): IInsightOptions {
		return this._options;
	}

	public set options(newOptions: IInsightOptions) {
		if (newOptions) {
			for (let key in newOptions) {
				if (newOptions.hasOwnProperty(key) && this.optionMap[key]) {
					this._options[key] = newOptions[key];
					this.optionMap[key].set(newOptions[key]);
				}
			}
		}
	}
}
