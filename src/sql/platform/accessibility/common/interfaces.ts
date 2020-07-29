/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import * as azdata from 'azdata';

export const SERVICE_ID = 'accessibilityTextService';

export const IAccessibilityTextService = createDecorator<IAccessibilityTextService>(SERVICE_ID);

export enum AltTextTarget {
	Query = 0
}

export interface IAccessibilityTextService {
	_serviceBrand: undefined;

	/**
	 * Register an accessibility provider
	 */
	registerProvider(providerId: string, provider: azdata.AccessibilityProvider): void;


	getAltText(target: AltTextTarget, ownerUri: string): Thenable<string>;
}
