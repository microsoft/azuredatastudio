/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./chartView';

import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Insight } from './insights/insight';
import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { IInsightData } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { ChartOptions, IChartOption, ControlType } from './chartOptions';
import { ChartType } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { IInsightOptions } from './insights/interfaces';
import { CopyAction, SaveImageAction, CreateInsightAction, IChartActionContext } from './actions';
import { Taskbar } from 'sql/base/browser/ui/taskbar/taskbar';

import { Dimension, $, getContentHeight, getContentWidth } from 'vs/base/browser/dom';
import { SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { IContextViewService, IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { Builder } from 'vs/base/browser/builder';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { attachSelectBoxStyler, attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

declare class Proxy {
	constructor(object, handler);
}

export class ChartView implements IPanelView {
	private insight: Insight;
	private _queryRunner: QueryRunner;
	private _data: IInsightData;
	private _currentData: { batchId: number, resultId: number };
	private taskbar: Taskbar;

	private _createInsightAction: CreateInsightAction;
	private _copyAction: CopyAction;
	private _saveAction: SaveImageAction;

	private options: IInsightOptions = {
		type: ChartType.Bar
	};

	/** parent container */
	private container: HTMLElement;
	/** container for the options controls */
	private optionsControl: HTMLElement;
	/** container for type specific controls */
	private typeControls: HTMLElement;
	/** container for the insight */
	private insightContainer: HTMLElement;
	/** container for the action bar */
	private taskbarContainer: HTMLElement;
	/** container for the charting (includes insight and options) */
	private chartingContainer: HTMLElement;

	private optionDisposables: IDisposable[] = [];
	private optionMap: { [x: string]: HTMLElement } = {};

	constructor(
		@IContextViewService private _contextViewService: IContextViewService,
		@IThemeService private _themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextMenuService contextMenuService: IContextMenuService
	) {
		this.taskbarContainer = $('div.taskbar-container');
		this.taskbar = new Taskbar(this.taskbarContainer, contextMenuService);
		this.optionsControl = $('div.options-container');
		let generalControls = $('div.general-controls');
		this.optionsControl.appendChild(generalControls);
		this.typeControls = $('div.type-controls');
		this.optionsControl.appendChild(this.typeControls);

		this._createInsightAction = this._instantiationService.createInstance(CreateInsightAction);
		this._copyAction = this._instantiationService.createInstance(CopyAction);
		this._saveAction = this._instantiationService.createInstance(SaveImageAction);

		this.taskbar.setContent([{ action: this._createInsightAction }]);

		let self = this;
		this.options = new Proxy(this.options, {
			get: function (target, key, receiver) {
				return Reflect.get(target, key, receiver);
			},
			set: function (target, key, value, receiver) {
				let change = false;
				if (target[key] !== value) {
					change = true;
				}

				let result = Reflect.set(target, key, value, receiver);

				if (change) {
					self.taskbar.context = <IChartActionContext>{ options: self.options, insight: self.insight ? self.insight.insight : undefined };
					if (key === 'type') {
						self.buildOptions();
					} else {
						self.verifyOptions();
					}
				}

				return result;
			}
		}) as IInsightOptions;

		ChartOptions.general.map(o => {
			this.createOption(o, generalControls);
		});
		this.buildOptions();
	}

	render(container: HTMLElement): void {
		if (!this.container) {
			this.container = $('div.chart-parent-container');
			this.insightContainer = $('div.insight-container');
			this.chartingContainer = $('div.charting-container');
			this.container.appendChild(this.taskbarContainer);
			this.container.appendChild(this.chartingContainer);
			this.chartingContainer.appendChild(this.insightContainer);
			this.chartingContainer.appendChild(this.optionsControl);
			this.insight = new Insight(this.insightContainer, this.options, this._instantiationService);
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
		this._currentData = dataId;
		this.shouldGraph();
	}

	layout(dimension: Dimension): void {
		if (this.insight) {
			this.insight.layout(new Dimension(getContentWidth(this.insightContainer), getContentHeight(this.insightContainer)));
		}
	}

	public set queryRunner(runner: QueryRunner) {
		this._queryRunner = runner;
		this.shouldGraph();
	}

	private shouldGraph() {
		// Check if we have the necessary information
		if (this._currentData && this._queryRunner) {
			// check if we are being asked to graph something that is available
			let batch = this._queryRunner.batchSets[this._currentData.batchId];
			if (batch) {
				let summary = batch.resultSetSummaries[this._currentData.resultId];
				if (summary) {
					this._queryRunner.getQueryRows(0, summary.rowCount, 0, 0).then(d => {
						this._data = {
							columns: summary.columnInfo.map(c => c.columnName),
							rows: d.resultSubset.rows.map(r => r.map(c => c.displayValue))
						};
						if (this.insight) {
							this.insight.data = this._data;
						}
					});
				}
			}
			// if we have the necessary information but the information isn't avaiable yet,
			// we should be smart and retrying when the information might be available
		}
	}

	private buildOptions() {
		dispose(this.optionDisposables);
		this.optionDisposables = [];
		this.optionMap = {};
		new Builder(this.typeControls).clearChildren();

		this.updateActionbar();
		ChartOptions[this.options.type].map(o => {
			this.createOption(o, this.typeControls);
		});
		if (this.insight) {
			this.insight.options = this.options;
		}
		this.verifyOptions();
	}

	private verifyOptions() {
		this.updateActionbar();
		for (let key in this.optionMap) {
			if (this.optionMap.hasOwnProperty(key)) {
				let option = ChartOptions[this.options.type].find(e => e.configEntry === key);
				if (option && option.if) {
					if (option.if(this.options)) {
						new Builder(this.optionMap[key]).show();
					} else {
						new Builder(this.optionMap[key]).hide();
					}
				}
			}
		}
	}

	private updateActionbar() {
		if (this.insight && this.insight.isCopyable) {
			this.taskbar.setContent([
				{ action: this._createInsightAction },
				{ action: this._copyAction },
				{ action: this._saveAction }
			]);
		} else {
			this.taskbar.setContent([{ action: this._createInsightAction }]);
		}
	}

	private createOption(option: IChartOption, container: HTMLElement) {
		let label = $('div');
		label.innerText = option.label;
		let optionContainer = $('div.option-container');
		optionContainer.appendChild(label);
		switch (option.type) {
			case ControlType.checkbox:
				let checkbox = new Checkbox(optionContainer, {
					label: '',
					ariaLabel: option.label,
					checked: option.default,
					onChange: () => {
						if (this.options[option.configEntry] !== checkbox.checked) {
							this.options[option.configEntry] = checkbox.checked;
							this.insight.options = this.options;
						}
					}
				});
				break;
			case ControlType.combo:
				let dropdown = new SelectBox(option.displayableOptions || option.options, 0, this._contextViewService);
				dropdown.select(option.options.indexOf(option.default));
				dropdown.render(optionContainer);
				dropdown.onDidSelect(e => {
					if (this.options[option.configEntry] !== option.options[e.index]) {
						this.options[option.configEntry] = option.options[e.index];
						this.insight.options = this.options;
					}
				});
				this.optionDisposables.push(attachSelectBoxStyler(dropdown, this._themeService));
				break;
			case ControlType.input:
				let input = new InputBox(optionContainer, this._contextViewService);
				input.value = option.default || '';
				input.onDidChange(e => {
					if (this.options[option.configEntry] !== e) {
						this.options[option.configEntry] = e;
						this.insight.options = this.options;
					}
				});
				this.optionDisposables.push(attachInputBoxStyler(input, this._themeService));
				break;
			case ControlType.numberInput:
				let numberInput = new InputBox(optionContainer, this._contextViewService, { type: 'number' });
				numberInput.value = option.default || '';
				numberInput.onDidChange(e => {
					if (this.options[option.configEntry] !== Number(e)) {
						this.options[option.configEntry] = Number(e);
						this.insight.options = this.options;
					}
				});
				this.optionDisposables.push(attachInputBoxStyler(numberInput, this._themeService));
				break;
		}
		this.optionMap[option.configEntry] = optionContainer;
		container.appendChild(optionContainer);
		this.options[option.configEntry] = option.default;
	}
}