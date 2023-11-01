/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { ContainerBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, forwardRef, Inject, Input, OnDestroy, ViewChild } from '@angular/core';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { ILogService } from 'vs/platform/log/common/log';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ExecutionPlanFileView } from 'sql/workbench/contrib/executionPlan/browser/executionPlanFileView';
import { equals } from 'vs/base/common/objects';
import * as DOM from 'vs/base/browser/dom';

@Component({
	selector: 'modelview-executionplan',
	templateUrl: decodeURI(require.toUrl('./executionPlan.component.html'))
})

export default class ExecutionPlanComponent extends ContainerBase<any, azdata.ExecutionPlanComponentProperties> implements
	IComponent, OnDestroy, AfterViewInit {
	//no-op
	override ngAfterViewInit(): void {
	}
	//no-op
	override setLayout(layout: any): void {
	}

	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChild('executionPlanContainer') private _container: ElementRef;

	private _data: azdata.ExecutionPlanData | undefined;
	private _executionPlanFileView: ExecutionPlanFileView;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService,
		@Inject(IInstantiationService) private _instantiationService: IInstantiationService) {
		super(changeRef, el, logService);
	}

	ngOnInit(): void {
		this.baseInit();
		this._executionPlanFileView = this._instantiationService.createInstance(ExecutionPlanFileView, undefined);
		this._executionPlanFileView.render(this._container.nativeElement);
		if (this._data) {
			this.loadData(this._data);
		}
	}

	override ngOnDestroy(): void {
		this.baseDestroy();
		this._executionPlanFileView.dispose();
		this._data = undefined;
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		if (properties.data) {
			if (equals(this._data, properties.data) === false) {
				this._data = properties.data;
				this.clearExecutionPlan();
				this.loadData(this._data);
			}
		}
	}

	public clearExecutionPlan(): void {
		if (this._executionPlanFileView) {
			DOM.clearNode(this._container.nativeElement);
			this._executionPlanFileView.dispose();
			this._executionPlanFileView = this._instantiationService.createInstance(ExecutionPlanFileView, undefined);
			this._executionPlanFileView.render(this._container.nativeElement);
		}
	}

	public loadData(data: azdata.ExecutionPlanData): void {
		if (this._executionPlanFileView) {
			if ((<azdata.executionPlan.ExecutionPlanGraphInfo>this._data).graphFileContent !== undefined) {
				this._executionPlanFileView.loadGraphFile(<azdata.executionPlan.ExecutionPlanGraphInfo>this._data);
			} else {
				this._executionPlanFileView.addGraphs(<azdata.executionPlan.ExecutionPlanGraph[]>this._data);
			}
		}
	}
}
