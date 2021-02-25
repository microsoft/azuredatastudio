/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AsyncDataProvider, IObservableCollection } from 'sql/base/browser/ui/table/asyncDataView';
import { IDisposableDataProvider } from 'sql/base/browser/ui/table/interfaces';
import { TableDataView, TableFilterFunc, TableSortFunc } from 'sql/base/browser/ui/table/tableDataView';
import { localize } from 'vs/nls';

export interface HybridDataProviderOptions {
	alwaysUseLocalData: boolean;
	localDataCountThreshold?: number;
}
const DefaultAsyncDataThreshold: number = 1000;

export class HybridDataProvider<T extends Slick.SlickData> implements IDisposableDataProvider<T> {
	private _asyncDataProvider: AsyncDataProvider<T>;
	private _tableDataProvider: TableDataView<T>;

	constructor(public dataRows: IObservableCollection<T>, filterFn: TableFilterFunc<T>, sortFn: TableSortFunc<T>, private readonly _options: HybridDataProviderOptions) {
		if (!this._options.alwaysUseLocalData && this._options.localDataCountThreshold === undefined) {
			this._options.localDataCountThreshold = DefaultAsyncDataThreshold;
		}
		this._asyncDataProvider = new AsyncDataProvider<T>(dataRows);
		this._tableDataProvider = new TableDataView<T>(undefined, undefined, sortFn, filterFn);
	}

	dispose(): void {
		this._asyncDataProvider.dispose();
		this._tableDataProvider.dispose();
	}
	getLength(): number {
		return this._asyncDataProvider.length;
	}

	getItem(index: number): T {
		return this._asyncDataProvider.getItem(index);
	}

	getItems(): T[] {
		if (this._options.alwaysUseLocalData || this.length <= this._options.localDataCountThreshold) {
			return this._tableDataProvider.getItems();
		}
		throw new Error(localize('hybridDataProvider.thresholdReached', "Access all items is not allowed when item count exceeds threshold."));
	}

	get length(): number {
		return this._asyncDataProvider.dataRows.getLength();
	}

	set length(value: number) {
		this._asyncDataProvider.dataRows.setLength(value);
	}

}
