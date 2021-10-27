/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CreateComponentsFunc, DesignerUIComponent, SetComponentValueFunc } from 'sql/base/browser/ui/designer/designer';
import { DesignerViewModel, DesignerDataPropertyInfo, InputBoxProperties, NameProperty } from 'sql/base/browser/ui/designer/interfaces';
import * as DOM from 'vs/base/browser/dom';
import { equals } from 'vs/base/common/objects';
import { localize } from 'vs/nls';

export type PropertiesPaneObjectContext = 'root' | {
	parentProperty: string;
	index: number;
};

export interface ObjectInfo {
	context: PropertiesPaneObjectContext;
	type: string;
	components: DesignerDataPropertyInfo[];
	viewModel: DesignerViewModel;
}

export class DesignerPropertiesPane {
	private _titleElement: HTMLElement;
	private _contentElement: HTMLElement;
	private _currentContext?: PropertiesPaneObjectContext;
	private _componentMap = new Map<string, { defintion: DesignerDataPropertyInfo, component: DesignerUIComponent }>();
	private _groupHeaders: HTMLElement[] = [];

	constructor(container: HTMLElement, private _createComponents: CreateComponentsFunc, private _setComponentValue: SetComponentValueFunc) {
		const titleContainer = container.appendChild(DOM.$('.title-container'));
		this._titleElement = titleContainer.appendChild(DOM.$('div'));
		this._contentElement = container.appendChild(DOM.$('.properties-content.components-grid'));
		this._titleElement.innerText = localize('tableDesigner.propertiesPaneTitle', "Properties");
	}

	public get groupHeaders(): HTMLElement[] {
		return this._groupHeaders;
	}

	public get componentMap(): Map<string, { defintion: DesignerDataPropertyInfo, component: DesignerUIComponent }> {
		return this._componentMap;
	}

	public get context(): PropertiesPaneObjectContext | undefined {
		return this._currentContext;
	}

	public clear(): void {
		this._componentMap.forEach((value) => {
			value.component.dispose();
		});
		this._componentMap.clear();
		this._groupHeaders = [];
		DOM.clearNode(this._contentElement);
		this._currentContext = undefined;
	}

	public show(item: ObjectInfo): void {
		if (!equals(item.context, this._currentContext)) {
			this.clear();
			this._currentContext = item.context;
			this._createComponents(this._contentElement, item.components, (property) => {
				return this._currentContext === 'root' ? property.propertyName : {
					parentProperty: this._currentContext.parentProperty,
					index: this._currentContext.index,
					property: property.propertyName
				};
			});
		}
		const name = (<InputBoxProperties>item.viewModel[NameProperty])?.value ?? '';
		this._titleElement.innerText = localize({
			key: 'tableDesigner.propertiesPaneTitleWithContext',
			comment: ['{0} is the place holder for object type', '{1} is the place holder for object name']
		}, "Properties - {0} {1}", item.type, name);
		this._componentMap.forEach((value) => {
			this._setComponentValue(value.defintion, value.component, item.viewModel);
		});
	}
}
