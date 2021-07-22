/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./notebookViewsGrid';
import { Component, OnInit, ViewChildren, QueryList, Input, Inject, forwardRef, ChangeDetectorRef, ViewEncapsulation, ChangeDetectionStrategy } from '@angular/core';
import { NotebookViewsCardComponent } from 'sql/workbench/contrib/notebook/browser/notebookViews/notebookViewsCard.component';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { NotebookModel } from 'sql/workbench/services/notebook/browser/models/notebookModel';
import { GridStack, GridStackEvent, GridStackNode } from 'gridstack';
import { localize } from 'vs/nls';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { CellChangeEvent, INotebookView, INotebookViewCell } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { AngularDisposable } from 'sql/base/browser/lifecycle';
import { generateLayout } from 'sql/workbench/services/notebook/browser/notebookViews/autodash';

export interface INotebookViewsGridOptions {
	cellHeight?: number;
}

@Component({
	selector: 'notebook-views-grid-component',
	templateUrl: decodeURI(require.toUrl('./notebookViewsGrid.component.html')),
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None
})
export class NotebookViewsGridComponent extends AngularDisposable implements OnInit {
	@Input() cells: ICellModel[];
	@Input() model: NotebookModel;
	@Input() activeView: INotebookView;
	@Input() views: NotebookViewsExtension;

	@ViewChildren(NotebookViewsCardComponent) private _items: QueryList<NotebookViewsCardComponent>;

	protected _grid: GridStack;
	protected _gridEnabled: boolean;
	protected _loaded: boolean;

	protected _options: INotebookViewsGridOptions = {
		cellHeight: 60
	};;

	constructor(
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
	) {
		super();
		this._loaded = false;
	}

	public get empty(): boolean {
		return !this._items || !this._items.find(item => item.display);
	}

	public get hiddenItems(): NotebookViewsCardComponent[] {
		return this._items?.filter(item => !item.display) ?? [];
	}

	public get emptyText(): String {
		return localize('emptyText', "This view is empty. Add a cell to this view by clicking the Insert Cells button.");
	}

	ngOnInit() { }

	ngAfterViewInit() {
		const self = this;

		this.createGrid();

		this._loaded = true;
		this.detectChanges();

		self._grid.on('added', function (e: Event, items: GridStackNode[]) { if (self._gridEnabled) { self.persist('added', items, self._grid, self._items); } });
		self._grid.on('removed', function (e: Event, items: GridStackNode[]) { if (self._gridEnabled) { self.persist('removed', items, self._grid, self._items); } });
		self._grid.on('change', function (e: Event, items: GridStackNode[]) { if (self._gridEnabled) { self.persist('change', items, self._grid, self._items); } });
	}

	ngAfterContentChecked() {
		//If activeView has changed or not present, we will destroy the grid in order to rebuild it later.
		if (!this.activeView || this.activeView.guid !== this.activeView.guid) {
			if (this._grid) {
				this.destroyGrid();
				this._grid = undefined;
			}
		}
	}

	ngAfterViewChecked() {
		// If activeView has changed, rebuild the grid
		if (!this.activeView || this.activeView.guid !== this.activeView.guid) {

			if (!this._grid) {
				this.createGrid();
			}

			this._loaded = true;
			this.detectChanges();
		}
	}

	override ngOnDestroy() {
		this.destroyGrid();
	}

	private destroyGrid() {
		this._gridEnabled = false;
		this._grid.destroy(false);
	}

	private createGrid() {
		const isNew = this.activeView.isNew;
		if (this._grid) {
			this.destroyGrid();
		}

		if (isNew) {
			this.runAutoLayout(this.activeView);
			this.activeView.markAsViewed();
		}

		this._grid = GridStack.init({
			alwaysShowResizeHandle: false,
			styleInHead: true,
			margin: 2,
			staticGrid: false,
		});

		this._gridEnabled = true;

		if (isNew) {
			this.updateGrid();
		}
	}

	/**
	 * Updates the grid layout based on changes to the view model
	 */
	private updateGrid(): void {
		if (!this._grid || !this.activeView) {
			return;
		}

		this._grid.batchUpdate();
		this.activeView.cells.forEach(cell => {
			const el = this._grid.getGridItems().find(x => x.getAttribute('data-cell-id') === cell.cellGuid);
			const cellData = this.activeView.getCellMetadata(cell);
			this._grid.update(el, { x: cellData.x, y: cellData.y, w: cellData.width, h: cellData.height });

			if (cellData?.hidden) {
				this._grid.removeWidget(el, false); // Do not trigger event for batch update
			}
		});
		this._grid.commit();
	}

	private resizeCells(): void {
		this._items.forEach((i: NotebookViewsCardComponent) => {
			if (i.elementRef) {
				const cellHeight = this._options.cellHeight;

				const naturalHeight = i.elementRef.nativeElement.clientHeight;
				const heightInCells = Math.ceil(naturalHeight / cellHeight);

				const update: INotebookViewCell = {
					height: heightInCells
				};

				this.views.updateCell(i.cell, this.activeView, update);
			}
		});
	}

	private runAutoLayout(view: INotebookView): void {
		//Resize the cells before regenerating layout so that we know the natural height of the cells
		this.resizeCells();
		generateLayout(view);
	}

	private detectChanges(): void {
		if (!(this._changeRef['destroyed'])) {
			this._changeRef.detectChanges();
		}
	}

	async onCellChanged(e: CellChangeEvent): Promise<void> {
		if (this._grid && this.activeView) {
			const cellElem: HTMLElement = this._grid.el.querySelector(`[data-cell-id='${e.cell.cellGuid}']`);
			if (cellElem && e.event === 'hide') {
				this._grid.removeWidget(cellElem);
				this.activeView.hideCell(e.cell);
			}

			if (e.cell && e.event === 'insert') {
				this.activeView.insertCell(e.cell);

				this.detectChanges();

				const el = this._grid.getGridItems().find(x => x.getAttribute('data-cell-id') === e.cell.cellGuid);
				this._grid.makeWidget(el);
				this._grid.update(el, { x: 0, y: 0 });
				this._grid.resizable(el, true);
				this._grid.movable(el, true);
			}

			this.detectChanges();
		}
	}

	/**
	 * Update the document model with the gridstack data as metadata
	 */
	persist(action: GridStackEvent, changedItems: GridStackNode[] = [], grid: GridStack, items: QueryList<NotebookViewsCardComponent>): void {
		changedItems.forEach((changedItem) => {
			const cellId = changedItem.el.getAttribute('data-cell-id');
			const item = items.toArray().find(item => item.cell.cellGuid === cellId);

			if (item && this.activeView) {
				const update: INotebookViewCell = {
					guid: this.activeView.guid,
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

				this.views.updateCell(item.cell, this.activeView, update);
			}
		});
	}

	public get loaded(): boolean {
		return this._loaded;
	}
}
