/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { promises as fs } from 'fs';
import * as constants from '../../common/constants';

/**
 * Abstract class for a datasource in a project
 */
export abstract class DataSource {
	public name: string;
	public abstract get type(): string;
	public abstract get typeFriendlyName(): string;

	constructor(name: string) {
		this.name = name;
	}
}

export class NoDataSourcesFileError extends Error {
	constructor(message?: string) {
		super(message);
		Object.setPrototypeOf(this, new.target.prototype);
		this.name = NoDataSourcesFileError.name;
	}
}

/**
 * parses the specified file to load DataSource objects
 */
export async function load(dataSourcesFilePath: string): Promise<DataSource[]> {
	let fileContents;

	try {
		fileContents = await fs.readFile(dataSourcesFilePath);
	}
	catch (err) {
		// TODO: differentiate between file not existing and other types of failures; need to know whether to prompt to create new
		throw new NoDataSourcesFileError(constants.noDataSourcesFile);
	}

	const rawJsonContents = JSON.parse(fileContents.toString());

	if (rawJsonContents.version === undefined) {
		throw new Error(constants.missingVersion);
	}

	const output: DataSource[] = [];

	// TODO: do we have a construct for parsing version numbers?
	switch (rawJsonContents.version) {
		case '0.0.0':
			// const dataSources: DataSourceFileJson = rawJsonContents as DataSourceFileJson;

			// for (const source of dataSources.datasources) {
			// 	output.push(createDataSource(source));
			// }

			break;
		default:
			throw new Error(constants.unrecognizedDataSourcesVersion + rawJsonContents.version);
	}

	return output;
}

/**
 * Creates DataSource object from JSON
 */
// Commenting this out because circular dependency with SqlConnectionDataSource was causing extension to not activate
// function createDataSource(json: DataSourceJson): DataSource {
// 	switch (json.type) {
// 		case SqlConnectionDataSource.type:
// 			return SqlConnectionDataSource.fromJson(json);
// 		default:
// 			throw new Error(constants.unknownDataSourceType + json.type);
// 	}
// }
