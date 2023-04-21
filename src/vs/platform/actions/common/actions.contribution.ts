/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IMenuService, registerAction2 } from 'vs/platform/actions/common/actions';
import { MenuHiddenStatesReset } from 'vs/platform/actions/common/menuResetAction';
import { MenuService } from 'vs/platform/actions/common/menuService';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';


registerSingleton(IMenuService, MenuService, true);

registerAction2(MenuHiddenStatesReset);
