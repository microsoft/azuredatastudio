/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerData, DesignerEdit, DesignerEditResult, DesignerProvider, DesignerView } from 'sql/base/browser/ui/designer/interfaces';

export class TableDesignerProvider implements DesignerProvider {

	private _data: DesignerData;
	constructor() {
		this._data = {
			'name': {
				value: 'test table'
			}
		};
	}

	getView(): Promise<DesignerView> {
		const view: DesignerView = {
			tabs: [
				{
					title: 'Columns',
					components: [
						{
							type: 'input',
							property: 'name',
							inputType: 'text'
						}
					]
				}
			]
		};

		return Promise.resolve(view);
	}

	getData(): Promise<DesignerData> {
		return Promise.resolve(this._data);
	}

	processEdit(edit: DesignerEdit): Promise<DesignerEditResult> {
		this._data['name'] = edit.value;
		return Promise.resolve({
			isValid: true
		});
	}

}
