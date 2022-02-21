/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
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
		// the path must have items and currently we support up to 5 items in the path.
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
			currentObject = tableData.data[objectIndex];
			index++;
		}
		return true;
	}
}
