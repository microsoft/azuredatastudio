/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { DesignerPropertyPath, DesignerTableProperties, DesignerViewModel } from 'sql/workbench/browser/designer/interfaces';

export class DesignerPropertyPathValidator {

	/**
	 * Validate the path property, detail of the path can be found in the azdata typings file.
	 * @param path path of the property.
	 * @param viewModel the view model.
	 * @returns Whether the path is valid.
	 */
	static validate(path: DesignerPropertyPath, viewModel: DesignerViewModel): boolean {
		/**
		 * Path specification for all supported scenarios:
		 * 1. 'Add' scenario
		 *     a. ['propertyName1']. Example: add a column to the columns property: ['columns'].
		 *     b. ['propertyName1',index-1,'propertyName2']. Example: add a column mapping to the first foreign key: ['foreignKeys',0,'mappings'].
		 * 2. 'Update' scenario
		 *     a. ['propertyName1']. Example: update the name of the table: ['name'].
		 *     b. ['propertyName1',index-1,'propertyName2']. Example: update the name of a column: ['columns',0,'name'].
		 *     c. ['propertyName1',index-1,'propertyName2',index-2,'propertyName3']. Example: update the source column of an entry in a foreign key's column mapping table: ['foreignKeys',0,'mappings',0,'source'].
		 * 3. 'Remove' scenario
		 *     a. ['propertyName1',index-1]. Example: remove a column from the columns property: ['columns',0'].
		 *     b. ['propertyName1',index-1,'propertyName2',index-2]. Example: remove a column mapping from a foreign key's column mapping table: ['foreignKeys',0,'mappings',0].
		 */
		if (!path || path.length === 0 || path.length > 5) {
			return false;
		}

		for (let index = 0; index < path.length; index++) {
			const expectingNumber = (index % 2) !== 0;
			if (expectingNumber && typeof path[index] !== 'number') {
				return false;
			}

			if (!expectingNumber && typeof path[index] !== 'string') {
				return false;
			}
		}
		let currentObject = viewModel;
		for (let index = 0; index < path.length;) {
			const propertyName = <string>path[index];
			if (Object.keys(currentObject).indexOf(propertyName) === -1) {
				return false;
			}
			if (index === path.length - 1) {
				break;
			}
			index++;
			const tableData = <DesignerTableProperties>currentObject[propertyName];
			const objectIndex = <number>path[index];
			if (!tableData.data || tableData.data.length - 1 < objectIndex) {
				return false;
			}
			currentObject = tableData.data[objectIndex] as DesignerViewModel;
			index++;
		}
		return true;
	}
}
