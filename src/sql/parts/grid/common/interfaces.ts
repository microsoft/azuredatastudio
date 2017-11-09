
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IColumnDefinition, IObservableCollection, IGridDataRow } from 'angular2-slickgrid';

export interface ISlickRange {
	fromCell: number;
	fromRow: number;
	toCell: number;
	toRow: number;
}

export interface IGridIcon {
	showCondition: () => boolean;
	icon: () => string;
	hoverText: () => string;
	functionality: (batchId: number, resultId: number, index: number) => void;
}

export interface IMessageLink {
	uri: string;
	text: string;
}

export interface IMessage {
	batchId?: number;
	time: string;
	message: string;
	isError: boolean;
	link?: IMessageLink;
}

export interface IGridIcon {
	showCondition: () => boolean;
	icon: () => string;
	hoverText: () => string;
	functionality: (batchId: number, resultId: number, index: number) => void;
}

/**
 * Simplified interface for a Range object returned by the Rangy javascript plugin
 *
 * @export
 * @interface IRange
 */
export interface IRange {
	selectNodeContents(el): void;
	/**
	 * Returns any user-visible text covered under the range, using standard HTML Range API calls
	 *
	 * @returns {string}
	 *
	 * @memberOf IRange
	 */
	toString(): string;
	/**
	 * Replaces the current selection with this range. Equivalent to rangy.getSelection().setSingleRange(range).
	 *
	 *
	 * @memberOf IRange
	 */
	select(): void;

	/**
	 * Returns the `Document` element containing the range
	 *
	 * @returns {Document}
	 *
	 * @memberOf IRange
	 */
	getDocument(): Document;

	/**
	 * Detaches the range so it's no longer tracked by Rangy using DOM manipulation
	 *
	 *
	 * @memberOf IRange
	 */
	detach(): void;

	/**
	 * Gets formatted text under a range. This is an improvement over toString() which contains unnecessary whitespac
	 *
	 * @returns {string}
	 *
	 * @memberOf IRange
	 */
	text(): string;
}

export interface IGridDataSet {
	dataRows: IObservableCollection<IGridDataRow>;
	columnDefinitions: IColumnDefinition[];
	resized: any; // EventEmitter<any>;
	totalRows: number;
	batchId: number;
	resultId: number;
	maxHeight: number | string;
	minHeight: number | string;
}

export enum SaveFormat {
	CSV = 'csv',
	JSON = 'json',
	EXCEL = 'excel',
	XML = 'xml'
}

export interface IGridInfo {
	batchIndex: number;
	resultSetNumber: number;
	selection: ISlickRange[];
	gridIndex: number;
	rowIndex?: number;
}
export interface ISaveRequest {
	format: SaveFormat;
	batchIndex: number;
	resultSetNumber: number;
	selection: ISlickRange[];
}