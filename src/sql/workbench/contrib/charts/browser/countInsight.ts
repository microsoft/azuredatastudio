/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/countInsight';

import { IInsight } from './interfaces';

import { $, clearNode } from 'vs/base/browser/dom';
import { InsightType } from 'sql/workbench/contrib/charts/common/interfaces';
import { IInsightData } from 'sql/platform/dashboard/browser/insightRegistry';

export class CountInsight implements IInsight {
	public options;
	public static readonly types = [InsightType.Count];
	public readonly types = CountInsight.types;

	private countImage: HTMLElement;

	constructor(container: HTMLElement, options: any) {
		this.countImage = $('div');
		container.appendChild(this.countImage);
	}

	public layout() { }

	set data(data: IInsightData) {
		clearNode(this.countImage);

		for (let i = 0; i < data.columns.length; i++) {
			let container = $('div.count-label-container');
			let label = $('span.label-container');
			label.innerText = data.columns[i];
			let value = $('span.value-container');
			value.innerText = data.rows[0][i];
			container.appendChild(label);
			container.appendChild(value);
			this.countImage.appendChild(container);
		}
	}

	dispose() {

	}
}
