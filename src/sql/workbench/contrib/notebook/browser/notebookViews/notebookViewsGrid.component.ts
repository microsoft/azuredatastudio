/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./gridstack';
import 'vs/css!./notebookviews';
import { Component, OnInit, ViewChildren, QueryList, Input, Inject, forwardRef, ChangeDetectorRef } from '@angular/core';
import { NotebookViewsCardComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsCard.component';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { GridStack } from 'gridstack';
import { IColorTheme, ICssStyleCollector, registerThemingParticipant } from 'vs/platform/theme/common/themeService';
import { localize } from 'vs/nls';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { CellChangeEvent, INotebookViewCell } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';

@Component({
	selector: 'notebook-views-grid-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsGrid.component.html'))
})
export class NotebookViewsGridComponent implements OnInit {
	@Input() cells: ICellModel[];
	@Input() model: NotebookModel;
	@Input() views: NotebookViewsExtension;

	@ViewChildren(NotebookViewsCardComponent) private _items: QueryList<NotebookViewsCardComponent>;

	protected _grid: any;
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

			this.cells.forEach((cell) => self._grid);

			this.loaded = true;
			this.detectChanges();

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

	async onCellChanged(e: CellChangeEvent) {
		const currentView = this.views.getActiveView();
		if (this._grid && currentView) {
			const cellElem = this._grid.el.querySelector(`[data-cell-id='${e.cell.cellGuid}']`);
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
				this._grid.move(el, 0, 0);
				this._grid.resizable(el, true);
				this._grid.movable(el, true);

				component.initActionBar();
				component.detectChanges();
			}
			this.detectChanges();
		}
	}

	/* Update the document model with the gridstack data as metadata */
	persist(action, changedItems, grid, items) {
		changedItems.forEach((changedItem) => {
			const cellId = changedItem.el.getAttribute('data-cell-id');
			const item = items.toArray().find(item => item.cell.cellGuid === cellId);

			const activeView = this.views.getActiveView();
			if (item && activeView) {
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

				this.views.updateCell(item.cell, activeView, update);
			}
		});

	}
}

registerThemingParticipant((theme: IColorTheme, collector: ICssStyleCollector) => {
	collector.addRule(`
		.empty-message {
			text-align: center;
		}
	`);
});
