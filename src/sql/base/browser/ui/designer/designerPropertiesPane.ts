/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CreateComponentFunc, DesignerUIComponent, SetComponentValueFunc } from 'sql/base/browser/ui/designer/designer';
import { DesignerViewModel, DesignerEditIdentifier, DesignerDataPropertyInfo, InputBoxProperties, NameProperty } from 'sql/base/browser/ui/designer/interfaces';
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

	constructor(container: HTMLElement, private _createComponent: CreateComponentFunc, private _setComponentValue: SetComponentValueFunc, private _styleComponent: (component: DesignerUIComponent) => void) {
		const titleContainer = container.appendChild(DOM.$('.title-container'));
		this._titleElement = titleContainer.appendChild(DOM.$('div'));
		this._contentElement = container.appendChild(DOM.$('.properties-content.components-grid'));
		this._titleElement.innerText = localize('tableDesigner.propertiesPaneTitle', "Properties");
	}

	public get context(): PropertiesPaneObjectContext | undefined {
		return this._currentContext;
	}

	public clear(): void {
		this._componentMap.forEach((value) => {
			value.component.dispose();
		});
		this._componentMap.clear();
		DOM.clearNode(this._contentElement);
		this._currentContext = undefined;
	}

	public style() {
		this._componentMap.forEach((value) => {
			this._styleComponent(value.component);
		});
	}

	public show(item: ObjectInfo): void {
		if (!equals(item.context, this._currentContext)) {
			this.clear();
			this._currentContext = item.context;
			item.components.forEach((value) => {
				// todo: handle table type in properties pane
				if (value.componentType !== 'table') {
					const editIdentifier: DesignerEditIdentifier = this._currentContext === 'root' ? value.propertyName : {
						parentProperty: this._currentContext.parentProperty,
						index: this._currentContext.index,
						property: value.propertyName
					};
					const component = this._createComponent(this._contentElement, value, editIdentifier);
					this._componentMap.set(value.propertyName, {
						component: component,
						defintion: value
					});
				}
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
