/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { INotebookModel, ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { generateUuid } from 'vs/base/common/uuid';
import { Emitter, Event } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { NotebookViewModel } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { NotebookExtension } from 'sql/workbench/services/notebook/browser/models/notebookExtension';
import { INotebookView, INotebookViewCard, INotebookViewCellMetadata, INotebookViewMetadata, INotebookViews, INotebookViewsExtensionUpgrade } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { NotebookViewsUpgrades } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsUpgrades';



export class NotebookViewsExtension extends NotebookExtension<INotebookViewMetadata, INotebookViewCellMetadata> implements INotebookViews {
	static readonly defaultViewName = localize('notebookView.untitledView', "Untitled View");
	static readonly extension = 'notebookviews';
	static readonly upgrades: Array<INotebookViewsExtensionUpgrade> = [
		new NotebookViewsUpgrades.V1ToV2NotebookViewsExtensionUpgrade()
	];

	readonly maxNameIterationAttempts = 100;
	override readonly version: number = 2;

	protected _metadata: INotebookViewMetadata | undefined;
	private _initialized: boolean = false;
	private _onViewDeleted = new Emitter<void>();
	private _onActiveViewChanged = new Emitter<void>();

	constructor(protected _notebook: INotebookModel) {
		super(NotebookViewsExtension.extension);
		this.load();
	}

	public load(): void {
		this._metadata = this.getExtensionMetadata();

		if (this._metadata) {
			NotebookViewsExtension.upgrades.forEach(upgrade => {
				if (upgrade.versionCheck(this._metadata.version)) {
					upgrade.apply(this);
					this._metadata = this.getExtensionMetadata();
				}
			});

			this._metadata.views = this._metadata.views.map(view => NotebookViewModel.load(view.guid, this));
			this._initialized = true;
		}
	}

	public initialize() {
		this._metadata = this.getExtensionMetadata();

		if (!this._metadata) {
			this.initializeNotebook();
			this.initializeCells();
			this.commit();
		}

		this._initialized = true;
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

		this.setExtensionCellMetadata(cell, meta);
	}

	public createNewView(name?: string): INotebookView {
		const viewName = name || this.generateDefaultViewName();

		// If the notebook has not been initialized, do it now
		if (!this.initialized) {
			this.initialize();
		}

		const view = new NotebookViewModel(viewName, this);
		view.initialize(true);

		//Add view to the views metadata
		this._metadata = Object.assign({}, this._metadata, { views: [...this._metadata.views, view] });

		this.commit();

		return view;
	}

	public removeView(guid: string) {
		let viewToRemove = this._metadata?.views.findIndex(view => view.guid === guid);
		if (viewToRemove >= 0) {
			this._metadata?.views.splice(viewToRemove, 1);
		}

		if (guid === this._metadata?.activeView) {
			this._metadata.activeView = undefined;
		}

		this._metadata = Object.assign({}, this._metadata);

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

	public updateCell(cell: ICellModel, currentView: INotebookView, cellData: INotebookViewCard, override: boolean = false) {
		const cellMetadata = this.getExtensionCellMetadata(cell);
		if (cellMetadata) {
			const viewToUpdate = cellMetadata.views.findIndex(view => view.guid === currentView.guid);

			if (viewToUpdate >= 0) {
				cellMetadata.views[viewToUpdate] = override ? cellData : { ...cellMetadata.views[viewToUpdate], ...cellData };
				this.setExtensionCellMetadata(cell, cellMetadata);
			}
		}
	}

	public updateCard(card: INotebookViewCard, cardData: INotebookViewCard, currentView: INotebookView, override: boolean = false) {
		const notebookMetadata = this.getExtensionMetadata();
		if (notebookMetadata) {
			const viewToUpdate = notebookMetadata.views.findIndex(view => view.guid === currentView.guid);

			if (viewToUpdate >= 0) {
				const cardToUpdate = notebookMetadata.views[viewToUpdate].cards.findIndex(c => c.guid === card.guid);

				if (cardToUpdate >= 0) {
					notebookMetadata.views[viewToUpdate].cards[cardToUpdate] = override ? cardData : { ...notebookMetadata.views[viewToUpdate].cards[cardToUpdate], ...cardData };
					this.setExtensionMetadata(this._notebook, notebookMetadata);
				}
			}
		}
	}

	public get notebook(): INotebookModel {
		return this._notebook;
	}

	public getViews(): INotebookView[] {
		return this._metadata?.views ?? [];
	}

	public get metadata(): INotebookViewMetadata {
		return this._metadata;
	}

	public getCells(): INotebookViewCellMetadata[] {
		return this._notebook.cells.map(cell => this.getExtensionCellMetadata(cell));
	}

	public override getExtensionMetadata(): INotebookViewMetadata {
		return super.getExtensionMetadata(this._notebook);
	}

	public getActiveView(): INotebookView {
		return this.getViews().find(view => view.guid === this._metadata?.activeView);
	}

	public setActiveView(view: INotebookView) {
		if (this._metadata) {
			this._metadata.activeView = view.guid;
			this._onActiveViewChanged.fire();
		}
	}

	public commit() {
		this._metadata = Object.assign({}, this._metadata);
		this.setExtensionMetadata(this._notebook, this._metadata);
	}

	public viewNameIsTaken(name: string): boolean {
		return !!this.getViews().find(v => v.name.toLowerCase() === name.toLowerCase());
	}

	public get onViewDeleted(): Event<void> {
		return this._onViewDeleted.event;
	}

	public get onActiveViewChanged(): Event<void> {
		return this._onActiveViewChanged.event;
	}

	public get initialized(): boolean {
		return this._initialized;
	}
}
