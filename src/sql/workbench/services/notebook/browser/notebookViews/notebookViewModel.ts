/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { INotebookView, INotebookViewCell } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { generateUuid } from 'vs/base/common/uuid';

export const DEFAULT_VIEW_CARD_HEIGHT = 4;
export const DEFAULT_VIEW_CARD_WIDTH = 12;

export class ViewNameTakenError extends Error { }

export class NotebookViewModel implements INotebookView {
	private _onDeleted = new Emitter<INotebookView>();

	public readonly guid: string;
	public readonly onDeleted = this._onDeleted.event;

	constructor(
		protected _name: string,
		private _notebookViews: NotebookViewsExtension
	) {
		this.guid = generateUuid();
	}

	public initialize(): void {
		const cells = this._notebookViews.notebook.cells;
		cells.forEach((cell, idx) => { this.initializeCell(cell, idx); });
	}

	protected initializeCell(cell: ICellModel, idx: number) {
		let meta = this._notebookViews.getCellMetadata(cell);

		if (!meta) {
			this._notebookViews.initializeCell(cell);
			meta = this._notebookViews.getCellMetadata(cell);
		}

		meta.views.push({
			guid: this.guid,
			hidden: false,
			y: idx * DEFAULT_VIEW_CARD_HEIGHT,
			x: 0,
		});
	}

	public get name(): string {
		return this._name;
	}

	public set name(name: string) {
		if (this.name !== name && this._notebookViews.viewNameIsTaken(name)) {
			throw new ViewNameTakenError(localize('notebookView.nameTaken', 'A view with the name {0} already exists in this notebook.', name));
		}
		this._name = name;
	}

	public nameAvailable(name: string): boolean {
		return !this._notebookViews.viewNameIsTaken(name);
	}

	public getCellMetadata(cell: ICellModel): INotebookViewCell {
		const meta = this._notebookViews.getCellMetadata(cell);
		return meta?.views?.find(view => view.guid === this.guid);
	}

	public get hiddenCells(): Readonly<ICellModel[]> {
		return this.cells.filter(cell => this.getCellMetadata(cell)?.hidden);
	}

	public get cells(): Readonly<ICellModel[]> {
		return this._notebookViews.notebook.cells;
	}

	public getCell(guid: string): Readonly<ICellModel> {
		return this._notebookViews.notebook.cells.find(cell => cell.cellGuid === guid);
	}

	public insertCell(cell: ICellModel) {
		this._notebookViews.updateCell(cell, this, { hidden: false });
	}

	public hideCell(cell: ICellModel) {
		this._notebookViews.updateCell(cell, this, { hidden: true });
	}

	public moveCell(cell: ICellModel, x: number, y: number) {
		this._notebookViews.updateCell(cell, this, { x, y });
	}

	public resizeCell(cell: ICellModel, width: number, height: number) {
		this._notebookViews.updateCell(cell, this, { width, height });
	}

	public save() {
		this._notebookViews.commit();
	}

	public delete() {
		this._notebookViews.removeView(this.guid);
		this._onDeleted.fire(this);
	}
}
