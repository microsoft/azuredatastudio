/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AbstractEnablePreviewFeatures } from 'sql/workbench/common/enablePreviewFeatures';

export class BrowserEnablePreviewFeatures extends AbstractEnablePreviewFeatures {
	protected async getWindowCount(): Promise<number> {
		return 1;
	}
}
