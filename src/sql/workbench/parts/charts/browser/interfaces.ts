/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Dimension } from 'vs/base/browser/dom';
import { mixin } from 'sql/base/common/objects';
import * as types from 'vs/base/common/types';
import { Color } from 'vs/base/common/color';
import { IInsightOptions, InsightType, ChartType } from 'sql/workbench/parts/charts/common/interfaces';

export interface IPointDataSet {
	data: Array<{ x: number | string, y: number }>;
	label?: string;
	fill: boolean;
	backgroundColor?: Color;
}

export function customMixin(destination: any, source: any, overwrite?: boolean): any {
	if (types.isObject(source)) {
		mixin(destination, source, overwrite, customMixin);
	} else if (types.isArray(source)) {
		for (let i = 0; i < source.length; i++) {
			if (destination[i]) {
				mixin(destination[i], source[i], overwrite, customMixin);
			} else {
				destination[i] = source[i];
			}
		}
	} else {
		destination = source;
	}
	return destination;
}

export interface IInsightData {
	columns: Array<string>;
	rows: Array<Array<string>>;
}

export interface IInsight {
	options: IInsightOptions;
	data: IInsightData;
	readonly types: Array<InsightType | ChartType>;
	layout(dim: Dimension);
	dispose();
}

export interface IInsightCtor {
	new(container: HTMLElement, options: IInsightOptions, ...services: { _serviceBrand: undefined; }[]): IInsight;
	readonly types: Array<InsightType | ChartType>;
}
