/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { ElectronExtensionService } from 'vs/workbench/services/extensions/electron-sandbox/electronExtensionService';

export class SandboxExtensionService extends ElectronExtensionService {
}

registerSingleton(IExtensionService, SandboxExtensionService);
