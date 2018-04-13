/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';

/**
 * The main controller class that initializes the extension
 */
export default class SplitPropertiesPanel {
	private panels: sqlops.FlexContainer[];
	private _modelBase: sqlops.FlexContainer;
	constructor(view: sqlops.ModelView, numPanels: number) {
		this.panels = [];
		let ratio = Math.round(100 / numPanels);
		for (let i = 0; i < numPanels; i++) {
			this.panels.push(view.modelBuilder.flexContainer()
				.withLayout({ flexFlow: 'column' }).component());
		}
		this._modelBase = view.modelBuilder.flexContainer()
			.withLayout({
				flexFlow: 'row'
			}).withItems(this.panels, {
				flex: `0 1 ${ratio}%`
			})
			.component();
	}

	public get modelBase(): sqlops.Component {
		return this._modelBase;
	}

	public addItem(item: sqlops.Component, panel: number): void {
		if (panel >= this.panels.length) {
			throw new Error(`Cannot add to panel ${panel} as only ${this.panels.length - 1} panels defined`);
		}
		this.panels[panel].addItem(item, undefined);
	}
}

