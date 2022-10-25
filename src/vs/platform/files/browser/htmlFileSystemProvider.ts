/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import { VSBuffer } from 'vs/base/common/buffer';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Event } from 'vs/base/common/event';
import { Disposable, IDisposable } from 'vs/base/common/lifecycle';
import { Schemas } from 'vs/base/common/network';
import { basename, extname, normalize } from 'vs/base/common/path';
import { isLinux } from 'vs/base/common/platform';
import { extUri, extUriIgnorePathCase } from 'vs/base/common/resources';
import { newWriteableStream, ReadableStreamEvents } from 'vs/base/common/stream';
import { createFileSystemProviderError, IFileDeleteOptions, IFileOverwriteOptions, IFileReadStreamOptions, FileSystemProviderCapabilities, FileSystemProviderError, FileSystemProviderErrorCode, FileType, IFileWriteOptions, IFileSystemProviderWithFileReadStreamCapability, IFileSystemProviderWithFileReadWriteCapability, IStat, IWatchOptions } from 'vs/platform/files/common/files';
import { WebFileSystemAccess } from 'vs/platform/files/browser/webFileSystemAccess';
import { IndexedDB } from 'vs/base/browser/indexedDB';
import { ILogService } from 'vs/platform/log/common/log';

export class HTMLFileSystemProvider implements IFileSystemProviderWithFileReadWriteCapability, IFileSystemProviderWithFileReadStreamCapability {

	//#region Events (unsupported)

	readonly onDidChangeCapabilities = Event.None;
	readonly onDidChangeFile = Event.None;

	//#endregion

	//#region File Capabilities

	private extUri = isLinux ? extUri : extUriIgnorePathCase;

	private _capabilities: FileSystemProviderCapabilities | undefined;
	get capabilities(): FileSystemProviderCapabilities {
		if (!this._capabilities) {
			this._capabilities =
				FileSystemProviderCapabilities.FileReadWrite |
				FileSystemProviderCapabilities.FileReadStream;

			if (isLinux) {
				this._capabilities |= FileSystemProviderCapabilities.PathCaseSensitive;
			}
		}

		return this._capabilities;
	}

	//#endregion


	constructor(
		private indexedDB: IndexedDB | undefined,
		private readonly store: string,
		private logService: ILogService
	) { }

	//#region File Metadata Resolving

	async stat(resource: URI): Promise<IStat> {
		try {
			const handle: any = await this.getHandle(resource);
			if (!handle) {
				throw this.createFileSystemProviderError(resource, 'No such file or directory, stat', FileSystemProviderErrorCode.FileNotFound);
			}

			if (WebFileSystemAccess.isFileSystemFileHandle(handle)) {
				const file = await handle.getFile();

				return {
					type: FileType.File,
					mtime: file.lastModified,
					ctime: 0,
					size: file.size
				};
			}

			return {
				type: FileType.Directory,
				mtime: 0,
				ctime: 0,
				size: 0
			};
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	async readdir(resource: URI): Promise<[string, FileType][]> {
		try {
			const handle: any = await this.getDirectoryHandle(resource);
			if (!handle) {
				throw this.createFileSystemProviderError(resource, 'No such file or directory, readdir', FileSystemProviderErrorCode.FileNotFound);
			}

			const result: [string, FileType][] = [];

			for await (const [name, child] of handle) {
				result.push([name, WebFileSystemAccess.isFileSystemFileHandle(child) ? FileType.File : FileType.Directory]);
			}

			return result;
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	//#endregion

	//#region File Reading/Writing

	readFileStream(resource: URI, opts: IFileReadStreamOptions, token: CancellationToken): ReadableStreamEvents<Uint8Array> {
		const stream = newWriteableStream<Uint8Array>(data => VSBuffer.concat(data.map(data => VSBuffer.wrap(data))).buffer, {
			// Set a highWaterMark to prevent the stream
			// for file upload to produce large buffers
			// in-memory
			highWaterMark: 10
		});

		(async () => {
			try {
				const handle = await this.getFileHandle(resource);
				if (!handle) {
					throw this.createFileSystemProviderError(resource, 'No such file or directory, readFile', FileSystemProviderErrorCode.FileNotFound);
				}

				const file = await handle.getFile();

				// Partial file: implemented simply via `readFile`
				if (typeof opts.length === 'number' || typeof opts.position === 'number') {
					let buffer = new Uint8Array(await file.arrayBuffer());

					if (typeof opts?.position === 'number') {
						buffer = buffer.slice(opts.position);
					}

					if (typeof opts?.length === 'number') {
						buffer = buffer.slice(0, opts.length);
					}

					stream.end(buffer);
				}

				// Entire file
				else {
					// TODO@electron: duplicate type definitions originate from `@types/node/stream/consumers.d.ts`
					const reader: ReadableStreamDefaultReader<Uint8Array> = (file.stream() as unknown as ReadableStream<Uint8Array>).getReader();

					let res = await reader.read();
					while (!res.done) {
						if (token.isCancellationRequested) {
							break;
						}

						// Write buffer into stream but make sure to wait
						// in case the `highWaterMark` is reached
						await stream.write(res.value);

						if (token.isCancellationRequested) {
							break;
						}

						res = await reader.read();
					}
					stream.end(undefined);
				}
			} catch (error) {
				stream.error(this.toFileSystemProviderError(error));
				stream.end();
			}
		})();

		return stream;
	}

	async readFile(resource: URI): Promise<Uint8Array> {
		try {
			const handle = await this.getFileHandle(resource);
			if (!handle) {
				throw this.createFileSystemProviderError(resource, 'No such file or directory, readFile', FileSystemProviderErrorCode.FileNotFound);
			}

			const file = await handle.getFile();

			return new Uint8Array(await file.arrayBuffer());
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	async writeFile(resource: URI, content: Uint8Array, opts: IFileWriteOptions): Promise<void> {
		try {
			let handle: any = await this.getFileHandle(resource);

			// Validate target unless { create: true, overwrite: true }
			if (!opts.create || !opts.overwrite) {
				if (handle) {
					if (!opts.overwrite) {
						throw this.createFileSystemProviderError(resource, 'File already exists, writeFile', FileSystemProviderErrorCode.FileExists);
					}
				} else {
					if (!opts.create) {
						throw this.createFileSystemProviderError(resource, 'No such file, writeFile', FileSystemProviderErrorCode.FileNotFound);
					}
				}
			}

			// Create target as needed
			if (!handle) {
				const parent = await this.getDirectoryHandle(this.extUri.dirname(resource));
				if (!parent) {
					throw this.createFileSystemProviderError(resource, 'No such parent directory, writeFile', FileSystemProviderErrorCode.FileNotFound);
				}

				handle = await parent.getFileHandle(this.extUri.basename(resource), { create: true });
				if (!handle) {
					throw this.createFileSystemProviderError(resource, 'Unable to create file , writeFile', FileSystemProviderErrorCode.Unknown);
				}
			}

			// Write to target overwriting any existing contents
			const writable = await handle.createWritable();
			await writable.write(content);
			await writable.close();
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	//#endregion

	//#region Move/Copy/Delete/Create Folder

	async mkdir(resource: URI): Promise<void> {
		try {
			const parent = await this.getDirectoryHandle(this.extUri.dirname(resource));
			if (!parent) {
				throw this.createFileSystemProviderError(resource, 'No such parent directory, mkdir', FileSystemProviderErrorCode.FileNotFound);
			}

			await parent.getDirectoryHandle(this.extUri.basename(resource), { create: true });
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	async delete(resource: URI, opts: IFileDeleteOptions): Promise<void> {
		try {
			const parent = await this.getDirectoryHandle(this.extUri.dirname(resource));
			if (!parent) {
				throw this.createFileSystemProviderError(resource, 'No such parent directory, delete', FileSystemProviderErrorCode.FileNotFound);
			}

			return parent.removeEntry(this.extUri.basename(resource), { recursive: opts.recursive });
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	async rename(from: URI, to: URI, opts: IFileOverwriteOptions): Promise<void> {
		try {
			if (this.extUri.isEqual(from, to)) {
				return; // no-op if the paths are the same
			}

			// Implement file rename by write + delete
			let fileHandle = await this.getFileHandle(from);
			if (fileHandle) {
				const file = await fileHandle.getFile();
				const contents = new Uint8Array(await file.arrayBuffer());

				await this.writeFile(to, contents, { create: true, overwrite: opts.overwrite, unlock: false });
				await this.delete(from, { recursive: false, useTrash: false });
			}

			// File API does not support any real rename otherwise
			else {
				throw this.createFileSystemProviderError(from, localize('fileSystemRenameError', "Rename is only supported for files."), FileSystemProviderErrorCode.Unavailable);
			}
		} catch (error) {
			throw this.toFileSystemProviderError(error);
		}
	}

	//#endregion

	//#region File Watching (unsupported)

	watch(resource: URI, opts: IWatchOptions): IDisposable {
		return Disposable.None;
	}

	//#endregion

	//#region File/Directoy Handle Registry

	private readonly _files = new Map<string, FileSystemFileHandle>();
	private readonly _directories = new Map<string, FileSystemDirectoryHandle>();

	registerFileHandle(handle: FileSystemFileHandle): Promise<URI> {
		return this.registerHandle(handle, this._files);
	}

	registerDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<URI> {
		return this.registerHandle(handle, this._directories);
	}

	get directories(): Iterable<FileSystemDirectoryHandle> {
		return this._directories.values();
	}

	private async registerHandle(handle: FileSystemHandle, map: Map<string, FileSystemHandle>): Promise<URI> {
		let handleId = `/${handle.name}`;

		// Compute a valid handle ID in case this exists already
		if (map.has(handleId) && !await map.get(handleId)?.isSameEntry(handle)) {
			const fileExt = extname(handle.name);
			const fileName = basename(handle.name, fileExt);

			let handleIdCounter = 1;
			do {
				handleId = `/${fileName}-${handleIdCounter++}${fileExt}`;
			} while (map.has(handleId) && !await map.get(handleId)?.isSameEntry(handle));
		}

		map.set(handleId, handle);

		// Remember in IndexDB for future lookup
		try {
			await this.indexedDB?.runInTransaction(this.store, 'readwrite', objectStore => objectStore.put(handle, handleId));
		} catch (error) {
			this.logService.error(error);
		}

		return URI.from({ scheme: Schemas.file, path: handleId });
	}

	async getHandle(resource: URI): Promise<FileSystemHandle | undefined> {

		// First: try to find a well known handle first
		let handle = await this.doGetHandle(resource);

		// Second: walk up parent directories and resolve handle if possible
		if (!handle) {
			const parent = await this.getDirectoryHandle(this.extUri.dirname(resource));
			if (parent) {
				const name = extUri.basename(resource);
				try {
					handle = await parent.getFileHandle(name);
				} catch (error) {
					try {
						handle = await parent.getDirectoryHandle(name);
					} catch (error) {
						// Ignore
					}
				}
			}
		}

		return handle;
	}

	private async getFileHandle(resource: URI): Promise<FileSystemFileHandle | undefined> {
		const handle = await this.doGetHandle(resource);
		if (handle instanceof FileSystemFileHandle) {
			return handle;
		}

		const parent = await this.getDirectoryHandle(this.extUri.dirname(resource));

		try {
			return await parent?.getFileHandle(extUri.basename(resource));
		} catch (error) {
			return undefined; // guard against possible DOMException
		}
	}

	private async getDirectoryHandle(resource: URI): Promise<FileSystemDirectoryHandle | undefined> {
		const handle = await this.doGetHandle(resource);
		if (handle instanceof FileSystemDirectoryHandle) {
			return handle;
		}

		const parentUri = this.extUri.dirname(resource);
		if (this.extUri.isEqual(parentUri, resource)) {
			return undefined; // return when root is reached to prevent infinite recursion
		}

		const parent = await this.getDirectoryHandle(parentUri);

		try {
			return await parent?.getDirectoryHandle(extUri.basename(resource));
		} catch (error) {
			return undefined; // guard against possible DOMException
		}
	}

	private async doGetHandle(resource: URI): Promise<FileSystemHandle | undefined> {

		// We store file system handles with the `handle.name`
		// and as such require the resource to be on the root
		if (this.extUri.dirname(resource).path !== '/') {
			return undefined;
		}

		const handleId = resource.path.replace(/\/$/, ''); // remove potential slash from the end of the path

		// First: check if we have a known handle stored in memory
		const inMemoryHandle = this._files.get(handleId) ?? this._directories.get(handleId);
		if (inMemoryHandle) {
			return inMemoryHandle;
		}

		// Second: check if we have a persisted handle in IndexedDB
		const persistedHandle = await this.indexedDB?.runInTransaction(this.store, 'readonly', store => store.get(handleId));
		if (WebFileSystemAccess.isFileSystemHandle(persistedHandle)) {
			let hasPermissions = await persistedHandle.queryPermission() === 'granted';
			try {
				if (!hasPermissions) {
					hasPermissions = await persistedHandle.requestPermission() === 'granted';
				}
			} catch (error) {
				this.logService.error(error); // this can fail with a DOMException
			}

			if (hasPermissions) {
				if (WebFileSystemAccess.isFileSystemFileHandle(persistedHandle)) {
					this._files.set(handleId, persistedHandle);
				} else if (WebFileSystemAccess.isFileSystemDirectoryHandle(persistedHandle)) {
					this._directories.set(handleId, persistedHandle);
				}

				return persistedHandle;
			}
		}

		// Third: fail with an error
		throw this.createFileSystemProviderError(resource, 'No file system handle registered', FileSystemProviderErrorCode.Unavailable);
	}

	//#endregion

	private toFileSystemProviderError(error: Error): FileSystemProviderError {
		if (error instanceof FileSystemProviderError) {
			return error; // avoid double conversion
		}

		let code = FileSystemProviderErrorCode.Unknown;
		if (error.name === 'NotAllowedError') {
			error = new Error(localize('fileSystemNotAllowedError', "Insufficient permissions. Please retry and allow the operation."));
			code = FileSystemProviderErrorCode.Unavailable;
		}

		return createFileSystemProviderError(error, code);
	}

	private createFileSystemProviderError(resource: URI, msg: string, code: FileSystemProviderErrorCode): FileSystemProviderError {
		return createFileSystemProviderError(new Error(`${msg} (${normalize(resource.path)})`), code);
	}
}
