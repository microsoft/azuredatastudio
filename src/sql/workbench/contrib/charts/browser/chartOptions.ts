/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { Registry } from 'vs/platform/registry/common/platform';

import { Extensions, IInsightRegistry } from 'sql/platform/dashboard/browser/insightRegistry';
import { IInsightOptions, DataDirection, DataType, LegendPosition, ChartType, InsightType } from 'sql/workbench/contrib/charts/common/interfaces';
import { values } from 'vs/base/common/collections';

const insightRegistry = Registry.as<IInsightRegistry>(Extensions.InsightContribution);

export enum ControlType {
	combo,
	numberInput,
	input,
	checkbox,
	dateInput
}

export interface IChartOption {
	label: string;
	type: ControlType;
	configEntry: string;
	default: any;
	options?: any[];
	displayableOptions?: string[];
	if?: (options: IInsightOptions) => boolean;
}

export interface IChartOptions {
	general: Array<IChartOption>;
	[x: string]: Array<IChartOption>;
}

const dataDirectionOption: IChartOption = {
	label: localize('dataDirectionLabel', "Data Direction"),
	type: ControlType.combo,
	displayableOptions: [localize('verticalLabel', "Vertical"), localize('horizontalLabel', "Horizontal")],
	options: [DataDirection.Vertical, DataDirection.Horizontal],
	configEntry: 'dataDirection',
	default: DataDirection.Horizontal
};

const columnsAsLabelsInput: IChartOption = {
	label: localize('columnsAsLabelsLabel', "Use column names as labels"),
	type: ControlType.checkbox,
	configEntry: 'columnsAsLabels',
	default: true,
	if: (options: IInsightOptions) => {
		return options.dataDirection === DataDirection.Vertical && options.dataType !== DataType.Point;
	}
};

const labelFirstColumnInput: IChartOption = {
	label: localize('labelFirstColumnLabel', "Use first column as row label"),
	type: ControlType.checkbox,
	configEntry: 'labelFirstColumn',
	default: false,
	if: (options: IInsightOptions) => {
		return options.dataDirection === DataDirection.Horizontal && options.dataType !== DataType.Point;
	}
};

const legendInput: IChartOption = {
	label: localize('legendLabel', "Legend Position"),
	type: ControlType.combo,
	options: values(LegendPosition),
	configEntry: 'legendPosition',
	default: LegendPosition.Top
};

const yAxisLabelInput: IChartOption = {
	label: localize('yAxisLabel', "Y Axis Label"),
	type: ControlType.input,
	configEntry: 'yAxisLabel',
	default: undefined
};

const yAxisMinInput: IChartOption = {
	label: localize('yAxisMinVal', "Y Axis Minimum Value"),
	type: ControlType.numberInput,
	configEntry: 'yAxisMin',
	default: undefined
};

const yAxisMaxInput: IChartOption = {
	label: localize('yAxisMaxVal', "Y Axis Maximum Value"),
	type: ControlType.numberInput,
	configEntry: 'yAxisMax',
	default: undefined
};

const xAxisLabelInput: IChartOption = {
	label: localize('xAxisLabel', "X Axis Label"),
	type: ControlType.input,
	configEntry: 'xAxisLabel',
	default: undefined
};

const xAxisMinInput: IChartOption = {
	label: localize('xAxisMinVal', "X Axis Minimum Value"),
	type: ControlType.numberInput,
	configEntry: 'xAxisMin',
	default: undefined
};

const xAxisMaxInput: IChartOption = {
	label: localize('xAxisMaxVal', "X Axis Maximum Value"),
	type: ControlType.numberInput,
	configEntry: 'xAxisMax',
	default: undefined
};

const xAxisMinDateInput: IChartOption = {
	label: localize('xAxisMinDate', "X Axis Minimum Date"),
	type: ControlType.dateInput,
	configEntry: 'xAxisMin',
	default: undefined
};

const xAxisMaxDateInput: IChartOption = {
	label: localize('xAxisMaxDate', "X Axis Maximum Date"),
	type: ControlType.dateInput,
	configEntry: 'xAxisMax',
	default: undefined
};

const dataTypeInput: IChartOption = {
	label: localize('dataTypeLabel', "Data Type"),
	type: ControlType.combo,
	options: [DataType.Number, DataType.Point],
	displayableOptions: [localize('numberLabel', "Number"), localize('pointLabel', "Point")],
	configEntry: 'dataType',
	default: DataType.Number
};

export const ChartOptions: IChartOptions = {
	general: [
		{
			label: localize('chartTypeLabel', "Chart Type"),
			type: ControlType.combo,
			options: insightRegistry.getAllIds(),
			configEntry: 'type',
			default: ChartType.Bar
		}
	],
	[ChartType.Line]: [
		dataTypeInput,
		columnsAsLabelsInput,
		labelFirstColumnInput,
		yAxisLabelInput,
		xAxisLabelInput,
		legendInput
	],
	[ChartType.Scatter]: [
		legendInput,
		yAxisLabelInput,
		xAxisLabelInput
	],
	[ChartType.TimeSeries]: [
		legendInput,
		yAxisLabelInput,
		yAxisMinInput,
		yAxisMaxInput,
		xAxisLabelInput,
		xAxisMinDateInput,
		xAxisMaxDateInput,
	],
	[ChartType.Bar]: [
		dataDirectionOption,
		columnsAsLabelsInput,
		labelFirstColumnInput,
		legendInput,
		yAxisLabelInput,
		yAxisMinInput,
		yAxisMaxInput,
		xAxisLabelInput
	],
	[ChartType.HorizontalBar]: [
		dataDirectionOption,
		columnsAsLabelsInput,
		labelFirstColumnInput,
		legendInput,
		xAxisLabelInput,
		xAxisMinInput,
		xAxisMaxInput,
		yAxisLabelInput
	],
	[ChartType.Pie]: [
		dataDirectionOption,
		columnsAsLabelsInput,
		labelFirstColumnInput,
		legendInput
	],
	[ChartType.Doughnut]: [
		dataDirectionOption,
		columnsAsLabelsInput,
		labelFirstColumnInput,
		legendInput
	],
	[InsightType.Table]: [],
	[InsightType.Count]: [],
	[InsightType.Image]: [
		{
			configEntry: 'encoding',
			label: localize('encodingOption', "Encoding"),
			type: ControlType.input,
			default: 'hex'
		},
		{
			configEntry: 'imageFormat',
			label: localize('imageFormatOption', "Image Format"),
			type: ControlType.input,
			default: 'jpeg'
		}
	]
};
