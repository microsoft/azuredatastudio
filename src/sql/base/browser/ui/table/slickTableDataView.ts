/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposableDataProvider } from 'sql/base/browser/ui/table/interfaces';

export class SlickTableDataView<T extends Slick.SlickData> extends Slick.Data.DataView<T>
	implements IDisposableDataProvider<T>
{
	push(items: Array<T>): void;
	push(item: T): void;
	push(input: T | Array<T>): void {
		let inputArray = new Array();
		if (Array.isArray(input)) {
			inputArray.push(...input);
		} else {
			inputArray.push(input);
		}

		this.beginUpdate();
		inputArray.forEach(item => this.addItem(item));
		this.endUpdate();
	}

	public setData(data: T[]): void {
		let inputArray = new Array();
		inputArray.push(...data);
		this.setItems(inputArray, '__id__');
	}

	dispose(): void {

	}

}
