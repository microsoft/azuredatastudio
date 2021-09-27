/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerComponentType, DesignerTab } from 'sql/base/browser/ui/designer/interfaces';
import { IPanelView } from 'sql/base/browser/ui/panel/panel';
import { Table } from 'sql/base/browser/ui/table/table';
import { Disposable } from 'vs/base/common/lifecycle';
import * as DOM from 'vs/base/browser/dom';
import { DesignerUIComponents } from 'sql/base/browser/ui/designer/designer';

export class DesignerTabPanelView extends Disposable implements IPanelView {

	private tables: Table<Slick.SlickData>[] = [];
	constructor(private readonly _tab: DesignerTab, private _createComponent: (container: HTMLElement, component: DesignerComponentType, labelOnTop?: boolean) => DesignerUIComponents) {
		super();
	}

	render(container: HTMLElement): void {
		const componentsContainer = container.appendChild(DOM.$('.components-grid'));
		this._tab.components.forEach(componentDefition => {
			const component = this._createComponent(componentsContainer, componentDefition, this._tab.labelOnTop);
			if (componentDefition.type === 'table') {
				this.tables.push(component as Table<Slick.SlickData>);
			}
		});
	}

	layout(dimension: DOM.Dimension): void {
		this.tables.forEach(table => {
			table.layout(new DOM.Dimension(dimension.width - 10, dimension.height - 20));
		});
	}
}
