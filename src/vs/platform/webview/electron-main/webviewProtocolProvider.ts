/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { protocol } from 'electron';
import { Disposable, toDisposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { URI } from 'vs/base/common/uri';
import { streamToNodeReadable } from 'vs/base/node/stream';
import { IFileService } from 'vs/platform/files/common/files';
import { IRemoteConnectionData } from 'vs/platform/remote/common/remoteAuthorityResolver';
import { IRequestService } from 'vs/platform/request/common/request';
import { loadLocalResourceStream, WebviewResourceResponse } from 'vs/platform/webview/common/resourceLoader';

interface WebviewMetadata {
	readonly extensionLocation: URI | undefined;
	readonly localResourceRoots: readonly URI[];
	readonly remoteConnectionData: IRemoteConnectionData | null;
}

export class WebviewProtocolProvider extends Disposable {

	private readonly webviewMetadata = new Map<string, WebviewMetadata>();

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IRequestService private readonly requestService: IRequestService,
	) {
		super();

		protocol.registerStreamProtocol(Schemas.vscodeWebviewResource, async (request, callback): Promise<void> => {
			try {
				const uri = URI.parse(request.url);

				const id = uri.authority;
				const metadata = this.webviewMetadata.get(id);
				if (metadata) {
					const result = await loadLocalResourceStream(uri, {
						extensionLocation: metadata.extensionLocation,
						roots: metadata.localResourceRoots,
						remoteConnectionData: metadata.remoteConnectionData,
					}, this.fileService, this.requestService);
					if (result.type === WebviewResourceResponse.Type.Success) {
						return callback({
							statusCode: 200,
							data: streamToNodeReadable(result.stream),
							headers: {
								'Content-Type': result.mimeType,
								'Access-Control-Allow-Origin': '*',
							}
						});
					}

					if (result.type === WebviewResourceResponse.Type.AccessDenied) {
						console.error('Webview: Cannot load resource outside of protocol root');
						return callback({ data: null, statusCode: 401 });
					}
				}
			} catch {
				// noop
			}

			return callback({ data: null, statusCode: 404 });
		});

		this._register(toDisposable(() => protocol.unregisterProtocol(Schemas.vscodeWebviewResource)));
	}

	public async registerWebview(id: string, metadata: WebviewMetadata): Promise<void> {
		this.webviewMetadata.set(id, metadata);
	}

	public unreigsterWebview(id: string): void {
		this.webviewMetadata.delete(id);
	}

	public async updateWebviewMetadata(id: string, metadataDelta: Partial<WebviewMetadata>): Promise<void> {
		const entry = this.webviewMetadata.get(id);
		if (entry) {
			this.webviewMetadata.set(id, {
				...entry,
				...metadataDelta,
			});
		}
	}
}
