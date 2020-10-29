/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { generateUuid } from 'vs/base/common/uuid';
import { NotebookChangeType } from 'sql/workbench/services/notebook/common/contracts';
import { Emitter, Event } from 'vs/base/common/event';
import { localize } from 'vs/nls';

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

export interface INotebookView {
	readonly onDeleted: Event<INotebookView>;
	cells: Readonly<ICellModel[]>;
	hiddenCells: Readonly<ICellModel[]>;
	readonly guid: string;
	name: string;

	initialize(): void;
	nameAvailable(name: string): boolean;
	hideCell(cell: ICellModel): void;
	moveCell(cell: ICellModel, x: number, y: number): void;
	getCell(guid: string): Readonly<ICellModel>;
	insertCell(cell: ICellModel): void;
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
	readonly maxNameIterationAttempts = 100;
	readonly defaultViewName = localize('notebookView.untitledView', "Untitled View");
	readonly extension = 'azuredatastudio';
	readonly version = 1;
	protected _extensionMeta: INotebookViewMetadata;

	private _onViewDeleted = new Emitter<void>();

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

	public createNewView(name?: string): INotebookView {
		const viewGuid = generateUuid();
		const viewName = name || this.generateDefaultNameView(viewGuid);

		const view = new NotebookView(
			viewGuid,
			viewName,
			this._notebook,
			this
		);

		this._extensionMeta.views.push(view);
		view.initialize();

		return view;
	}

	public generateDefaultNameView(failsafeValue: string): string {
		let name = this.defaultViewName;

		if (!this.viewNameIsTaken(name)) {
			return name;
		}

		for (let i = 1; i <= this.maxNameIterationAttempts; i++) {
			name = `${this.defaultViewName} ${i}`;
			if (!this.viewNameIsTaken(name)) {
				return name;
			}
		}

		return failsafeValue;
	}

	public removeView(guid: string) {
		let viewToRemove = this._extensionMeta.views.findIndex(view => view.guid === guid);
		if (viewToRemove !== -1) { // findIndex returns -1 when no element is found
			let removedView = this._extensionMeta.views.splice(viewToRemove, 1);

			if (removedView.length) {

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

		this._onViewDeleted.fire();
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

	public viewNameIsTaken(name: string): boolean {
		return !!this.getViews().find(v => v.name.toLowerCase() === name.toLowerCase());
	}

	public get onViewDeleted(): Event<void> {
		return this._onViewDeleted.event;
	}
}


class NotebookView implements INotebookView {
	public readonly guid: string;

	private _onDeleted = new Emitter<INotebookView>();
	public readonly onDeleted = this._onDeleted.event;

	constructor(
		guid: string,
		protected _name: string,
		protected _notebook: INotebookModel,
		private _notebookViewExtension: NotebookViewExtension
	) {
		this.guid = guid;
	}

	public initialize() {
		const cells = this._notebook.cells;
		cells.forEach((cell, idx) => {
			let meta = this._notebookViewExtension.getCellMetadata(cell);

			if (!meta) {
				this._notebookViewExtension.initializeCell(cell);
				meta = this._notebookViewExtension.getCellMetadata(cell);
			}

			meta.views.push({
				guid: this.guid,
				hidden: false,
				y: idx * 4,
				x: 0,
				width: 0,
				height: 0
			});

		});
	}

	public get name(): string {
		return this._name;
	}

	public set name(name: string) {
		if (this._notebookViewExtension.viewNameIsTaken(name)) {
			throw new ViewNameTakenError(localize('notebookView.nameTaken', 'A view with the name {0} already exists in this notebook.', name));
		}

		this._name = name;
	}

	public nameAvailable(name: string): boolean {
		return !this._notebookViewExtension.viewNameIsTaken(name) || name === this.name;
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

	public insertCell(cell: ICellModel) {
		this._notebookViewExtension.updateCell(cell, this, { hidden: false });
	}

	public hideCell(cell: ICellModel) {
		this._notebookViewExtension.updateCell(cell, this, { hidden: true });
	}

	public moveCell(cell: ICellModel, x: number, y: number) {
		this._notebookViewExtension.updateCell(cell, this, { x, y });
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
