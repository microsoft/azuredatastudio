/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IPanelTab } from 'sql/base/browser/ui/panel/panel';
import { ChartView } from './chartView';
import QueryRunner from 'sql/workbench/services/query/common/queryRunner';

import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export class ChartTab implements IPanelTab {
	public readonly title = localize('chartTabTitle', "Chart");
	public readonly identifier = 'ChartTab';
	public readonly view: ChartView;

	constructor(@IInstantiationService instantiationService: IInstantiationService) {
		this.view = instantiationService.createInstance(ChartView, true);
	}

	public set queryRunner(runner: QueryRunner) {
		this.view.queryRunner = runner;
	}

	public chart(dataId: { batchId: number, resultId: number }): void {
		this.view.chart(dataId);
	}

	public dispose() {
		this.view.dispose();
	}

	public clear() {
		this.view.clear();
	}
}
