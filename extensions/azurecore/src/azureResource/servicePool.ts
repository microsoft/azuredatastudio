/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { ExtensionContext } from 'vscode';
import { ApiWrapper } from '../apiWrapper';

import {
	IAzureResourceAccountService,
	IAzureResourceSubscriptionService,
	IAzureResourceSubscriptionFilterService,
	IAzureResourceTenantService,
	IAzureResourceCacheService,
	ILogService} from './interfaces';

export class AzureResourceServicePool {
	private constructor() { }

	public static getInstance(): AzureResourceServicePool {
		return AzureResourceServicePool._instance;
	}

	public logSerivce: ILogService;
	public extensionContext: ExtensionContext;
	public apiWrapper: ApiWrapper;
	public cacheService: IAzureResourceCacheService;
	public accountService: IAzureResourceAccountService;
	public subscriptionService: IAzureResourceSubscriptionService;
	public subscriptionFilterService: IAzureResourceSubscriptionFilterService;
	public tenantServicxe: IAzureResourceTenantService;

	private static readonly _instance = new AzureResourceServicePool();
}
