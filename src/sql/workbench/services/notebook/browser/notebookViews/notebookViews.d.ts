/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICellModel, INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { Event } from 'vs/base/common/event';

export type CellChangeEventType = 'hide' | 'insert' | 'active';

export type CellChangeEvent = {
	cell: ICellModel,
	event: CellChangeEventType
};

export interface INotebookView {
	readonly guid: string;
	readonly onDeleted: Event<INotebookView>;

	isNew: boolean;
	cells: Readonly<ICellModel[]>;
	hiddenCells: Readonly<ICellModel[]>;
	displayedCells: Readonly<ICellModel[]>;
	name: string;
	initialize(): void;
	nameAvailable(name: string): boolean;
	getCellMetadata(cell: ICellModel): INotebookViewCell;
	hideCell(cell: ICellModel): void;
	moveCell(cell: ICellModel, x: number, y: number): void;
	compactCells();
	resizeCell(cell: ICellModel, width: number, height: number): void;
	getCell(guid: string): Readonly<ICellModel>;
	insertCell(cell: ICellModel): void;
	markAsViewed(): void;
	save(): void;
	delete(): void;
}

export interface INotebookViewCell {
	readonly guid?: string;
	hidden?: boolean;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
}

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

export interface INotebookViews {
	onViewDeleted: Event<void>;
	notebook: INotebookModel;

	createNewView(name?: string): INotebookView;
	removeView(guid: string): void;
	generateDefaultViewName(): string;
	getViews(): INotebookView[];
	getActiveView(): INotebookView;
	setActiveView(view: INotebookView): void;
	viewNameIsTaken(name: string): boolean;
}
