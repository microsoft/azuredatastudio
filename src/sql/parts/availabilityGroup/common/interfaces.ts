/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as sqlops from 'sqlops';

export const SERVICE_ID = 'availabilityGroupService';

export const IAvailabilityGroupService = createDecorator<IAvailabilityGroupService>(SERVICE_ID);

export interface IAvailabilityGroupService {
	_serviceBrand: any;

	registerProvider(providerId: string, provider: sqlops.AvailabilityGroupServiceProvider): void;

	getAvailabilityGroups(connectionUri: string): Thenable<sqlops.AvailabilityGroupsResult>;
}