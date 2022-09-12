/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import { CreateComponentsFunc, DesignerUIComponent, SetComponentValueFunc } from 'sql/workbench/browser/designer/designer';
import { DesignerViewModel, DesignerDataPropertyInfo, DesignerPropertyPath } from 'sql/workbench/browser/designer/interfaces';
import * as DOM from 'vs/base/browser/dom';
import { equals } from 'vs/base/common/objects';
import { MarkdownRenderer } from 'vs/editor/contrib/markdownRenderer/browser/markdownRenderer';
import { localize } from 'vs/nls';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';

export interface ObjectInfo {
	path: DesignerPropertyPath;
	type: string;
	components: DesignerDataPropertyInfo[];
	viewModel: DesignerViewModel;
}

export class DesignerPropertiesPane {
	private readonly _markdownRenderer: MarkdownRenderer;
	private _titleElement: HTMLElement;
	private _contentElement: HTMLElement;
	private _objectPath: DesignerPropertyPath;
	private _componentMap = new Map<string, { defintion: DesignerDataPropertyInfo, component: DesignerUIComponent }>();
	private _groupHeaders: HTMLElement[] = [];

	// Description variables
	private _descriptionContainer: HTMLElement;
	private _descriptionTitleContainer: HTMLElement;
	private _descriptionTextContainer: HTMLElement;

	constructor(container: HTMLElement,
		private _createComponents: CreateComponentsFunc,
		private _setComponentValue: SetComponentValueFunc,
		instantiationService: IInstantiationService) {
		const titleContainer = container.appendChild(DOM.$('.title-container'));
		this._titleElement = titleContainer.appendChild(DOM.$('div'));
		this._contentElement = container.appendChild(DOM.$('.properties-content.components-grid'));
		this._titleElement.innerText = localize('tableDesigner.propertiesPaneTitle', "Properties");
		this.createDescriptionComponent(container);
		this._markdownRenderer = instantiationService.createInstance(MarkdownRenderer, {});

	}

	public get groupHeaders(): HTMLElement[] {
		return this._groupHeaders;
	}

	public get descriptionElement(): HTMLElement {
		return this._descriptionContainer;
	}

	public get componentMap(): Map<string, { defintion: DesignerDataPropertyInfo, component: DesignerUIComponent }> {
		return this._componentMap;
	}

	public get objectPath(): DesignerPropertyPath {
		return this._objectPath;
	}

	public updateDescription(definition: DesignerDataPropertyInfo) {
		this._descriptionContainer.style.display = 'block';
		const title: string = definition.componentProperties.title || definition.componentProperties.ariaLabel || '';
		const description: string = definition.description ?? '';
		this._descriptionTitleContainer.innerText = title;
		DOM.clearNode(this._descriptionTextContainer);
		if (description) {
			const markdownElement = this._markdownRenderer.render({ value: description }).element;
			this._descriptionTextContainer.appendChild(markdownElement);
		}
	}

	public clear(): void {
		this._componentMap.forEach((value) => {
			value.component.dispose();
		});
		this._componentMap.clear();
		this._groupHeaders = [];
		DOM.clearNode(this._contentElement);
		this._objectPath = undefined;
	}

	private createDescriptionComponent(container: HTMLElement) {
		this._descriptionContainer = container.appendChild(DOM.$('.description-component'));
		this._descriptionTitleContainer = this._descriptionContainer.appendChild(DOM.$('')).appendChild(DOM.$('.description-component-label'));
		this._descriptionTitleContainer.classList.add('codicon', 'info');
		this._descriptionTextContainer = this._descriptionContainer.appendChild(DOM.$('.description-component-content'));
		this._descriptionTitleContainer.innerText = '';
		this._descriptionTextContainer.innerText = '';
	}

	public show(item: ObjectInfo): void {
		if (!equals(item.path, this._objectPath)) {
			this.clear();
			this._objectPath = item.path;
			this._createComponents(this._contentElement, item.components, this.objectPath);
		}
		this._titleElement.innerText = localize({
			key: 'tableDesigner.propertiesPaneTitleWithContext',
			comment: ['{0} is the place holder for object type']
		}, "{0} Properties", item.type);
		this._componentMap.forEach((value) => {
			this._setComponentValue(value.defintion, value.component, item.viewModel);
		});
		this._descriptionContainer.style.display = 'none';
	}

	public selectProperty(path: DesignerPropertyPath): void {
		const componentInfo = this.componentMap.get(<string>path[0]);
		if (componentInfo.defintion.componentType !== 'table') {
			componentInfo.component.focus();
			return;
		}

		const table = componentInfo.component as Table<Slick.SlickData>;
		const row = path[1] as number;
		let cell = 0;
		if (path.length === 3) {
			const colName = path[2] as string;
			cell = table.columns.findIndex(c => c.field === colName);
		}
		table.setActiveCell(row, cell);
		table.grid.scrollCellIntoView(row, cell, false);
	}
}
