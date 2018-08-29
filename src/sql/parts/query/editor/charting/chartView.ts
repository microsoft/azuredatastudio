/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./chartView';

import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Graph, IChartOptions } from './graph';
import QueryRunner from 'sql/parts/query/execution/queryRunner';
import { IInsightData } from 'sql/parts/dashboard/widgets/insights/interfaces';
import { ChartOptions, IChartOption, ControlType } from './chartOptions';
import { ChartType } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';

import { Dimension, $, addDisposableListener, EventType } from 'vs/base/browser/dom';
import { SelectBox } from 'vs/base/browser/ui/selectBox/selectBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { Builder } from 'vs/base/browser/builder';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { attachSelectBoxStyler, attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IThemeService } from 'vs/platform/theme/common/themeService';

declare class Proxy {
	constructor(object, handler);
}

export class ChartView implements IPanelView {
	private graph: Graph;
	private _queryRunner: QueryRunner;
	private _data: IInsightData;

	private optionsControl: HTMLElement;

	private options: IChartOptions = {
		type: ChartType.Bar
	};

	private container: HTMLElement;
	private typeControls: HTMLElement;

	private optionDisposables: IDisposable[] = [];

	constructor(
		@IContextViewService private _contextViewService: IContextViewService,
		@IThemeService private _themeService: IThemeService
	) {
		this.optionsControl = $('div.options-container');
		let generalControls = $('div.general-controls');
		this.optionsControl.appendChild(generalControls);
		this.typeControls = $('div.type-controls');
		this.optionsControl.appendChild(this.typeControls);

		let self = this;
		this.options = new Proxy(this.options, {
			get: function(target, key, receiver) {
				return Reflect.get(target, key, receiver);
			},
			set: function(target, key, value, receiver) {
				if (key === 'type') {
					let result = Reflect.set(target, key, value, receiver);
					self.buildOptions();
					return result;
				} else {
					return Reflect.set(target, key, value, receiver);
				}
			}
		}) as IChartOptions;

		ChartOptions.general.map(o => {
			this.createOption(o, generalControls);
		});
	}

	render(container: HTMLElement): void {
		if (!this.container) {
			this.container = $('div.chart-view-container');
			let graphContainer = $('div.graph-container');
			this.container.appendChild(graphContainer);
			this.container.appendChild(this.optionsControl);
			this.graph = new Graph(graphContainer, this.options, this._themeService);
		}

		if (this._data) {
			this.graph.data = this._data;
		} else {
			this.queryRunner = this._queryRunner;
		}

		container.appendChild(this.container);
	}

	layout(dimension: Dimension): void {
	}

	remove?(): void {
		// throw new Error("Method not implemented.");
	}

	public set queryRunner(runner: QueryRunner) {
		this._queryRunner = runner;
		if (this._queryRunner.hasCompleted) {
			let summary = this._queryRunner.batchSets[0].resultSetSummaries[0];
			this._queryRunner.getQueryRows(0, summary.rowCount, 0, 0).then(d => {
				this._data = {
					columns: summary.columnInfo.map(c => c.columnName),
					rows: d.resultSubset.rows.map(r => r.map(c => c.displayValue))
				};
				if (this.graph) {
					this.graph.data = this._data;
				}
			});
		}
	}


	private buildOptions() {
		dispose(this.optionDisposables);
		this.optionDisposables = [];
		new Builder(this.typeControls).clearChildren();
		ChartOptions[this.options.type].map(o => {
			this.createOption(o, this.typeControls);
		});
		if (this.graph) {
			this.graph.options = this.options;
		}
	}

	private createOption(option: IChartOption, container: HTMLElement) {
		let label = $('div');
		label.innerText = option.label;
		let optionContainer = $('div.option-container');
		optionContainer.appendChild(label);
		switch(option.type) {
			case ControlType.checkbox:
				let checkbox: HTMLInputElement = $('input', { 'type': 'checkbox' });
				optionContainer.appendChild($('input', { 'type': 'checkbox' }));
				checkbox.value = option.default;
				addDisposableListener(checkbox, EventType.CHANGE, () => {
					if (this.options[option.configEntry] !== checkbox.value) {
						this.options[option.configEntry] = checkbox.value;
						this.graph.options = this.options;
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
						this.graph.options = this.options;
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
						this.graph.options = this.options;
					}
				});
				this.optionDisposables.push(attachInputBoxStyler(input, this._themeService));
				break;
			case ControlType.numberInput:
				let numberInput = new InputBox(optionContainer, this._contextViewService, { type: 'number' });
				numberInput.value = option.default || '';
				numberInput.onDidChange(e => {
					if (this.options[option.configEntry] !== e) {
						this.options[option.configEntry] = e;
						this.graph.options = this.options;
					}
				});
				this.optionDisposables.push(attachInputBoxStyler(numberInput, this._themeService));
				break;
		}
		container.appendChild(optionContainer);
		this.options[option.configEntry] = option.default;
	}
}