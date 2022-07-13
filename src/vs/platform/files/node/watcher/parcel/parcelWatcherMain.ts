/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ProxyChannel } from 'vs/base/parts/ipc/common/ipc';
import { Server } from 'vs/base/parts/ipc/node/ipc.cp';
import { ParcelWatcher } from 'vs/platform/files/node/watcher/parcel/parcelWatcher';

const server = new Server('watcher');
const service = new ParcelWatcher();
server.registerChannel('watcher', ProxyChannel.fromService(service));
