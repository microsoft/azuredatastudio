/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBufferReadableStream } from 'vs/base/common/buffer';
import { CancellationToken } from 'vs/base/common/cancellation';
import { isUNC } from 'vs/base/common/extpath';
import { Schemas } from 'vs/base/common/network';
import { normalize, sep } from 'vs/base/common/path';
import { URI } from 'vs/base/common/uri';
import { FileOperationError, FileOperationResult, IFileService, IWriteFileOptions } from 'vs/platform/files/common/files';
import { ILogService } from 'vs/platform/log/common/log';
import { getWebviewContentMimeType } from 'vs/platform/webview/common/mimeTypes';

export namespace WebviewResourceResponse {
	export enum Type { Success, Failed, AccessDenied, NotModified }

	export class StreamSuccess {
		readonly type = Type.Success;

		constructor(
			public readonly stream: VSBufferReadableStream,
			public readonly etag: string | undefined,
			public readonly mtime: number | undefined,
			public readonly mimeType: string,
		) { }
	}

	export const Failed = { type: Type.Failed } as const;
	export const AccessDenied = { type: Type.AccessDenied } as const;

	export class NotModified {
		readonly type = Type.NotModified;

		constructor(
			public readonly mimeType: string,
			public readonly mtime: number | undefined,
		) { }
	}

	export type StreamResponse = StreamSuccess | typeof Failed | typeof AccessDenied | NotModified;
}

export async function loadLocalResource(
	requestUri: URI,
	options: {
		ifNoneMatch: string | undefined;
		roots: ReadonlyArray<URI>;
	},
	fileService: IFileService,
	logService: ILogService,
	token: CancellationToken,
): Promise<WebviewResourceResponse.StreamResponse> {
	logService.debug(`loadLocalResource - begin. requestUri=${requestUri}`);

	const resourceToLoad = getResourceToLoad(requestUri, options.roots);

	logService.debug(`loadLocalResource - found resource to load. requestUri=${requestUri}, resourceToLoad=${resourceToLoad}`);

	if (!resourceToLoad) {
		return WebviewResourceResponse.AccessDenied;
	}

	const mime = getWebviewContentMimeType(requestUri); // Use the original path for the mime

	try {
		const result = await fileService.readFileStream(resourceToLoad, { etag: options.ifNoneMatch }, token);
		return new WebviewResourceResponse.StreamSuccess(result.value, result.etag, result.mtime, mime);
	} catch (err) {
		if (err instanceof FileOperationError) {
			const result = err.fileOperationResult;

			// NotModified status is expected and can be handled gracefully
			if (result === FileOperationResult.FILE_NOT_MODIFIED_SINCE) {
				return new WebviewResourceResponse.NotModified(mime, (err.options as IWriteFileOptions | undefined)?.mtime);
			}
		}

		// Otherwise the error is unexpected.
		logService.debug(`loadLocalResource - Error using fileReader. requestUri=${requestUri}`);
		console.log(err);

		return WebviewResourceResponse.Failed;
	}
}

function getResourceToLoad(
	requestUri: URI,
	roots: ReadonlyArray<URI>,
): URI | undefined {
	for (const root of roots) {
		if (containsResource(root, requestUri)) {
			return normalizeResourcePath(requestUri);
		}
	}

	return undefined;
}

function containsResource(root: URI, resource: URI): boolean {
	if (root.scheme !== resource.scheme) {
		return false;
	}

	let resourceFsPath = normalize(resource.fsPath);
	let rootPath = normalize(root.fsPath + (root.fsPath.endsWith(sep) ? '' : sep));

	if (isUNC(root.fsPath) && isUNC(resource.fsPath)) {
		rootPath = rootPath.toLowerCase();
		resourceFsPath = resourceFsPath.toLowerCase();
	}

	return resourceFsPath.startsWith(rootPath);
}

function normalizeResourcePath(resource: URI): URI {
	// Rewrite remote uris to a path that the remote file system can understand
	if (resource.scheme === Schemas.vscodeRemote) {
		return URI.from({
			scheme: Schemas.vscodeRemote,
			authority: resource.authority,
			path: '/vscode-resource',
			query: JSON.stringify({
				requestResourcePath: resource.path
			})
		});
	}
	return resource;
}
