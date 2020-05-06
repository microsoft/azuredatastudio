/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ObjectListViewProperty } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import { MetadataType } from 'sql/platform/connection/common/connectionManagement';

export class ExplorerFilter {
	constructor(private context: string, private propertyList: ObjectListViewProperty[]) {
	}

	public filter(filterString: string, data: Slick.SlickData[]): Slick.SlickData[] {
		if (filterString) {
			let metadataType: MetadataType;
			if (this.context === 'database' && filterString.indexOf(':') > -1) {
				const filterArray = filterString.split(':');

				if (filterArray.length > 2) {
					filterString = filterArray.slice(1, filterArray.length - 1).join(':');
				} else {
					filterString = filterArray[1];
				}

				switch (filterArray[0].toLowerCase()) {
					case 'v':
						metadataType = MetadataType.View;
						break;
					case 't':
						metadataType = MetadataType.Table;
						break;
					case 'sp':
						metadataType = MetadataType.SProc;
						break;
					case 'f':
						metadataType = MetadataType.Function;
						break;
					default:
						break;
				}
			}

			return data.filter((item: Slick.SlickData) => {
				if (metadataType !== undefined && item.metadataType !== metadataType) {
					return false;
				}
				const keys = this.propertyList.map(property => property.value);
				let match = false;
				for (let i = 0; i < keys.length; i++) {
					const property = keys[i];
					const val = item[property];
					if (item[property] && typeof val === 'string' &&
						val.toLowerCase().indexOf(filterString.toLowerCase()) !== -1) {
						match = true;
						break;
					}
				}
				return match;
			});
		} else {
			return data;
		}
	}
}
