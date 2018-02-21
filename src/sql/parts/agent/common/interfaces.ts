/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as sqlops from 'sqlops';

export const SERVICE_ID = 'agentService';

export const IAgentService = createDecorator<IAgentService>(SERVICE_ID);

export interface IAgentService {
	_serviceBrand: any;

	registerProvider(providerId: string, provider: sqlops.AdminServicesProvider): void;
}
