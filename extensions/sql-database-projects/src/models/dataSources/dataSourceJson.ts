/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * JSON format for datasources.json
 */
interface DataSourceFileJson {
	version: string;
	datasources: DataSourceJson[];
}

/**
 * JSON format for a datasource entry in datasources.json
 */
interface DataSourceJson {
	name: string;
	type: string;
	version: string;

	/**
	 * contents for concrete datasource implementation
	 */
	data: string;
}
