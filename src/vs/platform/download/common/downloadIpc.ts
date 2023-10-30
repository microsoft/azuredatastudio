/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { URI } from 'vs/base/common/uri';
import { IURITransformer } from 'vs/base/common/uriIpc';
import { IChannel, IServerChannel } from 'vs/base/parts/ipc/common/ipc';
import { IDownloadService } from 'vs/platform/download/common/download';

export class DownloadServiceChannel implements IServerChannel {

	constructor(private readonly service: IDownloadService) { }

	listen(_: unknown, event: string, arg?: any): Event<any> {
		throw new Error('Invalid listen');
	}

	call(context: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'download': return this.service.download(URI.revive(args[0]), URI.revive(args[1]));
		}
		throw new Error('Invalid call');
	}
}

export class DownloadServiceChannelClient implements IDownloadService {

	declare readonly _serviceBrand: undefined;

	constructor(private channel: IChannel, private getUriTransformer: () => IURITransformer | null) { }

	async download(from: URI, to: URI): Promise<void> {
		const uriTransfomer = this.getUriTransformer();
		if (uriTransfomer) {
			from = uriTransfomer.transformOutgoingURI(from);
			to = uriTransfomer.transformOutgoingURI(to);
		}
		await this.channel.call('download', [from, to]);
	}
}
