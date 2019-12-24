/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileSystemProvider, FileSystemProviderCapabilities, IFileChange, IWatchOptions, IStat, FileType, FileDeleteOptions, FileOverwriteOptions } from 'vs/platform/files/common/files';
import { URI } from 'vs/base/common/uri';
import { IDisposable } from 'vs/base/common/lifecycle';
import { Emitter } from 'vs/base/common/event';
import { IOEShimService } from 'sql/workbench/contrib/objectExplorer/browser/objectExplorerViewTreeShim';
import { TreeItemCollapsibleState } from 'vs/workbench/common/views';
import { joinPath } from 'vs/base/common/resources';

export class ConnectionSystemProvider implements IFileSystemProvider {
	public static readonly SCHEME = 'MSSQL';

	private readonly handleMap = new Map<string, string>();

	get capabilities(): FileSystemProviderCapabilities {
		return FileSystemProviderCapabilities.Readonly;
	}

	constructor(@IOEShimService private oeService: IOEShimService) { }

	private readonly _onDidChangeCapabilities = new Emitter<void>();
	public readonly onDidChangeCapabilities = this._onDidChangeCapabilities.event;

	private readonly _onDidChangeFile = new Emitter<readonly IFileChange[]>();
	public readonly onDidChangeFile = this._onDidChangeFile.event;

	watch(resource: URI, opts: IWatchOptions): IDisposable {
		return { dispose: () => { } };
	}

	async stat(resource: URI): Promise<IStat> {
		return { ctime: 0, mtime: 0, size: 0, type: FileType.Directory };
	}

	mkdir(resource: URI): Promise<void> {
		throw new Error('Method not implemented.');
	}

	private queryToObject(query: string): { [key: string]: string } {
		const ret = Object.create(null);
		const queries = query.split('&');
		const params = queries.map(q => q.split('='));
		params.forEach(([key, value]) => {
			ret[key] = value;
		});
		return ret;
	}

	async readdir(resource: URI): Promise<[string, FileType, URI?][]> {
		const provider = resource.scheme;
		let server: string;
		let userName: string | undefined;
		let authority = resource.authority.split('@');
		if (authority.length === 1) {
			server = authority[0];
		} else {
			userName = authority[0];
			server = authority.slice(1).join('@');
		}

		const { authenticationType } = this.queryToObject(resource.query);
		const [, database] = resource.path.split('/');
		const children = await this.oeService.getChildren({ payload: { providerName: provider, databaseName: database, serverName: server, userName, authenticationType, options: {} }, childProvider: provider, handle: this.handleMap.get(resource.toString()) || resource.toString(), collapsibleState: TreeItemCollapsibleState.None }, 'filexplorer');
		return children.map(v => {
			this.handleMap.set(joinPath(resource, v.label.label).toString(), v.handle);
			return [v.label.label, FileType.Directory];
		});
	}

	delete(resource: URI, opts: FileDeleteOptions): Promise<void> {
		throw new Error('Method not implemented.');
	}

	rename(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void> {
		throw new Error('Method not implemented.');
	}
}
