/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as request from 'request';

import { azureResource } from '../azure-resource';
import { IAzureResourceTenantService } from '../interfaces';

export class AzureResourceTenantService implements IAzureResourceTenantService {
	public async getTenantId(subscription: azureResource.AzureResourceSubscription): Promise<string> {
		const requestPromisified = new Promise<string>((resolve, reject) => {
			const url = `https://management.azure.com/subscriptions/${subscription.id}?api-version=2014-04-01`;
			request(url, function (error, response, body) {
				if (response.statusCode === 401) {
					const tenantIdRegEx = /authorization_uri="https:\/\/login\.windows\.net\/([0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12})"/;
					const teantIdString = response.headers['www-authenticate'];
					if (tenantIdRegEx.test(teantIdString)) {
						resolve(tenantIdRegEx.exec(teantIdString)[1]);
					} else {
						reject();
					}
				}
			});
		});

		return await requestPromisified;
	}
}