/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CreateComponentFunc, DesignerUIComponent, SetComponentValueFunc } from 'sql/base/browser/ui/designer/designer';
import { DesignerComponentType, DesignerData, DesignerEditIdentifier, InputComponentData, NameProperty } from 'sql/base/browser/ui/designer/interfaces';
import * as DOM from 'vs/base/browser/dom';
import { localize } from 'vs/nls';

export type PropertiesPaneObjectContext = {
	parentProperty: string;
	index: number;
};

export interface ObjectInfo {
	context?: PropertiesPaneObjectContext
	type: string;
	components: DesignerComponentType[];
	data: DesignerData;
}

export class DesignerPropertiesPane {
	private _titleElement: HTMLElement;
	private _contentElement: HTMLElement;
	private _currentContext?: PropertiesPaneObjectContext;
	private _componentMap = new Map<string, { defintion: DesignerComponentType, component: DesignerUIComponent }>();

	constructor(container: HTMLElement, private _createComponent: CreateComponentFunc, private _setComponentValue: SetComponentValueFunc) {
		const titleContainer = container.appendChild(DOM.$('.title-container'));
		this._titleElement = titleContainer.appendChild(DOM.$('h2'));
		this._contentElement = container.appendChild(DOM.$('.content-container.components-grid'));
	}

	public show(item: ObjectInfo): void {
		if (item.context !== this._currentContext) {
			this._componentMap.forEach((value) => {
				value.component.dispose();
			});
			this._componentMap.clear();
			DOM.clearNode(this._contentElement);
			item.components.forEach((value) => {
				// Table component is not supported in the properties pane.
				if (value.type !== 'table') {
					const editIdentifier: DesignerEditIdentifier = this._currentContext === undefined ? value.property : {
						parentProperty: this._currentContext.parentProperty,
						index: this._currentContext.index,
						property: value.property
					};
					const component = this._createComponent(this._contentElement, value, editIdentifier, false);
					this._componentMap.set(value.property, {
						component: component,
						defintion: value
					});
				}
			});
		}
		const name = (<InputComponentData>item.data[NameProperty])?.value ?? '';
		this._titleElement.innerText = localize({
			key: 'tableDesigner.propertiesPaneTitle',
			comment: ['{0} is the place holder for object type', '{1} is the place holder for object name']
		}, "Properties - {0} {1}", item.type, name);
		this._componentMap.forEach((value) => {
			this._setComponentValue(value.defintion, value.component, item.data);
		});
	}
}
