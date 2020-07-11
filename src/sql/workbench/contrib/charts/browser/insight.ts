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
import { find } from 'vs/base/common/arrays';
import { IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';

const defaultOptions: IInsightOptions = {
	type: ChartType.Bar,
	dataDirection: DataDirection.Horizontal
};

export class Insight {
	private _insight: IInsight;

	public get insight(): IInsight {
		return this._insight;
	}

	private _options: IInsightOptions;
	private _data: IInsightData;
	private dim: Dimension;

	constructor(
		private container: HTMLElement, options: IInsightOptions = defaultOptions,
		@IInstantiationService private _instantiationService: IInstantiationService
	) {
		this.options = options;
		this.buildInsight();
	}

	public layout(dim: Dimension) {
		this.dim = dim;
		this.insight.layout(dim);
	}

	public set options(val: IInsightOptions) {
		this._options = deepClone(val);
		if (this.insight) {
			// check to see if we need to change the insight type
			if (!find(this.insight.types, x => x === this.options.type)) {
				this.buildInsight();
			} else {
				this.insight.options = this.options;
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

		clearNode(this.container);

		let ctor = this.findctor(this.options.type);

		if (ctor) {
			this._insight = this._instantiationService.createInstance(ctor, this.container, this.options);
			this.insight.layout(this.dim);
			if (this._data) {
				this.insight.data = this._data;
			}
		}
	}
	public get isCopyable(): boolean {
		return !!find(Graph.types, x => x === this.options.type as ChartType);
	}

	private findctor(type: ChartType | InsightType): IInsightCtor {
		if (find(Graph.types, x => x === type as ChartType)) {
			return Graph as IInsightCtor;
		} else if (find(ImageInsight.types, x => x === type as InsightType)) {
			return ImageInsight as IInsightCtor;
		} else if (find(TableInsight.types, x => x === type as InsightType)) {
			return TableInsight as IInsightCtor;
		} else if (find(CountInsight.types, x => x === type as InsightType)) {
			return CountInsight as IInsightCtor;
		}
		return undefined;
	}
}
