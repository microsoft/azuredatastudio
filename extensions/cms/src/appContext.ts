/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ApiWrapper } from './apiWrapper';
import { CmsUtils } from './cmsUtils';

/**
 * Global context for the application
 */
export class AppContext {

	constructor(
		public readonly extensionContext: vscode.ExtensionContext,
		public readonly apiWrapper: ApiWrapper,
		public readonly cmsUtils: CmsUtils
	) { }
}
