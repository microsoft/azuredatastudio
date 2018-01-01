/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as Contracts from '../models/contracts';
import { ICredentialStore } from './icredentialstore';
import { SqlToolsServiceClient, Utils } from 'extensions-modules';
import { SqlOpsDataClient } from 'dataprotocol-client';
import * as path from 'path';

/**
 * Implements a credential storage for Windows, Mac (darwin), or Linux.
 *
 * Allows a single credential to be stored per service (that is, one username per service);
 */
export class CredentialStore implements ICredentialStore {

	public languageClient: SqlOpsDataClient;

	constructor(private _client?: SqlToolsServiceClient) {
		if (!this._client) {
			this._client = SqlToolsServiceClient.getInstance(path.join(__dirname, '../config.json'));
		}
	}

	/**
	 * Gets a credential saved in the credential store
	 *
	 * @param {string} credentialId the ID uniquely identifying this credential
	 * @returns {Promise<Credential>} Promise that resolved to the credential, or undefined if not found
	 */
	public readCredential(credentialId: string): Promise<Contracts.Credential> {
		Utils.logDebug(this.languageClient, 'MainController._extensionConstants');
		let self = this;
		let cred: Contracts.Credential = new Contracts.Credential();
		cred.credentialId = credentialId;
		return new Promise<Contracts.Credential>((resolve, reject) => {
			self._client
				.sendRequest(Contracts.ReadCredentialRequest.type, cred, this.languageClient)
				.then(returnedCred => {
					resolve(<Contracts.Credential>returnedCred);
				}, err => reject(err));
		});
	}

	public saveCredential(credentialId: string, password: any): Promise<boolean> {
		let self = this;
		let cred: Contracts.Credential = new Contracts.Credential();
		cred.credentialId = credentialId;
		cred.password = password;
		return new Promise<boolean>((resolve, reject) => {
			self._client
				.sendRequest(Contracts.SaveCredentialRequest.type, cred, this.languageClient)
				.then(status => {
					resolve(<boolean>status);
				}, err => reject(err));
		});
	}

	public deleteCredential(credentialId: string): Promise<boolean> {
		let self = this;
		let cred: Contracts.Credential = new Contracts.Credential();
		cred.credentialId = credentialId;
		return new Promise<boolean>((resolve, reject) => {
			self._client
				.sendRequest(Contracts.DeleteCredentialRequest.type, cred, this.languageClient)
				.then(status => {
					resolve(<boolean>status);
				}, err => reject(err));
		});
	}
}
