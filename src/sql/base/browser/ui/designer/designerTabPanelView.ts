/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerTab } from 'sql/base/browser/ui/designer/interfaces';
import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Table } from 'sql/base/browser/ui/table/table';
import { Disposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { CreateComponentsFunc } from 'sql/base/browser/ui/designer/designer';

const ButtonHeight = 30;
const HorizontalPadding = 10;
const VerticalPadding = 20;

export class DesignerTabPanelView extends Disposable implements IPanelView {
	private _componentsContainer: HTMLElement;
	private _tables: Table<Slick.SlickData>[] = [];
	constructor(private readonly _tab: DesignerTab, private _createComponents: CreateComponentsFunc) {
		super();
		this._componentsContainer = DOM.$('.components-grid');
		const uiComponents = this._createComponents(this._componentsContainer, this._tab.components, component => component.propertyName);
		uiComponents.forEach(component => {
			if (component instanceof Table) {
				this._tables.push(component);
			}
		});
	}

	render(container: HTMLElement): void {
		container.appendChild(this._componentsContainer);
	}

	layout(dimension: DOM.Dimension): void {
		this._tables.forEach(table => {
			table.layout(new DOM.Dimension(dimension.width - HorizontalPadding, dimension.height - VerticalPadding - ButtonHeight));
		});
	}
}
