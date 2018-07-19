
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISlickColumn, IObservableCollection, IGridDataRow } from 'angular2-slickgrid';

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

export interface IGridDataSet {
	dataRows: IObservableCollection<IGridDataRow>;
	columnDefinitions: ISlickColumn<any>[];
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