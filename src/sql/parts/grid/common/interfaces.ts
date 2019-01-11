
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ISlickColumn, VirtualizedCollection } from 'angular2-slickgrid';

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
	dataRows: VirtualizedCollection<{}>;
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
	selection: Slick.Range[];
	gridIndex: number;
	rowIndex?: number;
}
export interface ISaveRequest {
	format: SaveFormat;
	batchIndex: number;
	resultSetNumber: number;
	selection: Slick.Range[];
}