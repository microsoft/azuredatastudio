/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';

export const INotebookKeymapService = createDecorator<INotebookKeymapService>('notebookKeymapService');

export interface INotebookKeymapService {
	readonly _serviceBrand: undefined;
}
