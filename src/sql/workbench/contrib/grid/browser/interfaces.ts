/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VirtualizedCollection, ISlickColumn } from 'sql/base/browser/ui/table/asyncDataView';

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

export interface IGridInfo {
	batchIndex: number;
	resultSetNumber: number;
	selection: Slick.Range[];
	gridIndex: number;
	rowIndex?: number;
}
