/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { PropertyItem } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';
import { DiagramRequestResult, GridData, DiagramMetadata } from 'sql/workbench/api/common/sqlExtHostTypes';

export default class GroupModel {

	name: string;

	propertyItems: PropertyItem[];

	nodesName: String = 'Tables';

	nodesColumns: Array<Slick.Column<any>> = [
		{
			name: 'Name',
			field: 'name',
			width: 40,
			id: 'name'
		},
		{
			name: 'Rows',
			field: 'rows',
			width: 40,
			id: 'rows'
		},
		{
			name: 'Size (KB)',
			field: 'size',
			width: 40,
			id: 'size'
		},
		{
			name: 'Foreign Keys',
			field: 'foreignKeys',
			width: 40,
			id: 'foreignKeys'
		},
	];

	nodeItems: {
		name: string,
		rows: string,
		size: string
		foreignKeys: string
	}[];

	//constructor
	constructor(name: string, diagramMetadata) {
		this.name = name;
		this.loadPropertyItems(diagramMetadata.properties);
		this.loadNodeItems(diagramMetadata.grids.schemaTablesGrid);
	}

	loadPropertyItems(metadataProperties) {
		this.propertyItems = [
			{ displayName: 'Owner', value: metadataProperties.owner },
			{ displayName: 'ID', value: metadataProperties.id },
		];
	}

	loadNodeItems(nodesMetadata) {
		this.nodeItems = [];
		let id = 0;
		nodesMetadata.rows.forEach(row => {
			let nodeRow = {
				name: row.name,
				rows: row.rows,
				size: row.size,
				foreignKeys: row.foreignKeys,
				id: id
			};
			this.nodeItems.push(nodeRow);
			id += 1;
		});
	}
}
