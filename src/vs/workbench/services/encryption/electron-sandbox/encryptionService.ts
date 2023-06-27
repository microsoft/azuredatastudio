/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { registerMainProcessRemoteService } from 'vs/platform/ipc/electron-sandbox/services';
import { IEncryptionService } from 'vs/workbench/services/encryption/common/encryptionService';

registerMainProcessRemoteService(IEncryptionService, 'encryption');
