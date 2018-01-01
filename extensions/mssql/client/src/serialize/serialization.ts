/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as Contracts from '../models/contracts';
import { ISerialization } from './iserialization';
import { SqlToolsServiceClient } from 'extensions-modules';
import * as sqlops from 'sqlops';
import { SqlOpsDataClient } from 'dataprotocol-client';
import * as path from 'path';

/**
 * Implements serializer for query results
 */
export class Serialization implements ISerialization {

	constructor(private _client?: SqlToolsServiceClient, private _languageClient?: SqlOpsDataClient) {
		if (!this._client) {
			this._client = SqlToolsServiceClient.getInstance(path.join(__dirname, '../config.json'));
		}
	}

	/**
	 * Saves results as a specified path
	 *
	 * @param {string} credentialId the ID uniquely identifying this credential
	 * @returns {Promise<ISaveResultsInfo>} Promise that resolved to the credential, or undefined if not found
	 */
	public saveAs(saveFormat: string, savePath: string, results: string, appendToFile: boolean): Promise<sqlops.SaveResultRequestResult> {
		let self = this;
		let resultsInfo: Contracts.SaveResultsInfo = new Contracts.SaveResultsInfo(saveFormat, savePath, results, appendToFile);
		return new Promise<sqlops.SaveResultRequestResult>((resolve, reject) => {
			self._client
				.sendRequest(Contracts.SaveAsRequest.type, resultsInfo, this._languageClient)
				.then(result => {
					resolve(<sqlops.SaveResultRequestResult>result);
				}, err => reject(err));
		});
	}
}
