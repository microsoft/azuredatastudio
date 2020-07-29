/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import ISqlColumn from './ISqlColumn';

export default class SqlColumn implements ISqlColumn {

	name: string;
	type: string;

	//constructor
	constructor(name: string, type: string) {
		this.name = name;
		this.type = type;
	}

}
