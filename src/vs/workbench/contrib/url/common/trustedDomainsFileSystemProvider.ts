/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { parse } from 'vs/base/common/json';
import { IDisposable } from 'vs/base/common/lifecycle';
import { URI } from 'vs/base/common/uri';
import { FileDeleteOptions, FileOverwriteOptions, FileSystemProviderCapabilities, FileType, FileWriteOptions, IFileService, IStat, IWatchOptions, IFileSystemProviderWithFileReadWriteCapability } from 'vs/platform/files/common/files';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { VSBuffer } from 'vs/base/common/buffer';
import { readTrustedDomains, TRUSTED_DOMAINS_CONTENT_STORAGE_KEY, TRUSTED_DOMAINS_STORAGE_KEY } from 'vs/workbench/contrib/url/common/trustedDomains';
import { IProductService } from 'vs/platform/product/common/productService';
import { IStorageKeysSyncRegistryService } from 'vs/platform/userDataSync/common/storageKeys';

const TRUSTED_DOMAINS_SCHEMA = 'trustedDomains';

const TRUSTED_DOMAINS_STAT: IStat = {
	type: FileType.File,
	ctime: Date.now(),
	mtime: Date.now(),
	size: 0
};

const CONFIG_HELP_TEXT_PRE = `// Links matching one or more entries in the list below can be opened without link protection.
// The following examples show what entries can look like:
// - "https://microsoft.com": Matches this specific domain using https
// - "https://microsoft.com/foo": Matches https://microsoft.com/foo and https://microsoft.com/foo/bar,
//   but not https://microsoft.com/foobar or https://microsoft.com/bar
// - "https://*.microsoft.com": Match all domains ending in "microsoft.com" using https
// - "microsoft.com": Match this specific domain using either http or https
// - "*.microsoft.com": Match all domains ending in "microsoft.com" using either http or https
// - "*": Match all domains using either http or https
//
`;

const CONFIG_HELP_TEXT_AFTER = `//
// You can use the "Manage Trusted Domains" command to open this file.
// Save this file to apply the trusted domains rules.
`;

const CONFIG_PLACEHOLDER_TEXT = `[
	// "https://microsoft.com"
]`;

function computeTrustedDomainContent(defaultTrustedDomains: string[], trustedDomains: string[]) {
	let content = CONFIG_HELP_TEXT_PRE;

	if (defaultTrustedDomains.length > 0) {
		content += `// By default, VS Code trusts "localhost" as well as the following domains:\n`;
		defaultTrustedDomains.forEach(d => {
			content += `// - "${d}"\n`;
		});
	} else {
		content += `// By default, VS Code trusts "localhost".\n`;
	}

	content += CONFIG_HELP_TEXT_AFTER;

	if (trustedDomains.length === 0) {
		content += CONFIG_PLACEHOLDER_TEXT;
	} else {
		content += JSON.stringify(trustedDomains, null, 2);
	}

	return content;
}

export class TrustedDomainsFileSystemProvider implements IFileSystemProviderWithFileReadWriteCapability, IWorkbenchContribution {
	readonly capabilities = FileSystemProviderCapabilities.FileReadWrite;

	readonly onDidChangeCapabilities = Event.None;
	readonly onDidChangeFile = Event.None;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IStorageService private readonly storageService: IStorageService,
		@IProductService private readonly productService: IProductService,
		@IStorageKeysSyncRegistryService private readonly storageKeysSyncRegistryService: IStorageKeysSyncRegistryService
	) {
		this.fileService.registerProvider(TRUSTED_DOMAINS_SCHEMA, this);

		this.storageKeysSyncRegistryService.registerStorageKey({ key: TRUSTED_DOMAINS_STORAGE_KEY, version: 1 });
		this.storageKeysSyncRegistryService.registerStorageKey({ key: TRUSTED_DOMAINS_CONTENT_STORAGE_KEY, version: 1 });
	}

	stat(resource: URI): Promise<IStat> {
		return Promise.resolve(TRUSTED_DOMAINS_STAT);
	}

	readFile(resource: URI): Promise<Uint8Array> {
		let trustedDomainsContent = this.storageService.get(
			TRUSTED_DOMAINS_CONTENT_STORAGE_KEY,
			StorageScope.GLOBAL
		);

		if (
			!trustedDomainsContent ||
			trustedDomainsContent.indexOf(CONFIG_HELP_TEXT_PRE) === -1 ||
			trustedDomainsContent.indexOf(CONFIG_HELP_TEXT_AFTER) === -1
		) {
			const { defaultTrustedDomains, trustedDomains } = readTrustedDomains(this.storageService, this.productService);

			trustedDomainsContent = computeTrustedDomainContent(defaultTrustedDomains, trustedDomains);
		}

		const buffer = VSBuffer.fromString(trustedDomainsContent).buffer;
		return Promise.resolve(buffer);
	}

	writeFile(resource: URI, content: Uint8Array, opts: FileWriteOptions): Promise<void> {
		try {
			const trustedDomainsContent = VSBuffer.wrap(content).toString();
			const trustedDomains = parse(trustedDomainsContent);

			this.storageService.store(TRUSTED_DOMAINS_CONTENT_STORAGE_KEY, trustedDomainsContent, StorageScope.GLOBAL);
			this.storageService.store(
				TRUSTED_DOMAINS_STORAGE_KEY,
				JSON.stringify(trustedDomains) || '',
				StorageScope.GLOBAL
			);
		} catch (err) { }

		return Promise.resolve();
	}

	watch(resource: URI, opts: IWatchOptions): IDisposable {
		return {
			dispose() {
				return;
			}
		};
	}
	mkdir(resource: URI): Promise<void> {
		return Promise.resolve(undefined!);
	}
	readdir(resource: URI): Promise<[string, FileType][]> {
		return Promise.resolve(undefined!);
	}
	delete(resource: URI, opts: FileDeleteOptions): Promise<void> {
		return Promise.resolve(undefined!);
	}
	rename(from: URI, to: URI, opts: FileOverwriteOptions): Promise<void> {
		return Promise.resolve(undefined!);
	}
}
