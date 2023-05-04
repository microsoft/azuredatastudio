/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { Component, Input, Inject, ChangeDetectorRef, forwardRef, OnDestroy, ElementRef, AfterViewInit, ViewChild } from '@angular/core';

import * as azdata from 'azdata';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { Chart } from 'sql/base/browser/ui/chart/chart.component';
import { ILogService } from 'vs/platform/log/common/log';

@Component({
	selector: 'modelview-chart',
	templateUrl: decodeURI(require.toUrl('./chart.component.html'))
})

export default class ChartComponent<T extends azdata.ChartType> extends ComponentBase<azdata.ChartComponentProperties<T>> implements IComponent, OnDestroy, AfterViewInit {

	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChild(Chart) private _chart: Chart<T>;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.baseInit();
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (this.chartType) {
			this._chart.type = this.chartType;
		}
		if (this.chartData) {
			this._chart.data = this.chartData;
		}
	}

	public get chartType(): azdata.ChartType | undefined {
		return this.getProperties().chartType ?? undefined;
	}

	public get chartData(): azdata.ChartData[T] | undefined {
		return this.getProperties().chartData ?? undefined;
	}

	public setLayout(layout: any): void {
		this.layout();
	}
}
