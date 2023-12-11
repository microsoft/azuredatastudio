/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerRootObjectPath, DesignerTab } from 'sql/workbench/browser/designer/interfaces';
import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Table } from 'sql/base/browser/ui/table/table';
import { Disposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { CreateComponentsFunc } from 'sql/workbench/browser/designer/designer';
import { layoutDesignerTable } from 'sql/workbench/browser/designer/designerTableUtil';

export class DesignerTabPanelView extends Disposable implements IPanelView {
	private _viewContainer: HTMLElement;
	private _componentsContainer: HTMLElement;
	private _tables: Table<Slick.SlickData>[] = [];
	constructor(private readonly _tab: DesignerTab, private _createComponents: CreateComponentsFunc) {
		super();
		this._viewContainer = DOM.$('.designer-tab-view');
		this._componentsContainer = this._viewContainer.appendChild(DOM.$('.components-grid'));
		const uiComponents = this._createComponents(this._componentsContainer, this._tab.components, DesignerRootObjectPath);
		uiComponents.forEach(component => {
			if (component instanceof Table) {
				this._tables.push(component);
			}
		});
	}

	render(container: HTMLElement): void {
		container.appendChild(this._viewContainer);
	}

	layout(dimension: DOM.Dimension): void {
		this._tables.forEach(table => {
			layoutDesignerTable(table, dimension.width);
		});
	}
}
