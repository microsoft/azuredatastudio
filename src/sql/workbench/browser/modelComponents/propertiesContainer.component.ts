/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy
} from '@angular/core';

import * as azdata from 'azdata';
import { ContainerBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { PropertiesContainer, DisplayProperty } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';

export interface DisplayPropertyConfig {
	displayName: string;
}

@Component({
	selector: `modelview-properties-container`,
	template: `
		<properties-container> </properties-container>
	`
})
export default class PropertiesContainerComponent extends ContainerBase<DisplayPropertyConfig> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChild(PropertiesContainer) private _propertiesContainer: PropertiesContainer;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
	) {
		super(changeRef, el);
	}

	ngOnInit(): void {
		this.baseInit();
	}

	ngOnDestroy(): void {
		this.baseDestroy();
	}

	setLayout(layout: any): void {
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._propertiesContainer.displayProperties = this.displayProperties;
		this._propertiesContainer.loading = this.loading;
	}

	public get loading(): boolean {
		return this.getPropertyOrDefault<azdata.PropertiesContainerComponentProperties, boolean>((props) => props.loading, true);
	}

	public set loading(newValue: boolean) {
		this.setPropertyFromUI<azdata.PropertiesContainerComponentProperties, boolean>((props, value) => props.loading = value, newValue);
		this._propertiesContainer.loading = newValue;
	}

	public get displayProperties(): DisplayProperty[] {
		return this.getPropertyOrDefault<azdata.PropertiesContainerComponentProperties, azdata.DisplayProperty[]>((props) => props.displayProperties, []);
	}

	public set displayProperties(newValue: azdata.DisplayProperty[]) {
		this.setPropertyFromUI<azdata.PropertiesContainerComponentProperties, azdata.DisplayProperty[]>((props, value) => props.displayProperties = value, newValue);
		this._propertiesContainer.displayProperties = newValue;
	}
}
