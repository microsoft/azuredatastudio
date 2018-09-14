/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { ChartView } from './chartView';
import QueryRunner from 'sql/parts/query/execution/queryRunner';

import { localize } from 'vs/nls';
import { generateUuid } from 'vs/base/common/uuid';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class ChartTab implements IPanelTab {
	public readonly title = localize('chartTabTitle', 'Chart');
	public readonly identifier = 'ChartTab';
	public readonly view: ChartView;

	constructor(@IInstantiationService instantiationService: IInstantiationService) {
		this.view = instantiationService.createInstance(ChartView);
	}

	public set queryRunner(runner: QueryRunner) {
		this.view.queryRunner = runner;
	}

	public chart(dataId: { batchId: number, resultId: number}): void {
		this.view.chart(dataId);
	}
}
