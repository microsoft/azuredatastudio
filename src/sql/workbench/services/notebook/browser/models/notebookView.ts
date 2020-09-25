/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { generateUuid } from 'vs/base/common/uuid';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';

export type CellChangeEventType = 'hide' | 'active';

export type CellChangeEvent = {
	cell: ICellModel,
	event: CellChangeEventType;
};

/*
 * Represents the metadata that will be stored for the
 * view at the notebook level.
 */
export interface INotebookViewMetadata {
	version: number;
	activeView: string;
	views: INotebookView[];
}

export interface INotebookView {
	cells: Readonly<ICellModel[]>;
	hiddenCells: Readonly<ICellModel[]>;
	readonly guid: string;
	name: string;

	initialize(): void;
	hideCell(cell: ICellModel): void;
	getCell(guid: string): Readonly<ICellModel>;
	insertCellAt(cell: ICellModel, x: number, y: number, height?: number, width?: number): void;
	save(): void;
}

/*
 * Represents the metadata that will be stored for the
 * view at the cell level.
 */
export interface INotebookViewCellMetadata {
	views: INotebookViewCell[];
}

export interface INotebookViewCell {
	readonly guid?: string;
	hidden?: boolean;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

export class NotebookExtension {
	readonly version = 1;
	readonly extensionName = 'azuredatastudio';
	readonly extensionsNamespace = 'extensions';

	public getNotebookMetadata(notebook: INotebookModel): INotebookViewMetadata {
		const extensionsMeta = notebook.getMetaValue(this.extensionsNamespace) || {};
		return extensionsMeta[this.extensionName] as INotebookViewMetadata;
	}

	public setNotebookMetadata(notebook: INotebookModel, metadata: INotebookViewMetadata) {
		const meta = {};
		meta[this.extensionName] = metadata;
		notebook.setMetaValue(this.extensionsNamespace, meta);
		notebook.serializationStateChanged(NotebookChangeType.CellsModified);
	}

	public getCellMetadata(cell: ICellModel): INotebookViewCellMetadata {
		const namespaceMeta = cell.metadata[this.extensionsNamespace] || {};
		return namespaceMeta[this.extensionName];
	}

	public setCellMetadata(cell: ICellModel, metadata: INotebookViewCellMetadata) {
		const meta = {};
		meta[this.extensionName] = metadata;
		cell.metadata[this.extensionsNamespace] = meta;
		cell.sendChangeToNotebook(NotebookChangeType.CellMetadataUpdated);
	}
}

export class NotebookViewExtension extends NotebookExtension {
	readonly extension = 'azuredatastudio';
	readonly version = 1;
	protected _extensionMeta: INotebookViewMetadata;

	constructor(protected _notebook: INotebookModel) {
		super();
		this.loadOrInitialize();
	}

	public loadOrInitialize() {
		this._extensionMeta = this.getNotebookMetadata(this._notebook);

		if (!this._extensionMeta) {
			this.initializeNotebook();
			this.initializeCells();
			this.commit();
		} else {
			this._extensionMeta.views = this._extensionMeta.views.map((view) => (
				new NotebookView(
					view.guid,
					view.name,
					this._notebook,
					this
				)
			));
		}
	}

	public get notebook(): INotebookModel {
		return this._notebook;
	}

	public commit() {
		this.setNotebookMetadata(this._notebook, this._extensionMeta);
	}

	public getActiveView(): INotebookView {
		return this.getViews().find(view => view.guid === this._extensionMeta.activeView);
	}

	public setActiveView(view: INotebookView) {
		this._extensionMeta.activeView = view.guid;
	}

	public createNewView(name: string): INotebookView {
		const view = new NotebookView(
			generateUuid(),
			name,
			this._notebook,
			this
		);

		this._extensionMeta.views.push(view);
		view.initialize();

		return view;
	}

	public removeView(guid: string) {
		this._extensionMeta.views.splice(this._extensionMeta.views.findIndex(view => view.guid === guid), 1);
	}

	public getViews(): INotebookView[] {
		return this._extensionMeta.views;
	}

	protected initializeNotebook() {
		this._extensionMeta = {
			version: this.version,
			activeView: undefined,
			views: []
		};
	}

	protected initializeCells() {
		const cells = this._notebook.cells;
		cells.forEach((cell) => {
			const meta: INotebookViewCellMetadata = {
				views: []
			};
			this.setCellMetadata(cell, meta);
			this._notebook.onCellChange(cell, NotebookChangeType.CellMetadataUpdated);
		});
	}

	public updateCell(cell: ICellModel, currentView: INotebookView, cellData: INotebookViewCell, override: boolean = false) {
		const cellMetadata = this.getCellMetadata(cell);
		const viewToUpdate = cellMetadata.views.findIndex(view => view.guid === currentView.guid);

		if (viewToUpdate >= 0) {
			cellMetadata.views[viewToUpdate] = override ? cellData : { ...cellMetadata.views[viewToUpdate], ...cellData };
			this.setCellMetadata(cell, cellMetadata);
		}
	}
}


class NotebookView implements INotebookView {
	readonly guid: string;

	constructor(
		guid: string,
		protected _name: string,
		protected _notebook: INotebookModel,
		private _notebookViewExtension: NotebookViewExtension
	) {
		this.guid = guid;
	}

	public get name(): string {
		return this._name;
	}

	public set name(name: string) {
		this._name = name;
	}

	public initialize() {
		const cells = this._notebook.cells;
		cells.forEach((cell) => {
			const meta = this._notebookViewExtension.getCellMetadata(cell);
			if (meta) {
				meta.views.push({
					guid: this.guid,
					hidden: false,
					x: 0,
					y: 0,
					width: 0,
					height: 0
				});
			}
		});
	}

	public getCellMetadata(cell: ICellModel): INotebookViewCell {
		const meta = this._notebookViewExtension.getCellMetadata(cell);
		return meta.views.find(view => view.guid === this.guid);
	}

	public get cells(): Readonly<ICellModel[]> {
		return this._notebook.cells;
	}

	public getCell(guid: string): Readonly<ICellModel> {
		return this._notebook.cells.find(cell => cell.cellGuid === guid);
	}

	public get hiddenCells(): Readonly<ICellModel[]> {
		return this.cells.filter(cell => {
			const meta = this._notebookViewExtension.getCellMetadata(cell);
			const cellData = meta.views.find(view => view.guid === this.guid);
			return cellData.hidden;
		});
	}

	public insertCellAt(cell: ICellModel, x: number, y: number, height: number = 4, width: number = 12) {
		this._notebookViewExtension.updateCell(cell, this, { hidden: false, x, y, width, height });
	}

	public hideCell(cell: ICellModel) {
		this._notebookViewExtension.updateCell(cell, this, { hidden: true });
	}

	public save() {
		this._notebookViewExtension.commit();
	}

	public toJSON() {
		return { guid: this.guid, name: this._name } as NotebookView;
	}
}
