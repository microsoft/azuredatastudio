/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Server } from 'vs/base/parts/ipc/node/ipc.cp';
import { WatcherChannel } from 'vs/platform/files/node/watcher/nsfw/watcherIpc';
import { NsfwWatcherService } from 'vs/platform/files/node/watcher/nsfw/nsfwWatcherService';

const server = new Server('watcher');
const service = new NsfwWatcherService();
const channel = new WatcherChannel(service);
server.registerChannel('watcher', channel);