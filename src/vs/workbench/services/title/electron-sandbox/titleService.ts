/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { TitlebarPart } from 'vs/workbench/electron-sandbox/parts/titlebar/titlebarPart';
import { ITitleService } from 'vs/workbench/services/title/common/titleService';

registerSingleton(ITitleService, TitlebarPart);
