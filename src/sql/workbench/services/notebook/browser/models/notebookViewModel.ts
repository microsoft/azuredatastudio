/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { INotebookViewCell, NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/models/notebookViewsExtension';
import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Emitter, Event } from 'vs/base/common/event';
import { localize } from 'vs/nls';

export const DEFAULT_VIEW_CARD_HEIGHT = 4;
export const DEFAULT_VIEW_CARD_WIDTH = 12;

export type CellChangeEventType = 'hide' | 'insert' | 'active';

export type CellChangeEvent = {
	cell: ICellModel,
	event: CellChangeEventType;
};

export class ViewNameTakenError extends Error { }

/*
 * Represents the metadata that will be stored for the
 * view at the notebook level.
 */
export interface INotebookViewMetadata {
	version: number;
	activeView: string;
	views: INotebookView[];
}

/*
 * Represents the metadata that will be stored for the
 * view at the cell level.
 */
export interface INotebookViewCellMetadata {
	views: INotebookViewCell[];
}

export interface INotebookView {
	readonly guid: string;
	readonly onDeleted: Event<INotebookView>;

	cells: Readonly<ICellModel[]>;
	hiddenCells: Readonly<ICellModel[]>;
	name: string;

	initialize(): void;
	nameAvailable(name: string): boolean;
	hideCell(cell: ICellModel): void;
	moveCell(cell: ICellModel, x: number, y: number): void;
	resizeCell(cell: ICellModel, width: number, height: number): void;
	getCell(guid: string): Readonly<ICellModel>;
	insertCell(cell: ICellModel): void;
	save(): void;
	delete(): void;
}

export class NotebookViewModel implements INotebookView {
	public readonly guid: string;

	private _onDeleted = new Emitter<INotebookView>();
	public readonly onDeleted = this._onDeleted.event;

	constructor(
		guid: string,
		protected _name: string,
		protected _notebook: INotebookModel,
		private _notebookViewService: NotebookViewsExtension
	) {
		this.guid = guid;
	}

	public initialize() {
		const cells = this._notebook.cells;
		cells.forEach((cell, idx) => {
			let meta = this._notebookViewService.getCellMetadata(cell);

			if (!meta) {
				this._notebookViewService.initializeCell(cell);
				meta = this._notebookViewService.getCellMetadata(cell);
			}

			meta.views.push({
				guid: this.guid,
				hidden: false,
				y: idx * DEFAULT_VIEW_CARD_HEIGHT,
				x: 0,
			});

		});
	}

	public get name(): string {
		return this._name;
	}

	public set name(name: string) {
		if (this._notebookViewService.viewNameIsTaken(name)) {
			throw new ViewNameTakenError(localize('notebookView.nameTaken', 'A view with the name {0} already exists in this notebook.', name));
		}
		this._name = name;
	}

	public nameAvailable(name: string): boolean {
		return !this._notebookViewService.viewNameIsTaken(name) || name === this.name;
	}

	public getCellMetadata(cell: ICellModel): INotebookViewCell {
		const meta = this._notebookViewService.getCellMetadata(cell);
		return meta.views.find(view => view.guid === this.guid);
	}

	public get hiddenCells(): Readonly<ICellModel[]> {
		return this.cells.filter(cell => {
			const meta = this._notebookViewService.getCellMetadata(cell);
			const cellData = meta.views.find(view => view.guid === this.guid);
			return cellData.hidden;
		});
	}

	public get cells(): Readonly<ICellModel[]> {
		return this._notebook.cells;
	}

	public getCell(guid: string): Readonly<ICellModel> {
		return this._notebook.cells.find(cell => cell.cellGuid === guid);
	}

	public insertCell(cell: ICellModel) {
		this._notebookViewService.updateCell(cell, this, { hidden: false });
	}

	public hideCell(cell: ICellModel) {
		this._notebookViewService.updateCell(cell, this, { hidden: true });
	}

	public moveCell(cell: ICellModel, x: number, y: number) {
		this._notebookViewService.updateCell(cell, this, { x, y });
	}

	public resizeCell(cell: ICellModel, width: number, height: number) {
		this._notebookViewService.updateCell(cell, this, { width, height });
	}

	public save() {
		this._notebookViewService.commit();
	}

	public delete() {
		this._notebookViewService.removeView(this.guid);
		this._onDeleted.fire(this);
	}

	public toJSON() {
		return { guid: this.guid, name: this._name } as NotebookViewModel;
	}
}
