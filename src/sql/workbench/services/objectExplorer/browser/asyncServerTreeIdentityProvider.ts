/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IIdentityProvider } from 'vs/base/browser/ui/list/list';
import { ServerTreeElement } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';

export class AsyncServerTreeIdentityProvider implements IIdentityProvider<ServerTreeElement> {
	getId(element: ServerTreeElement): { toString(): string; } {
		return element.id!;
	}
}
