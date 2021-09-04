/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { generateUuid } from 'vs/base/common/uuid';
import { Emitter, Event } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { NotebookViewModel } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { NotebookExtension } from 'sql/workbench/services/notebook/browser/models/notebookExtension';
import { INotebookView, INotebookViewCell, INotebookViewCellMetadata, INotebookViewMetadata, INotebookViews } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';

export class NotebookViewsExtension extends NotebookExtension<INotebookViewMetadata, INotebookViewCellMetadata> implements INotebookViews {
	static readonly defaultViewName = localize('notebookView.untitledView', "Untitled View");

	readonly maxNameIterationAttempts = 100;
	readonly extension = 'azuredatastudio';
	override readonly version = 1;

	protected _metadata: INotebookViewMetadata;
	private _onViewDeleted = new Emitter<void>();

	constructor(protected _notebook: INotebookModel) {
		super();
		this.loadOrInitialize();
	}

	public loadOrInitialize() {
		this._metadata = this.getNotebookMetadata(this._notebook);

		if (!this._metadata) {
			this.initializeNotebook();
			this.initializeCells();
			this.commit();
		}
	}

	protected initializeNotebook() {
		this._metadata = {
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

	public createNewView(name?: string): INotebookView {
		const viewName = name || this.generateDefaultViewName();

		const view = new NotebookViewModel(viewName, this);
		view.initialize();

		this._metadata.views.push(view);

		return view;
	}

	public removeView(guid: string) {
		let viewToRemove = this._metadata.views.findIndex(view => view.guid === guid);
		if (viewToRemove !== -1) {
			let removedView = this._metadata.views.splice(viewToRemove, 1);

			// Remove view data for each cell
			if (removedView.length) {
				this._notebook?.cells.forEach((cell) => {
					let meta = this.getCellMetadata(cell);
					meta.views.splice(viewToRemove, 1);
					this.setCellMetadata(cell, meta);
				});
			}

			this.setNotebookMetadata(this.notebook, this._metadata);
		}

		if (guid === this._metadata.activeView) {
			this._metadata.activeView = undefined;
		}

		this._onViewDeleted.fire();
		this.commit();
	}

	public generateDefaultViewName(): string {
		let i = 1;
		let name = NotebookViewsExtension.defaultViewName;

		while (this.viewNameIsTaken(name) && i <= this.maxNameIterationAttempts) {
			name = `${NotebookViewsExtension.defaultViewName} ${i++}`;
		}

		return i <= this.maxNameIterationAttempts ? name : generateUuid();
	}

	public updateCell(cell: ICellModel, currentView: INotebookView, cellData: INotebookViewCell, override: boolean = false) {
		const cellMetadata = this.getCellMetadata(cell);
		const viewToUpdate = cellMetadata.views.findIndex(view => view.guid === currentView.guid);

		if (viewToUpdate >= 0) {
			cellMetadata.views[viewToUpdate] = override ? cellData : { ...cellMetadata.views[viewToUpdate], ...cellData };
			this.setCellMetadata(cell, cellMetadata);
		}
	}

	public get notebook(): INotebookModel {
		return this._notebook;
	}

	public getViews(): INotebookView[] {
		return this._metadata.views;
	}

	public getCells(): INotebookViewCellMetadata[] {
		return this._notebook.cells.map(cell => this.getCellMetadata(cell));
	}

	public getActiveView(): INotebookView {
		return this.getViews().find(view => view.guid === this._metadata.activeView);
	}

	public setActiveView(view: INotebookView) {
		this._metadata.activeView = view.guid;
	}

	public commit() {
		this.setNotebookMetadata(this._notebook, this._metadata);
	}

	public viewNameIsTaken(name: string): boolean {
		return !!this.getViews().find(v => v.name.toLowerCase() === name.toLowerCase());
	}

	public get onViewDeleted(): Event<void> {
		return this._onViewDeleted.event;
	}
}
