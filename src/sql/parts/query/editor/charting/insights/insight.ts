/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { Graph } from './graphInsight';
import { ChartType, DataDirection, LegendPosition } from 'sql/parts/dashboard/widgets/insights/views/charts/chartInsight.component';
import { IInsightData } from 'sql/parts/dashboard/widgets/insights/interfaces';

import { Builder } from 'vs/base/browser/builder';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export interface IInsightOptions {
	type: InsightType | ChartType;
	dataDirection?: DataDirection;
	labelFirstColumn?: boolean;
	columnsAsLabels?: boolean;
	legendPosition?: LegendPosition;
	yAxisLabel?: string;
	yAxisMin?: number;
	yAxisMax?: number;
	xAxisLabel?: string;
	xAxisMin?: number;
	xAxisMax?: number;
	encoding?: string;
	imageFormat?: string;
}

export interface IInsight {
	options: IInsightOptions;
	data: IInsightData;
	readonly types: Array<InsightType | ChartType>;
	dispose();
}

export interface IInsightCtor {
	new (container: HTMLElement, options: IInsightOptions, ...services: { _serviceBrand: any; }[]): IInsight;
	readonly types: Array<InsightType | ChartType>;
}

export enum InsightType {
	image = 'image',
	table = 'table'
}

const defaultOptions: IInsightOptions = {
	type: ChartType.Bar,
	dataDirection: DataDirection.Horizontal
};


export class Insight {
	private insight: IInsight;

	private _options: IInsightOptions;
	private _data: IInsightData;

	constructor(
		private container: HTMLElement, options: IInsightOptions = defaultOptions,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		this.options = options;
		this.buildInsight();
	}

	public set options(val: IInsightOptions) {
		this._options = val;
		if (this.insight) {
			// check to see if we need to change the insight type
			if (!this.insight.types.includes(val.type)) {
				this.buildInsight();
			} else {
				this.insight.options = val;
			}
		}
	}

	public get options(): IInsightOptions {
		return this._options;
	}

	public set data(val: IInsightData) {
		this._data = val;
		if (this.insight) {
			this.insight.data = val;
		}
	}

	private buildInsight() {
		if (this.insight) {
			this.insight.dispose();
		}

		new Builder(this.container).empty();

		let ctor = this.findctor(this.options.type);

		if (ctor) {
			this.insight = this._instantiationService.createInstance(ctor, this.container, this.options);
			if (this._data) {
				this.insight.data = this._data;
			}
		}
	}

	private findctor(type: ChartType | InsightType): IInsightCtor {
		if (Graph.types.includes(type as ChartType)) {
			return Graph;
		}
		return undefined;
	}
}
