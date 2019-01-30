/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./countInsight';

import { IInsight, InsightType } from './interfaces';
import { IInsightData } from 'sql/parts/dashboard/widgets/insights/interfaces';

import { $ } from 'vs/base/browser/dom';
import { Builder } from 'sql/base/browser/builder';

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
		new Builder(this.countImage).empty();

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
