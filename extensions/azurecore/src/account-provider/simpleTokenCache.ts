/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as keytar from 'keytar';

export class SimpleTokenCache {
	constructor(
		private readonly serviceName: string
	) { }

	async addAccount(id: string, key: string): Promise<void> {
		return keytar.setPassword(this.serviceName, id, key);
	}

	async getCredential(id: string): Promise<string> {
		return keytar.getPassword(this.serviceName, id);
	}

	async clearCredential(id: string): Promise<boolean> {
		return keytar.deletePassword(this.serviceName, id);
	}

}
