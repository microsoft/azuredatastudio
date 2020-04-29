/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/propertiesContainer';
import {
	Component, Input, Inject, ChangeDetectorRef, forwardRef,
	ViewChild, ElementRef, OnDestroy
} from '@angular/core';

import * as azdata from 'azdata';
import { ComponentBase } from 'sql/workbench/browser/modelComponents/componentBase';
import { IComponent, IComponentDescriptor, IModelStore } from 'sql/platform/dashboard/browser/interfaces';
import { PropertiesContainer, PropertyItem } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';
import { registerThemingParticipant, IColorTheme, ICssStyleCollector } from 'vs/platform/theme/common/themeService';
import { PROPERTIES_CONTAINER_PROPERTY_NAME, PROPERTIES_CONTAINER_PROPERTY_VALUE } from 'vs/workbench/common/theme';

@Component({
	selector: `modelview-properties-container`,
	template: `
		<properties-container> </properties-container>
	`
})
export default class PropertiesContainerComponent extends ComponentBase implements IComponent, OnDestroy {
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

	setLayout(layout: any): void {
		this.layout();
	}

	public setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._propertiesContainer.propertyItems = this.propertyItems;
	}

	public get propertyItems(): PropertyItem[] {
		return this.getPropertyOrDefault<azdata.PropertiesContainerComponentProperties, azdata.PropertiesContainerItem[]>((props) => props.propertyItems, []);
	}

	public set propertyItems(newValue: azdata.PropertiesContainerItem[]) {
		this.setPropertyFromUI<azdata.PropertiesContainerComponentProperties, azdata.PropertiesContainerItem[]>((props, value) => props.propertyItems = value, newValue);
		this._propertiesContainer.propertyItems = newValue;
	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {

	const propertyNameColor = theme.getColor(PROPERTIES_CONTAINER_PROPERTY_NAME);
	if (propertyNameColor) {
		collector.addRule(`
		modelview-properties-container .propertyName,
		modelview-properties-container .splitter {
			color: ${propertyNameColor}
		}`);
	}

	const propertyValueColor = theme.getColor(PROPERTIES_CONTAINER_PROPERTY_VALUE);
	if (propertyValueColor) {
		collector.addRule(`modelview-properties-container .propertyValue {
			color: ${propertyValueColor}
		}`);
	}
});
