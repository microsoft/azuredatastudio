/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceTypePage } from '../../resourceTypePage';

export abstract class BasePage extends ResourceTypePage {

	protected liveValidation!: boolean;

	public initialize(): void {
		throw new Error('Method not implemented.');
	}

	protected async validatePage(): Promise<string> {
		return '';
	}

	protected activateRealTimeFormValidation(): void {
		if (this.liveValidation) {
			this.validatePage();
		}
	}
}
