/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { PropertyItem } from 'sql/base/browser/ui/propertiesContainer/propertiesContainer.component';
import { DiagramRequestResult, GridData } from 'sql/workbench/api/common/sqlExtHostTypes';

export default class NodeModel {

	name: string;

	propertyItems: PropertyItem[];

	infoName: string = 'Columns';

	infoColumns: Array<Slick.Column<any>> = [
		{
			name: 'Name',
			field: 'name',
			width: 50,
			id: 'name'
		},
		{
			name: 'Type',
			field: 'type',
			width: 40,
			id: 'type'
		}
	];

	keys: {
		type: string,
		name: string
	}[];

	infoItems: {
		name: string,
		type: string
	}[];

	relatedNodesName: string = 'Relationships';

	relatedNodesColumns: Array<Slick.Column<any>> = [

		{
			name: 'Referencing Table',
			field: 'referencingTable',
			width: 250,
			id: 'referencingTable'
		},
		{
			name: 'Referencing Columns',
			field: 'referencingColumns',
			width: 270,
			id: 'referencingColumns'
		},
		{
			name: 'Referenced Table',
			field: 'referencedTable',
			width: 250,
			id: 'referencedTable'
		},
		{
			name: 'Referenced Columns',
			field: 'referencedColumns',
			width: 270,
			id: 'referencedColumns'
		},
		{
			name: 'Constraints',
			field: 'constraints',
			width: 250,
			id: 'constraints'
		}
	];

	relatedNodesItems: {
		referencingTable: string,
		referencingColumns: string,
		referencedTable: string,
		referencedColumns: string,
		constraints: string,
	}[];

	//constructor
	constructor(name: string, diagramMetadata) {
		this.name = name;
		this.loadPropertyItems(diagramMetadata.properties);
		this.loadInfoItems(diagramMetadata.grids.tableColumnsGrid);
		this.loadRelatedNodesItems(diagramMetadata.grids.tableRelationshipsGrid);
	}

	loadPropertyItems(metadataProperties) {
		this.propertyItems = [
			{ displayName: 'Schema', value: metadataProperties.schema },
			{ displayName: 'Rows', value: metadataProperties.rows },
			{ displayName: 'Size (KB)', value: metadataProperties.size },
			{ displayName: 'Foreign Keys', value: metadataProperties.foreignKeys },
		];
	}

	loadInfoItems(infoMetadata) {
		this.infoItems = [];
		let id = 0;
		infoMetadata.rows.forEach(row => {
			let infoRow = {
				name: row.name,
				type: row.type,
				id: id
			};
			this.infoItems.push(infoRow);
			id += 1;
		});
	}

	loadRelatedNodesItems(relatedNodesMetadata) {
		this.relatedNodesItems = [];
		let id = 0;
		relatedNodesMetadata.rows.forEach((row: {
			referencingTable: string,
			referencingColumns: string,
			referencedTable: string,
			referencedColumns: string,
			constraints: string,
		}) => {
			let relatedNodeRow = {
				referencingTable: row.referencingTable,
				referencingColumns: row.referencingColumns,
				referencedTable: row.referencedTable,
				referencedColumns: row.referencedColumns,
				constraints: row.constraints,
				id: id
			};
			this.relatedNodesItems.push(relatedNodeRow);
			id += 1;
		});
	}


}
