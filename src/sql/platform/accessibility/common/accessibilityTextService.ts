/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as azdata from 'azdata';
import { AltTextTarget, IAccessibilityTextService } from 'sql/platform/accessibility/common/interfaces';

export class AccessibilityTextService implements IAccessibilityTextService {

	_serviceBrand: undefined;

	private _providers: { [handle: string]: azdata.AccessibilityProvider; } = Object.create(null);


	constructor(
		@IConnectionManagementService private _connectionService: IConnectionManagementService
	) { }

	/**
	 * Call the service for looking up an alt text string
	 */
	public getAltText(target: AltTextTarget, ownerUri: string): Thenable<string> {
		let providerId: string = this._connectionService.getProviderIdFromUri(ownerUri);
		if (providerId) {
			let provider = this._providers[providerId];
			if (provider) {
				return provider.getAltText(target, ownerUri);
			}
		}
		return Promise.resolve(undefined);
	}

	/**
	 * Register an accessibility provider
	 */
	public registerProvider(providerId: string, provider: azdata.AccessibilityProvider): void {
		this._providers[providerId] = provider;
	}

	public isProviderRegistered(providerId: string): boolean {
		let provider = this._providers[providerId];
		return !!provider;
	}
}
