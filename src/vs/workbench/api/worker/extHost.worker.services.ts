/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ILogService } from 'vs/platform/log/common/log';
import { IExtHostExtensionService } from 'vs/workbench/api/common/extHostExtensionService';
import { ExtensionStoragePaths, IExtensionStoragePaths } from 'vs/workbench/api/common/extHostStoragePaths';
import { ExtHostExtensionService } from 'vs/workbench/api/worker/extHostExtensionService';
import { ExtHostLogService } from 'vs/workbench/api/worker/extHostLogService';

// #########################################################################
// ###                                                                   ###
// ### !!! PLEASE ADD COMMON IMPORTS INTO extHost.common.services.ts !!! ###
// ###                                                                   ###
// #########################################################################

registerSingleton(IExtHostExtensionService, ExtHostExtensionService);
registerSingleton(ILogService, ExtHostLogService);
registerSingleton(IExtensionStoragePaths, ExtensionStoragePaths);
