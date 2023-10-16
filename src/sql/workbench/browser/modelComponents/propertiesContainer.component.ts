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
import { ILogService } from 'vs/platform/log/common/log';
import { PROPERTIES_CONTAINER_PROPERTY_NAME, PROPERTIES_CONTAINER_PROPERTY_VALUE } from 'sql/workbench/common/theme';

@Component({
	selector: `modelview-properties-container`,
	template: `
		<properties-container> </properties-container>
	`
})
export default class PropertiesContainerComponent extends ComponentBase<azdata.PropertiesContainerComponentProperties> implements IComponent, OnDestroy {
	@Input() descriptor: IComponentDescriptor;
	@Input() modelStore: IModelStore;

	@ViewChild(PropertiesContainer) private _propertiesContainer: PropertiesContainer;
	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) changeRef: ChangeDetectorRef,
		@Inject(forwardRef(() => ElementRef)) el: ElementRef,
		@Inject(ILogService) logService: ILogService
	) {
		super(changeRef, el, logService);
	}

	ngAfterViewInit(): void {
		this.baseInit();
	}

	setLayout(layout: any): void {
		this.layout();
	}

	public override setProperties(properties: { [key: string]: any; }): void {
		super.setProperties(properties);
		this._propertiesContainer.propertyItems = this.propertyItems;
		this._propertiesContainer.showToggleButton = this.showToggleButton;
	}

	public get propertyItems(): PropertyItem[] {
		return this.getPropertyOrDefault<azdata.PropertiesContainerItem[]>((props) => props.propertyItems, []);
	}

	public set propertyItems(newValue: azdata.PropertiesContainerItem[]) {
		this.setPropertyFromUI<azdata.PropertiesContainerItem[]>((props, value) => props.propertyItems = value, newValue);
		this._propertiesContainer.propertyItems = newValue;
	}

	public get showToggleButton(): boolean {
		return this.getPropertyOrDefault<boolean>((props) => props.showToggleButton, false);
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
