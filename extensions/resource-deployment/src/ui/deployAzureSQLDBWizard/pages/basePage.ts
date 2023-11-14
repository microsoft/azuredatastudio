/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceTypePage } from '../../resourceTypePage';

export abstract class BasePage extends ResourceTypePage {
	public abstract override initialize(): void;
}
