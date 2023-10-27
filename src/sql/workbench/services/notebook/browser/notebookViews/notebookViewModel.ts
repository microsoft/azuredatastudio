/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { ICellModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Emitter } from 'vs/base/common/event';
import { localize } from 'vs/nls';
import { INotebookView, INotebookViewCard, INotebookViewCell, ViewsTabConfig } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViews';
import { generateUuid } from 'vs/base/common/uuid';
import { IconPath } from 'azdata';

export const DEFAULT_VIEW_CARD_HEIGHT = 4;
export const DEFAULT_VIEW_CARD_WIDTH = 12;
export const GRID_COLUMNS = 12;

export class ViewNameTakenError extends Error { }

function cellCollides(c1: INotebookViewCard, c2: INotebookViewCard): boolean {
	return !((c1.y + c1.height <= c2.y) || (c1.x + c1.width <= c2.x) || (c1.x + c1.width <= c2.x) || (c2.x + c2.width <= c1.x));
}

export class ViewsTab implements ViewsTabConfig {
	cell: INotebookViewCell;
	title: string;
	id?: string;
	group: string;
	icon?: IconPath;
	cellModel: ICellModel;

	constructor(config: ViewsTabConfig, cell: ICellModel) {
		this.fromJSON(config, cell);
	}

	public toJSON() {
		return {
			cell: this.cell,
			title: this.title,
			id: this.id,
			group: this.group,
			icon: this.icon
		};
	}

	public fromJSON(config: ViewsTabConfig, cell: ICellModel): void {
		this.cell = config.cell;
		this.title = config.title;
		this.id = config.id;
		this.group = config.group;
		this.icon = config.icon;
		this.cellModel = cell;
	}
}

export class NotebookViewModel implements INotebookView {
	private _onDeleted = new Emitter<INotebookView>();
	private _onCellVisibilityChanged = new Emitter<ICellModel>();
	private _isNew: boolean = false;

	public readonly guid: string;
	public readonly onDeleted = this._onDeleted.event;
	public readonly onCellVisibilityChanged = this._onCellVisibilityChanged.event;

	constructor(
		protected _name: string,
		private _notebookViews: NotebookViewsExtension,
		private _cards: INotebookViewCard[] = [],
		guid?: string
	) {
		this.guid = guid ?? generateUuid();


		this._cards.forEach(card => {
			card.tabs.forEach(tab => {
				tab.cellModel = this.cells.find(c => c.cellGuid === tab.cell.guid);
			});
		});
	}

	public static load(guid: string, notebookViews: NotebookViewsExtension): INotebookView {
		const view = notebookViews.getViews().find(v => v.guid === guid);
		return new NotebookViewModel(view.name, notebookViews, view.cards, view.guid);
	}

	public initialize(isNew?: boolean): void {
		if (isNew) {
			this._isNew = isNew;
		}

		/// Initialize cards
		/// 0. Check that the cards object is created, or load them
		/// 1. Create a card per cell
		/// 2. Create a tab per cell
		/// 3. Title the tab with a sequential number i.e., Untitled Tab {1,2,3..}
		if (isNew) {
			this.initializeCards();
		}
	}

	public initializeCards() {
		const cells = this._notebookViews.notebook.cells;

		let card: INotebookViewCard;
		cells.forEach((cell, idx) => {
			card = {
				guid: generateUuid(),
				y: idx * DEFAULT_VIEW_CARD_HEIGHT,
				x: 0,
				width: DEFAULT_VIEW_CARD_WIDTH,
				height: DEFAULT_VIEW_CARD_HEIGHT,
				tabs: []
			};

			this.createTab(cell, card);

			this._cards.push(card);
		});
	}

	protected createTab(cell: ICellModel, card: INotebookViewCard): void {
		if (card === undefined) {
			throw new Error('A card must be specified to create a tab');
		}

		const newTab: ViewsTabConfig = { title: localize('Untitled', 'Untitled'), id: generateUuid(), group: card.guid, cell: { guid: cell.cellGuid } };
		card.tabs.push(new ViewsTab(newTab, cell));
	}

	public cellInitialized(cell: ICellModel): boolean {
		return !!this.getCellMetadata(cell);
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

	public getCellMetadata(cell: ICellModel): INotebookViewCard {
		const meta = this._notebookViews.getExtensionCellMetadata(cell);
		return meta?.views?.find(view => view.guid === this.guid);
	}

	public get hiddenCells(): Readonly<ICellModel[]> {
		const allTabs = this.cards.flatMap(card => card.tabs);
		return this.cells.filter(cell => !allTabs.find(t => t.cell.guid === cell.cellGuid));
	}

	public get cards(): INotebookViewCard[] {
		return this._cards;
	}

	public get cells(): Readonly<ICellModel[]> {
		return this._notebookViews.notebook.cells;
	}

	public get displayedCells(): Readonly<ICellModel[]> {
		return this.cells.filter(cell => !this.getCellMetadata(cell)?.hidden);
	}

	public getCell(guid: string): Readonly<ICellModel> {
		return this._notebookViews.notebook.cells.find(cell => cell.cellGuid === guid);
	}

	public updateCell(cell: ICellModel, currentView: INotebookView, cellData: INotebookViewCard, override: boolean = false) {
		this._notebookViews.updateCell(cell, currentView, cellData, override);
	}

	public insertCell(cell: ICellModel): INotebookViewCard {
		let card: INotebookViewCard = {
			guid: generateUuid(),
			y: 0,
			x: 0,
			width: DEFAULT_VIEW_CARD_WIDTH,
			height: DEFAULT_VIEW_CARD_HEIGHT,
			tabs: []
		};

		this.createTab(cell, card);

		this._cards.push(card);

		this._onCellVisibilityChanged.fire(cell);

		this.save();

		return card;
	}

	public hideCell(cell: ICellModel) {
		this.cards.forEach((card) => {
			const updatedTabs = card.tabs.filter(t => t.cell.guid !== cell.cellGuid);
			this._notebookViews.updateCard(card, { tabs: updatedTabs }, this);

			// If there are no tabs left in the card, delete the card
			if (!updatedTabs.length) {
				const index = this.cards.findIndex(c => c.guid === card.guid);
				const removedCard = this._cards.splice(index, 1);
				if (removedCard.length === 1) {
					this.compactCells();
					this.save();
				}
			}
		});
		this._onCellVisibilityChanged.fire(cell);
	}

	public moveCard(card: INotebookViewCard, x: number, y: number) {
		this._notebookViews.updateCard(card, { x, y }, this);
	}

	public resizeCard(card: INotebookViewCard, width?: number, height?: number) {
		let data: INotebookViewCard = {};

		if (width) {
			data.width = width;
		}

		if (height) {
			data.height = height;
		}

		this._notebookViews.updateCard(card, data, this);
	}

	public resizeCell(cell: ICellModel, width?: number, height?: number) {
		let data: INotebookViewCard = {};

		if (width) {
			data.width = width;
		}

		if (height) {
			data.height = height;
		}

		this.updateCell(cell, this, data);
	}

	public getCellSize(cell: ICellModel): any {
		const meta = this.getCellMetadata(cell);
		return { width: meta.width, height: meta.height };
	}

	public compactCells() {
		let cardsPlaced: INotebookViewCard[] = [];

		this.cards.forEach((card: INotebookViewCard) => {

			for (let i = 0; ; i++) {
				const row = i % GRID_COLUMNS;
				const column = Math.floor(i / GRID_COLUMNS);

				if (row + card.width > GRID_COLUMNS) {
					continue;
				}

				if (!cardsPlaced.find((c2) => cellCollides(c2, { ...card, x: row, y: column }))) {
					this._notebookViews.updateCard(card, { x: row, y: column }, this);
					cardsPlaced.push({ ...card, x: row, y: column });
					break;
				}
			}
		});
	}

	public save() {
		this._notebookViews.commit();
	}

	public delete() {
		this._notebookViews.removeView(this.guid);
		this._onDeleted.fire(this);
	}

	public get isNew(): boolean {
		return this._isNew;
	}

	public markAsViewed() {
		this._isNew = false;
	}

	public toJSON() {
		return { guid: this.guid, name: this._name, cards: this.cards } as INotebookView;
	}
}
