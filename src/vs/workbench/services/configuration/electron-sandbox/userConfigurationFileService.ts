/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerMainProcessRemoteService } from 'vs/platform/ipc/electron-sandbox/services';
import { IUserConfigurationFileService, UserConfigurationFileServiceId } from 'vs/platform/configuration/common/userConfigurationFileService';

registerMainProcessRemoteService(IUserConfigurationFileService, UserConfigurationFileServiceId);
