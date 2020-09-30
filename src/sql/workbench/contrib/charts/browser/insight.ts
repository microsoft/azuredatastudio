/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Graph } from './graphInsight';
import { ImageInsight } from './imageInsight';
import { TableInsight } from './tableInsight';
import { IInsight, IInsightCtor } from './interfaces';
import { CountInsight } from './countInsight';

import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { Dimension, clearNode } from 'vs/base/browser/dom';
import { deepClone } from 'vs/base/common/objects';
import { IInsightOptions, ChartType, DataDirection, InsightType } from 'sql/workbench/contrib/charts/common/interfaces';
import { IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';

const defaultOptions: IInsightOptions = {
	type: ChartType.Bar,
	dataDirection: DataDirection.Horizontal
};

export class Insight {
	private _insight?: IInsight;

	public get insight(): IInsight | undefined {
		return this._insight;
	}

	private _options?: IInsightOptions;
	private _data?: IInsightData;
	private dim?: Dimension;

	constructor(
		private container: HTMLElement, options: IInsightOptions = defaultOptions,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		this.options = options;
		this.buildInsight();
	}

	public layout(dim: Dimension) {
		this.dim = dim;
		if (this.insight) {
			this.insight.layout(dim);
		}
	}

	public set options(val: IInsightOptions | undefined) {
		this._options = deepClone(val);
		if (this.insight && this.options) {
			// check to see if we need to change the insight type
			if (!this.insight.types.find(x => x === this.options!.type)) {
				this.buildInsight();
			} else {
				this.insight.options = this.options;
			}
		}
	}

	public get options(): IInsightOptions | undefined {
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

		clearNode(this.container);

		if (this.options) {

			const ctor = this.findctor(this.options.type);

			if (ctor) {
				this._insight = this._instantiationService.createInstance(ctor, this.container, this.options);
				if (this.dim) {
					this.insight!.layout(this.dim);
				}
				if (this._data) {
					this.insight!.data = this._data;
				}
			}
		}
	}
	public get isCopyable(): boolean {
		return !!this.options && !!Graph.types.find(x => x === this.options!.type as ChartType);
	}

	private findctor(type: ChartType | InsightType): IInsightCtor | undefined {
		if (Graph.types.find(x => x === type as ChartType)) {
			return Graph as IInsightCtor;
		} else if (ImageInsight.types.find(x => x === type as InsightType)) {
			return ImageInsight as IInsightCtor;
		} else if (TableInsight.types.find(x => x === type as InsightType)) {
			return TableInsight as IInsightCtor;
		} else if (CountInsight.types.find(x => x === type as InsightType)) {
			return CountInsight as IInsightCtor;
		}
		return undefined;
	}
}
