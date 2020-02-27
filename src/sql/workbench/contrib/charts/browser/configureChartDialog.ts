/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ChartOptions, IChartOption, ControlType } from './chartOptions';
import * as DOM from 'vs/base/browser/dom';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { InputBox } from 'vs/base/browser/ui/inputbox/inputBox';
import { IDisposable, dispose } from 'vs/base/common/lifecycle';
import { attachSelectBoxStyler, attachInputBoxStyler, attachButtonStyler } from 'vs/platform/theme/common/styler';
import { IThemeService, ITheme } from 'vs/platform/theme/common/themeService';
import { isUndefinedOrNull } from 'vs/base/common/types';
import { Checkbox } from 'sql/base/browser/ui/checkbox/checkbox';
import { IInsightOptions, ChartType } from 'sql/workbench/contrib/charts/common/interfaces';
import { ChartState } from 'sql/workbench/common/editor/query/chartState';
import { localize } from 'vs/nls';
import { find } from 'vs/base/common/arrays';
import { ChartView } from 'sql/workbench/contrib/charts/browser/chartView';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { IWorkbenchLayoutService } from 'vs/workbench/services/layout/browser/layoutService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';

//Map used to store names and alternative names for chart types.
//This is mainly used for comparison when options are parsed into the constructor.
const altNameHash: { [oldName: string]: string } = {
	'horizontalBar': localize('horizontalBarAltName', "Horizontal Bar"),
	'bar': localize('barAltName', "Bar"),
	'line': localize('lineAltName', "Line"),
	'pie': localize('pieAltName', "Pie"),
	'scatter': localize('scatterAltName', "Scatter"),
	'timeSeries': localize('timeSeriesAltName', "Time Series"),
	'image': localize('imageAltName', "Image"),
	'count': localize('countAltName', "Count"),
	'table': localize('tableAltName', "Table"),
	'doughnut': localize('doughnutAltName', "Doughnut")
};

export class ConfigureChartDialog extends Modal {
	private optionsControl: HTMLElement;
	private typeControls: HTMLElement;

	private options: IInsightOptions = {
		type: ChartType.Bar
	};

	private optionDisposables: IDisposable[] = [];
	private optionMap: { [x: string]: { element: HTMLElement; set: (val) => void } } = {};
	private _state: ChartState;

	constructor(
		title: string,
		name: string,
		private _chart: ChartView,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IThemeService themeService: IThemeService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(title, name, telemetryService, layoutService, clipboardService, themeService, logService, textResourcePropertiesService, contextKeyService, undefined);
		this.options = this._chart.options;
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);

		let okButton = this.addFooterButton(localize('configureChart.ok', "Apply"), () => this.handleApply());
		let closeButton = this.addFooterButton(localize('optionsDialog.cancel', "Cancel"), () => this.cancel());
		// Theme styler
		attachButtonStyler(okButton, this._themeService);
		attachButtonStyler(closeButton, this._themeService);
		this._register(this._themeService.onThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this._themeService.getTheme());
	}

	protected renderBody(container: HTMLElement) {
		this.optionsControl = DOM.$('div.options-container');
		const generalControls = DOM.$('div.general-controls');
		this.typeControls = DOM.$('div.type-controls');
		this.optionsControl.appendChild(generalControls);
		this.optionsControl.appendChild(this.typeControls);

		container.appendChild(this.optionsControl);

		this.buildOptions();
	}

	protected layout(height?: number): void {
	}

	private updateTheme(theme: ITheme): void {
	}

	private handleApply(): boolean {
		this._chart.options = this.options;
		return true;
	}

	public cancel() {
		this.close();
	}

	public close() {
		this.dispose();
		this.hide();
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

		ChartOptions[this.options.type].map(o => {
			this.createOption(o, this.typeControls);
		});
		this.verifyOptions();
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
						if (this.options[option.configEntry] !== checkbox.checked) {
							this.options[option.configEntry] = checkbox.checked;
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
				dropdown.select(option.options.indexOf(value));
				dropdown.render(optionInput);
				dropdown.onDidSelect(e => {
					if (this.options[option.configEntry] !== option.options[e.index]) {
						this.options[option.configEntry] = option.options[e.index];
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
				input.value = value || '';
				input.onDidChange(e => {
					if (this.options[option.configEntry] !== e) {
						this.options[option.configEntry] = e;
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
				numberInput.value = value || '';
				numberInput.onDidChange(e => {
					if (this.options[option.configEntry] !== Number(e)) {
						this.options[option.configEntry] = Number(e);
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
				dateInput.value = value || '';
				dateInput.onDidChange(e => {
					if (this.options[option.configEntry] !== e) {
						this.options[option.configEntry] = e;
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
		this.options[option.configEntry] = value;
	}

	private verifyOptions() {
		for (let key in this.optionMap) {
			if (this.optionMap.hasOwnProperty(key)) {
				let option = find(ChartOptions[this.options.type], e => e.configEntry === key);
				if (option && option.if) {
					if (option.if(this.options)) {
						DOM.show(this.optionMap[key].element);
					} else {
						DOM.hide(this.optionMap[key].element);
					}
				}
			}
		}
	}

	public dispose() {
		dispose(this.optionDisposables);
		super.dispose();
	}

	public set state(val: ChartState) {
		this._state = val;
		if (this.state.options) {
			for (let key in this.state.options) {
				if (this.state.options.hasOwnProperty(key) && this.optionMap[key]) {
					this.options[key] = this.state.options[key];
					this.optionMap[key].set(this.state.options[key]);
				}
			}
		}
	}

	public get state(): ChartState {
		return this._state;
	}

	/**
	 * Function used to generate list of alternative names for use with SelectBox
	 * @param option - the original option names.
	 */
	private changeToAltNames(option: string[]): string[] {
		return option.map(o => altNameHash[o] || o);
	}
}
