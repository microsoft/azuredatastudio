/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
export const SERVICE_ID = 'onboardingService';

export const IOnboardingService = createDecorator<IOnboardingService>(SERVICE_ID);

export interface IOnboardingService {
	_serviceBrand: undefined;
}
