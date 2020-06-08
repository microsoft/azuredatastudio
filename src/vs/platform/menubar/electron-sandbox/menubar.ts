/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { ICommonMenubarService } from 'vs/platform/menubar/common/menubar';

export const IMenubarService = createDecorator<IMenubarService>('menubarService');

export interface IMenubarService extends ICommonMenubarService {
	_serviceBrand: undefined;
}
