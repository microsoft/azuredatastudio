/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MetadataType } from 'sql/platform/connection/common/connectionManagement';
import { FlavorProperties } from 'sql/workbench/contrib/dashboard/browser/dashboardRegistry';
import * as nls from 'vs/nls';

export const NameProperty: string = 'name';
const NamePropertyDisplayText: string = nls.localize('dashboard.explorer.namePropertyDisplayValue', "Name");

export class ExplorerView {
	constructor(private context: string) {
	}

	public getPropertyList(flavorProperties: FlavorProperties) {
		let propertyList;
		if (this.context === 'database') {
			if (flavorProperties && flavorProperties.objectsListProperties) {
				propertyList = flavorProperties.objectsListProperties;
			} else {
				propertyList = [{
					displayName: NamePropertyDisplayText,
					value: NameProperty,
					widthWeight: 60
				}, {
					displayName: nls.localize('dashboard.explorer.schemaDisplayValue', "Schema"),
					value: 'schema',
					widthWeight: 20
				}, {
					displayName: nls.localize('dashboard.explorer.objectTypeDisplayValue', "Type"),
					value: 'metadataTypeName',
					widthWeight: 20
				}];
			}
		} else {
			if (flavorProperties && flavorProperties.databasesListProperties) {
				propertyList = flavorProperties.databasesListProperties;
			} else {
				propertyList = [{
					displayName: NamePropertyDisplayText,
					value: NameProperty,
					widthWeight: 80
				}];
			}
		}
		return propertyList;
	}

	public getIconClass(item: Slick.SlickData): string {
		if (this.context === 'database') {
			let iconClass: string = undefined;
			switch (item.metadataType) {
				case MetadataType.Function:
					iconClass = 'scalarvaluedfunction';
					break;
				case MetadataType.SProc:
					iconClass = 'storedprocedure';
					break;
				case MetadataType.Table:
					iconClass = 'table';
					break;
				case MetadataType.View:
					iconClass = 'view';
					break;
			}
			return iconClass;
		} else {
			return 'database-colored';
		}
	}
}
