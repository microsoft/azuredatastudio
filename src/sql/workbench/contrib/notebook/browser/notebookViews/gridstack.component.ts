/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Component, OnInit, ViewChildren, QueryList, Input, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import { GridStackItemComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/gridstackItem.component';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';

/*
import 'vs/css!./gridstack';
import 'gridstack/dist/gridstack';
import 'gridstack/dist/jquery';
import 'gridstack/dist/jquery-ui';
import 'gridstack/dist/gridstack.jQueryUI';
*/
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { NotebookViewExtension, INotebookViewCell, CellChangeEvent } from 'sql/workbench/services/notebook/browser/models/notebookView';
//declare var $: any; // JQuery

@Component({
	selector: 'gridstack',
	templateUrl: decodeURI(require.toUrl('./gridstack.component.html'))
})
export class GridStackComponent implements OnInit {
	@Input() cells: ICellModel[];
	@Input() model: NotebookModel;

	@ViewChildren(GridStackItemComponent) private _items: QueryList<GridStackItemComponent>;

	protected _grid: any;
	protected _extension: NotebookViewExtension;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) { }

	public get extension(): NotebookViewExtension {
		return this._extension;
	}

	public get hiddenItems(): GridStackItemComponent[] {
		return this._items.filter(item => !item.display);
	}

	ngOnInit() {
		const self = this;

		this._extension = new NotebookViewExtension(this.model);
		const views = this._extension.getViews();
		let activeView = this._extension.getActiveView() ?? views[0];

		if (!activeView) {
			//activeView = this._extension.createNewView('Test View');
			//this._extension.setActiveView(activeView);
			//this._extension.commit();
		}

		setTimeout(() => {
			self._grid = window.GridStack.init({
				alwaysShowResizeHandle: true,
				verticalMargin: 5
			});

			self._grid.on('added', function (e, items) { self.persist('added', items, self._grid, self._items); });
			self._grid.on('removed', function (e, items) { self.persist('removed', items, self._grid, self._items); });
			self._grid.on('change', function (e, items) { self.persist('change', items, self._grid, self._items); });
		}, 100);
	}

	private detectChanges(): void {
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	onCellChanged(e: CellChangeEvent) {
		const currentView = this.extension.getActiveView();
		if (this._grid && currentView) {
			const results = this._grid.$el.find(`[data-cell-id='${e.cell.cellGuid}']`);
			if (results.length === 1 && e.event === 'hide') {
				this._grid.removeWidget(results[0]);
				currentView.hideCell(e.cell);
			}
			this.detectChanges();
		}
	}

	/* Update the document model with the gridstack data as metadata */
	persist(action, changedItems, grid, items) {
		changedItems.forEach((changedItem) => {
			const cellId = changedItem.el.getAttribute('data-cell-id');
			const item = items.toArray().find(item => item.cell.cellGuid === cellId);

			const activeView = this._extension.getActiveView();
			if (activeView) {
				const update: INotebookViewCell = {
					guid: activeView.guid,
					x: changedItem.x,
					y: changedItem.y,
					width: changedItem.width,
					height: changedItem.height
				};

				if (action === 'added') {
					update.hidden = false;
				} else if (action === 'removed') {
					update.hidden = true;
				}

				this._extension.updateCell(item.cell, activeView, update);
			}
		});

	}
}
