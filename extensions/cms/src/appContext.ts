/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { CmsUtils } from './cmsUtils';

/**
 * Global context for the application
 */
export class AppContext {

	constructor(
		public readonly extensionContext: vscode.ExtensionContext,
		public readonly cmsUtils: CmsUtils
	) { }
}
