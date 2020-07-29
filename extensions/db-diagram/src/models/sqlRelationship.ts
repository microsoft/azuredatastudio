/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import ISqlRelationship from './ISqlRelationship';

export default class SqlRelationship implements ISqlRelationship {
	relatedTableName: string;
	cardinality: string;
	reference: string;

	//constructor
	constructor(relatedTableName: string, cardinality: string, reference: string) {
		this.relatedTableName = relatedTableName;
		this.cardinality = cardinality;
		this.reference = reference;
	}

}
