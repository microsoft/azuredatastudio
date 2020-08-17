/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { PropertyItem } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';
import { DiagramRequestResult, GridData, DiagramMetadata } from 'sql/workbench/api/common/sqlExtHostTypes';

export default class GraphModel {

	name: string;

	propertyItems: PropertyItem[];

	groupsName: String = 'Schemas';

	nodesName: String = 'Tables';

	groupsColumns: Array<Slick.Column<any>> = [
		{
			name: 'Name',
			field: 'name',
			width: 80,
			id: 'name'
		},
		{
			name: 'Owner',
			field: 'owner',
			width: 80,
			id: 'owner'
		},
		{
			name: 'ID',
			field: 'id',
			width: 40,
			id: 'id'
		}
	];

	nodesColumns: Array<Slick.Column<any>> = [
		{
			name: 'Name',
			field: 'name',
			width: 80,
			id: 'name'
		},
		{
			name: 'Schema',
			field: 'schema',
			width: 80,
			id: 'schema'
		},
		{
			name: 'Rows',
			field: 'rows',
			width: 80,
			id: 'rows'
		},
		{
			name: 'Size (KB)',
			field: 'size',
			width: 80,
			id: 'size'
		},
		{
			name: 'Foreign Keys',
			field: 'foreignKeys',
			width: 80,
			id: 'foreignKeys'
		},
	];

	groupsItems: {
		name: string,
		owner: string,
		id: string,
	}[];

	nodeItems: {
		name: string,
		schema: string,
		rows: string,
		size: string
		foreignKeys: string
	}[];

	//constructor
	constructor(name: string, diagramMetadata) {
		this.name = name;
		this.loadPropertyItems(diagramMetadata.properties);
		this.loadGroupsItems(diagramMetadata.grids.dbSchemasGrid);
		this.loadNodeItems(diagramMetadata.grids.dbTablesGrid);
	}

	loadPropertyItems(metadataProperties) {
		this.propertyItems = [
			{ displayName: 'Database ID', value: metadataProperties.id },
			{ displayName: 'Size (MB)', value: metadataProperties.size },
			{ displayName: 'Create Date', value: metadataProperties.createDate },
			{ displayName: 'User Access', value: metadataProperties.userAccess },
		];
	}

	loadGroupsItems(metadataGroupData) {
		this.groupsItems = [];
		metadataGroupData.rows.forEach(row => {
			this.groupsItems.push(row);
		});
	}

	loadNodeItems(metadataNodeData) {
		this.nodeItems = [];
		let id = 0;
		metadataNodeData.rows.forEach(row => {
			let nodeRow = {
				name: row.name,
				schema: row.schema,
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
