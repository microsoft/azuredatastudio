/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { generateUuid } from 'vs/base/common/uuid';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { Emitter, Event } from 'vs/base/common/event';

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
	readonly onDeleted: Event<INotebookView>;
	cells: Readonly<ICellModel[]>;
	hiddenCells: Readonly<ICellModel[]>;
	readonly guid: string;
	name: string;

	initialize(): void;
	hideCell(cell: ICellModel): void;
	getCell(guid: string): Readonly<ICellModel>;
	insertCellAt(cell: ICellModel, x: number, y: number, height?: number, width?: number): void;
	save(): void;
	delete(): void;
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
		notebook.serializationStateChanged(NotebookChangeType.MetadataChanged);
	}

	public getCellMetadata(cell: ICellModel): INotebookViewCellMetadata {
		const namespaceMeta = cell.metadata[this.extensionsNamespace] || {};
		return namespaceMeta[this.extensionName];
	}

	public setCellMetadata(cell: ICellModel, metadata: INotebookViewCellMetadata) {
		const meta = {};
		meta[this.extensionName] = metadata;
		cell.metadata[this.extensionsNamespace] = meta;
		cell.sendChangeToNotebook(NotebookChangeType.CellsModified);
	}
}

export class NotebookViewExtension extends NotebookExtension {
	readonly extension = 'azuredatastudio';
	readonly version = 1;
	protected _extensionMeta: INotebookViewMetadata;

	private readonly _onViewDeleted = new Emitter<INotebookView>();
	public readonly onViewDeleted = this._onViewDeleted.event;

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
		let viewToRemove = this._extensionMeta.views.findIndex(view => view.guid === guid);
		if (viewToRemove !== -1) { // findIndex returns -1 when no element is found
			let removedView = this._extensionMeta.views.splice(viewToRemove, 1);

			if (removedView.length) {
				this._onViewDeleted.fire(removedView[0]);

				this._notebook?.cells.forEach((cell) => {
					let meta = this.getCellMetadata(cell);

					meta.views.splice(viewToRemove, 1);

					this.setCellMetadata(cell, meta);
				});
			}

			this.setNotebookMetadata(this.notebook, this._extensionMeta);
		}

		if (guid === this._extensionMeta.activeView) {
			this._extensionMeta.activeView = undefined;
		}

		this.commit();
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
			this.initializeCell(cell);
		});
	}

	public initializeCell(cell: ICellModel) {
		const meta: INotebookViewCellMetadata = {
			views: []
		};
		this.setCellMetadata(cell, meta);
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
	public readonly guid: string;

	private readonly _onDeleted = new Emitter<INotebookView>();
	public readonly onDeleted = this._onDeleted.event;

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
			let meta = this._notebookViewExtension.getCellMetadata(cell);

			if (!meta) {
				this._notebookViewExtension.initializeCell(cell);
				meta = this._notebookViewExtension.getCellMetadata(cell);
			}

			meta.views.push({
				guid: this.guid,
				hidden: false,
				x: 0,
				y: 0,
				width: 0,
				height: 0
			});

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

	public delete() {
		this._notebookViewExtension.removeView(this.guid);
		this._onDeleted.fire(this);
	}

	public toJSON() {
		return { guid: this.guid, name: this._name } as NotebookView;
	}
}
