/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import 'vs/css!./cellToolbar';
import { Component, OnInit, ViewChildren, QueryList, Input, Inject, forwardRef, ChangeDetectorRef, ViewEncapsulation } from '@angular/core';
import { NotebookViewsCardComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsCard.component';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { GridStack, GridStackEvent, GridStackNode } from 'gridstack';
import 'gridstack/dist/h5/gridstack-dd-native';
import { localize } from 'vs/nls';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { CellChangeEvent, INotebookViewCell } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';

@Component({
	selector: 'notebook-views-grid-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsGrid.component.html')),
	encapsulation: ViewEncapsulation.None,
})
export class NotebookViewsGridComponent implements OnInit {
	@Input() cells: ICellModel[];
	@Input() model: NotebookModel;
	@Input() views: NotebookViewsExtension;

	@ViewChildren(NotebookViewsCardComponent) private _items: QueryList<NotebookViewsCardComponent>;

	protected _grid: GridStack;
	public loaded: boolean;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		this.loaded = false;
	}

	public get empty(): boolean {
		return !this._items || !this._items.find(item => item.display);
	}

	public get hiddenItems(): NotebookViewsCardComponent[] {
		return this._items.filter(item => !item.display);
	}

	public get emptyText(): String {
		return localize('emptyText', "This view is empty. Add a cell to this view by clicking the Insert Cells button.");
	}

	ngOnInit() {
		const self = this;

		setTimeout(() => {
			self._grid = GridStack.init({
				alwaysShowResizeHandle: false,
				styleInHead: true
			});

			this.loaded = true;
			this.detectChanges();

			self._grid.on('added', function (e: Event, items: GridStackNode[]) { self.persist('added', items, self._grid, self._items); });
			self._grid.on('removed', function (e: Event, items: GridStackNode[]) { self.persist('removed', items, self._grid, self._items); });
			self._grid.on('change', function (e: Event, items: GridStackNode[]) { self.persist('change', items, self._grid, self._items); });
		}, 100);
	}

	private detectChanges(): void {
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	async onCellChanged(e: CellChangeEvent): Promise<void> {
		const currentView = this.views.getActiveView();
		if (this._grid && currentView) {
			const cellElem: HTMLElement = this._grid.el.querySelector(`[data-cell-id='${e.cell.cellGuid}']`);
			if (cellElem && e.event === 'hide') {
				this._grid.removeWidget(cellElem);
				currentView.hideCell(e.cell);
			}

			if (e.cell && e.event === 'insert') {
				const component = this._items.find(x => x.cell.cellGuid === e.cell.cellGuid);
				currentView.moveCell(e.cell, 9999, 0);
				currentView.insertCell(e.cell);

				const el = this._grid.getGridItems().find(x => x.getAttribute('data-cell-id') === e.cell.cellGuid);
				this._grid.makeWidget(el);
				this._grid.update(el, { x: 0, y: 0 });
				this._grid.resizable(el, true);
				this._grid.movable(el, true);

				component.detectChanges();
			}
			this.detectChanges();
		}
	}

	/**
	 * Update the document model with the gridstack data as metadata
	 */
	persist(action: GridStackEvent, changedItems: GridStackNode[], grid: GridStack, items: QueryList<NotebookViewsCardComponent>): void {
		changedItems.forEach((changedItem) => {
			const cellId = changedItem.el.getAttribute('data-cell-id');
			const item = items.toArray().find(item => item.cell.cellGuid === cellId);

			const activeView = this.views.getActiveView();
			if (item && activeView) {
				const update: INotebookViewCell = {
					guid: activeView.guid,
					x: changedItem.x,
					y: changedItem.y,
					width: changedItem.w,
					height: changedItem.h
				};

				if (action === 'added') {
					update.hidden = false;
				} else if (action === 'removed') {
					update.hidden = true;
				}

				this.views.updateCell(item.cell, activeView, update);
			}
		});

	}
}
