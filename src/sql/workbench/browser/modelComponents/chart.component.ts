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

export default class ChartComponent<TConfig extends azdata.ChartConfiguration> extends ComponentBase<azdata.ChartComponentProperties<TConfig>> implements IComponent, OnDestroy, AfterViewInit {

	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChild(Chart) private _chart: Chart<TConfig>;

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

		// chartId and chartType must be set before configuration because they're necessary for the draw that setting configuration triggers

		if (this.chartId) {
			this._chart.chartId = this.chartId;
		}

		if (this.chartType) {
			this._chart.type = this.chartType;
		}

		if (this.configuration) {
			this._chart.configuration = this.configuration;
		}

		if (this.height) {
			this._chart.height = this.height;
		}

		if (this.width) {
			this._chart.width = this.width;
		}
	}

	public get chartType(): azdata.ChartType | undefined {
		return this.getProperties().chartType ?? undefined;
	}

	public get configuration(): TConfig {
		return this.getProperties().configuration;
	}

	public get chartId(): string {
		return this.getProperties().chartId;
	}

	public setLayout(layout: any): void {
		this.layout();
	}
}
