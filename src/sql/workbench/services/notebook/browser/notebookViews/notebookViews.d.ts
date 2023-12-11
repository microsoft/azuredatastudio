/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TabConfig } from 'sql/workbench/browser/modelComponents/tabbedPanel.component';
import { ICellModel, INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { ViewsTab } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewModel';
import { NotebookViewsExtension } from 'sql/workbench/services/notebook/browser/notebookViews/notebookViewsExtension';
import { Event } from 'vs/base/common/event';

export type CellChangeEventType = 'hide' | 'insert' | 'active' | 'execution' | 'update';

export type CellChangeEvent = {
	cell: ICellModel,
	event: CellChangeEventType
};

export interface INotebookViewsExtensionUpgrade {
	readonly sourceVersion: number;
	readonly targetVersion: number;
	versionCheck(version: number): boolean;
	apply(extension: NotebookViewsExtension): void;
}

export interface INotebookViews {
	onActiveViewChanged: Event<void>;
	createNewView(name?: string): INotebookView;
	removeView(guid: string): void;
	getActiveView(): INotebookView;
	setActiveView(view: INotebookView);
	viewNameIsTaken(name: string): boolean;
	metadata: INotebookViewMetadata;
}

export interface INotebookView {
	readonly guid: string;
	readonly onDeleted: Event<INotebookView>;
	readonly onCellVisibilityChanged: Event<ICellModel>;

	isNew: boolean;
	cards: INotebookViewCard[];
	cells: Readonly<ICellModel[]>;
	hiddenCells: Readonly<ICellModel[]>;
	displayedCells: Readonly<ICellModel[]>;
	name: string;
	initialize(isNew?: boolean): void;
	nameAvailable(name: string): boolean;
	getCellMetadata(cell: ICellModel): INotebookViewCard;
	hideCell(cell: ICellModel): void;
	moveCard(card: INotebookViewCard, x: number, y: number): void;
	compactCells();
	resizeCard(card: INotebookViewCard, width: number, height: number): void;
	resizeCell(cell: ICellModel, width: number, height: number): void;
	getCell(guid: string): Readonly<ICellModel>;
	insertCell(cell: ICellModel): INotebookViewCard;
	markAsViewed(): void;
	save(): void;
	delete(): void;
}

export interface INotebookViewCell {
	readonly guid?: string;
}


export interface INotebookViewCard {
	readonly guid?: string;
	hidden?: boolean;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	tabs?: ViewsTab[];
	activeTab?: ViewsTab;
}

interface ViewsTabConfig extends TabConfig {
	cell: INotebookViewCell
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
	views: INotebookViewCard[];
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
