/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { generateUuid } from 'vs/base/common/uuid';
import { Emitter, Event } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { INotebookView, INotebookViewCellMetadata, INotebookViewMetadata, NotebookViewModel } from 'sql/workbench/services/notebook/browser/models/notebookViewModel';
//import { AutoDash } from 'sql/workbench/contrib/notebook/browser/notebookViews/autoDash';
import { NotebookMetadataService } from 'sql/workbench/services/notebook/browser/notebookMetadataService';

export interface INotebookViewCell {
	readonly guid?: string;
	hidden?: boolean;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

export class NotebookViewsExtension extends NotebookMetadataService {
	readonly maxNameIterationAttempts = 100;
	readonly extension = 'azuredatastudio';
	readonly version = 1;
	readonly defaultViewName = localize('notebookView.untitledView', "Untitled View");

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
		} else {
			this.loadViews();
		}
	}

	private loadViews() {
		this._metadata.views = this._metadata.views.map((view) => (
			new NotebookViewModel(view.guid, view.name, this._notebook, this
			)
		));
	}

	public get notebook(): INotebookModel {
		return this._notebook;
	}

	public commit() {
		this.setNotebookMetadata(this._notebook, this._metadata);
	}

	public getActiveView(): INotebookView {
		return this.getViews().find(view => view.guid === this._metadata.activeView);
	}

	public setActiveView(view: INotebookView) {
		this._metadata.activeView = view.guid;
	}

	public createNewView(name?: string): INotebookView {
		const viewGuid = generateUuid();
		const viewName = name || this.generateDefaultNameView(viewGuid);

		const view = new NotebookViewModel(viewGuid, viewName, this._notebook, this);
		view.initialize();

		//const service = new AutoDash();
		//service.generateLayout(view);

		this._metadata.views.push(view);

		return view;
	}

	public generateDefaultNameView(failsafeValue: string): string {
		let name = this.defaultViewName;
		let i = 1;

		while (this.viewNameIsTaken(name) && i < this.maxNameIterationAttempts) {
			name = `${this.defaultViewName} ${i++}`;
		}

		return i === this.maxNameIterationAttempts ? failsafeValue : name;
	}

	public removeView(guid: string) {
		let viewToRemove = this._metadata.views.findIndex(view => view.guid === guid);
		if (viewToRemove !== -1) { // findIndex returns -1 when no element is found
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

	public getViews(): INotebookView[] {
		return this._metadata.views;
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
