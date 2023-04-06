/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartsModule } from 'ng2-charts';
import { DoughnutChart } from 'sql/base/browser/ui/chart/doughnutChart/doughnutChart.component';


@NgModule({
	declarations: [
		DoughnutChart
	],
	imports: [
		CommonModule,
		ChartsModule
	],
	exports: [DoughnutChart]
})
export class ChartModule { }
