/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { ExtHostOutputService2 } from 'vs/workbench/api/node/extHostOutputService';
import { ExtHostTerminalService } from 'vs/workbench/api/node/extHostTerminalService';
import { ExtHostTask } from 'vs/workbench/api/node/extHostTask';
// import { ExtHostDebugService } from 'vs/workbench/api/node/extHostDebugService'; {{SQL CARBON EDIT}}
import { NativeExtHostSearch } from 'vs/workbench/api/node/extHostSearch';
import { ExtHostExtensionService } from 'vs/workbench/api/node/extHostExtensionService';
import { ExtHostLogService } from 'vs/workbench/api/node/extHostLogService';
import { ExtHostTunnelService } from 'vs/workbench/api/node/extHostTunnelService';
// import { IExtHostDebugService } from 'vs/workbench/api/common/extHostDebugService'; {{SQL CARBON EDIT}}
import { IExtHostExtensionService } from 'vs/workbench/api/common/extHostExtensionService';
import { IExtHostOutputService } from 'vs/workbench/api/common/extHostOutput';
import { IExtHostSearch } from 'vs/workbench/api/common/extHostSearch';
import { IExtHostTask } from 'vs/workbench/api/common/extHostTask';
import { IExtHostTerminalService } from 'vs/workbench/api/common/extHostTerminalService';
import { IExtHostTunnelService } from 'vs/workbench/api/common/extHostTunnelService';
import { ILogService } from 'vs/platform/log/common/log';
import { IExtensionStoragePaths } from 'vs/workbench/api/common/extHostStoragePaths';
import { ExtensionStoragePaths } from 'vs/workbench/api/node/extHostStoragePaths';

// #########################################################################
// ###                                                                   ###
// ### !!! PLEASE ADD COMMON IMPORTS INTO extHost.common.services.ts !!! ###
// ###                                                                   ###
// #########################################################################

registerSingleton(IExtHostExtensionService, ExtHostExtensionService);
registerSingleton(ILogService, ExtHostLogService);
registerSingleton(IExtensionStoragePaths, ExtensionStoragePaths);

// registerSingleton(IExtHostDebugService, ExtHostDebugService); {{SQL CARBON EDIT}}
registerSingleton(IExtHostOutputService, ExtHostOutputService2);
registerSingleton(IExtHostSearch, NativeExtHostSearch);
registerSingleton(IExtHostTask, ExtHostTask);
registerSingleton(IExtHostTerminalService, ExtHostTerminalService);
registerSingleton(IExtHostTunnelService, ExtHostTunnelService);
