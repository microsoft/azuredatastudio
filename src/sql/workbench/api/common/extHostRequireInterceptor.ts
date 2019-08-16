/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { TernarySearchTree } from 'vs/base/common/map';
import { URI } from 'vs/base/common/uri';
import { nullExtensionDescription } from 'vs/workbench/services/extensions/common/extensions';
import { ExtensionIdentifier, IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import * as azdata from 'azdata';
import * as sqlops from 'sqlops';
import { IAzdataExtensionApiFactory, ISqlopsExtensionApiFactory } from 'sql/workbench/api/common/sqlExtHost.api.impl';
import { INodeModuleFactory } from 'vs/workbench/api/common/extHostRequireInterceptor';

export class AzdataNodeModuleFactory implements INodeModuleFactory {
	public readonly nodeModuleName = 'azdata';

	private readonly _extApiImpl = new Map<string, typeof azdata>();
	private _defaultApiImpl: typeof azdata;

	constructor(
		private readonly _apiFactory: IAzdataExtensionApiFactory,
		private readonly _extensionPaths: TernarySearchTree<IExtensionDescription>
	) {
	}

	public load(request: string, parent: URI): any {

		// get extension id from filename and api for extension
		const ext = this._extensionPaths.findSubstr(parent.fsPath);
		if (ext) {
			let apiImpl = this._extApiImpl.get(ExtensionIdentifier.toKey(ext.identifier));
			if (!apiImpl) {
				apiImpl = this._apiFactory(ext);
				this._extApiImpl.set(ExtensionIdentifier.toKey(ext.identifier), apiImpl);
			}
			return apiImpl;
		}

		// fall back to a default implementation
		if (!this._defaultApiImpl) {
			let extensionPathsPretty = '';
			this._extensionPaths.forEach((value, index) => extensionPathsPretty += `\t${index} -> ${value.identifier.value}\n`);
			console.warn(`Could not identify extension for 'azdata' require call from ${parent.fsPath}. These are the extension path mappings: \n${extensionPathsPretty}`);
			this._defaultApiImpl = this._apiFactory(nullExtensionDescription);
		}
		return this._defaultApiImpl;
	}
}

export class SqlopsNodeModuleFactory implements INodeModuleFactory {
	public readonly nodeModuleName = 'sqlops';

	private readonly _extApiImpl = new Map<string, typeof sqlops>();
	private _defaultApiImpl: typeof sqlops;

	constructor(
		private readonly _apiFactory: ISqlopsExtensionApiFactory,
		private readonly _extensionPaths: TernarySearchTree<IExtensionDescription>
	) {
	}

	public load(request: string, parent: URI): any {

		// get extension id from filename and api for extension
		const ext = this._extensionPaths.findSubstr(parent.fsPath);
		if (ext) {
			let apiImpl = this._extApiImpl.get(ExtensionIdentifier.toKey(ext.identifier));
			if (!apiImpl) {
				apiImpl = this._apiFactory(ext);
				this._extApiImpl.set(ExtensionIdentifier.toKey(ext.identifier), apiImpl);
			}
			return apiImpl;
		}

		// fall back to a default implementation
		if (!this._defaultApiImpl) {
			let extensionPathsPretty = '';
			this._extensionPaths.forEach((value, index) => extensionPathsPretty += `\t${index} -> ${value.identifier.value}\n`);
			console.warn(`Could not identify extension for 'sqlops' require call from ${parent.fsPath}. These are the extension path mappings: \n${extensionPathsPretty}`);
			this._defaultApiImpl = this._apiFactory(nullExtensionDescription);
		}
		return this._defaultApiImpl;
	}
}
