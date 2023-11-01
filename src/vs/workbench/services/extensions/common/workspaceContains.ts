/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as resources from 'vs/base/common/resources';
import { URI, UriComponents } from 'vs/base/common/uri';
import { CancellationTokenSource, CancellationToken } from 'vs/base/common/cancellation';
import * as errors from 'vs/base/common/errors';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { QueryBuilder } from 'vs/workbench/services/search/common/queryBuilder';
import { ISearchService } from 'vs/workbench/services/search/common/search';
import { toWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { ILogService } from 'vs/platform/log/common/log';

const WORKSPACE_CONTAINS_TIMEOUT = 7000;

export interface IExtensionActivationHost {
	readonly logService: ILogService;
	readonly folders: readonly UriComponents[];
	readonly forceUsingSearch: boolean;

	exists(uri: URI): Promise<boolean>;
	checkExists(folders: readonly UriComponents[], includes: string[], token: CancellationToken): Promise<boolean>;
}

export interface IExtensionActivationResult {
	activationEvent: string;
}

export function checkActivateWorkspaceContainsExtension(host: IExtensionActivationHost, desc: IExtensionDescription): Promise<IExtensionActivationResult | undefined> {
	const activationEvents = desc.activationEvents;
	if (!activationEvents) {
		return Promise.resolve(undefined);
	}

	const fileNames: string[] = [];
	const globPatterns: string[] = [];

	for (const activationEvent of activationEvents) {
		if (/^workspaceContains:/.test(activationEvent)) {
			const fileNameOrGlob = activationEvent.substr('workspaceContains:'.length);
			if (fileNameOrGlob.indexOf('*') >= 0 || fileNameOrGlob.indexOf('?') >= 0 || host.forceUsingSearch) {
				globPatterns.push(fileNameOrGlob);
			} else {
				fileNames.push(fileNameOrGlob);
			}
		}
	}

	if (fileNames.length === 0 && globPatterns.length === 0) {
		return Promise.resolve(undefined);
	}

	let resolveResult: (value: IExtensionActivationResult | undefined) => void;
	const result = new Promise<IExtensionActivationResult | undefined>((resolve, reject) => { resolveResult = resolve; });
	const activate = (activationEvent: string) => resolveResult({ activationEvent });

	const fileNamePromise = Promise.all(fileNames.map((fileName) => _activateIfFileName(host, fileName, activate))).then(() => { });
	const globPatternPromise = _activateIfGlobPatterns(host, desc.identifier, globPatterns, activate);

	Promise.all([fileNamePromise, globPatternPromise]).then(() => {
		// when all are done, resolve with undefined (relevant only if it was not activated so far)
		resolveResult(undefined);
	});

	return result;
}

async function _activateIfFileName(host: IExtensionActivationHost, fileName: string, activate: (activationEvent: string) => void): Promise<void> {
	// find exact path
	for (const uri of host.folders) {
		if (await host.exists(resources.joinPath(URI.revive(uri), fileName))) {
			// the file was found
			activate(`workspaceContains:${fileName}`);
			return;
		}
	}
}

async function _activateIfGlobPatterns(host: IExtensionActivationHost, extensionId: ExtensionIdentifier, globPatterns: string[], activate: (activationEvent: string) => void): Promise<void> {
	if (globPatterns.length === 0) {
		return Promise.resolve(undefined);
	}

	const tokenSource = new CancellationTokenSource();
	const searchP = host.checkExists(host.folders, globPatterns, tokenSource.token);

	const timer = setTimeout(async () => {
		tokenSource.cancel();
		host.logService.info(`Not activating extension '${extensionId.value}': Timed out while searching for 'workspaceContains' pattern ${globPatterns.join(',')}`);
	}, WORKSPACE_CONTAINS_TIMEOUT);

	let exists: boolean = false;
	try {
		exists = await searchP;
	} catch (err) {
		if (!errors.isCancellationError(err)) {
			errors.onUnexpectedError(err);
		}
	}

	tokenSource.dispose();
	clearTimeout(timer);

	if (exists) {
		// a file was found matching one of the glob patterns
		activate(`workspaceContains:${globPatterns.join(',')}`);
	}
}

export function checkGlobFileExists(
	accessor: ServicesAccessor,
	folders: readonly UriComponents[],
	includes: string[],
	token: CancellationToken,
): Promise<boolean> {
	const instantiationService = accessor.get(IInstantiationService);
	const searchService = accessor.get(ISearchService);
	const queryBuilder = instantiationService.createInstance(QueryBuilder);
	const query = queryBuilder.file(folders.map(folder => toWorkspaceFolder(URI.revive(folder))), {
		_reason: 'checkExists',
		includePattern: includes,
		exists: true
	});

	return searchService.fileSearch(query, token).then(
		result => {
			return !!result.limitHit;
		},
		err => {
			if (!errors.isCancellationError(err)) {
				return Promise.reject(err);
			}

			return false;
		});
}
