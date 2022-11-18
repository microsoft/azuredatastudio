/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import { LanguageClient } from 'vscode-languageclient';
import { IDemoService } from '../abstract/IDemoService';
import * as contracts from '../../../models/contracts';

export class DemoService implements IDemoService {
	constructor(protected readonly client: LanguageClient) {

		client.onNotification("notification/addtest", (val: string) => this.handleNotification(val));
	}

	handleNotification(val: string) {
		console.log('Notification -> ' + val);
	}

	async testCall(a: number, b: number): Promise<Number> {

		try {
			var request = <contracts.TestOperation.Request>{
				a: a,
				b: b
			}

			return this.client.sendRequest(contracts.TestOperation.type, request);
		}
		catch (e) {
			this.client.logFailedRequest(contracts.TestOperation.type, e);
		}

		return Promise.resolve(0);
	}
}
