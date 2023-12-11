/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart } from 'sql/base/browser/ui/chart/chart.component';


@NgModule({
	declarations: [
		Chart
	],
	imports: [
		CommonModule
	],
	exports: [Chart]
})
export class ChartModule { }
