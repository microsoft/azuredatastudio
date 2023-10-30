/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isESM } from 'vs/base/common/amd';
import { AppResourcePath, FileAccess, nodeModulesAsarPath, nodeModulesPath } from 'vs/base/common/network';
import * as platform from 'vs/base/common/platform';
import { IProductConfiguration } from 'vs/base/common/product';
import { URI } from 'vs/base/common/uri';


class DefineCall {
	constructor(
		public readonly id: string | null | undefined,
		public readonly dependencies: string[] | null | undefined,
		public readonly callback: any
	) { }
}

class AMDModuleImporter {
	public static INSTANCE = new AMDModuleImporter();

	private readonly _isWebWorker = (typeof self === 'object' && self.constructor && self.constructor.name === 'DedicatedWorkerGlobalScope');
	private readonly _isRenderer = typeof document === 'object';

	private readonly _defineCalls: DefineCall[] = [];
	private _initialized = false;
	private _amdPolicy: Pick<TrustedTypePolicy<{
		createScriptURL(value: string): string;
	}>, 'name' | 'createScriptURL'> | undefined;

	constructor() { }

	private _initialize(): void {
		if (this._initialized) {
			return;
		}
		this._initialized = true;

		(<any>globalThis).define = (id: any, dependencies: any, callback: any) => {
			if (typeof id !== 'string') {
				callback = dependencies;
				dependencies = id;
				id = null;
			}
			if (typeof dependencies !== 'object' || !Array.isArray(dependencies)) {
				callback = dependencies;
				dependencies = null;
			}
			// if (!dependencies) {
			// 	dependencies = ['require', 'exports', 'module'];
			// }
			this._defineCalls.push(new DefineCall(id, dependencies, callback));
		};

		(<any>globalThis).define.amd = true;

		if (this._isRenderer) {
			this._amdPolicy = window.trustedTypes?.createPolicy('amdLoader', {
				createScriptURL(value) {
					if (value.startsWith(window.location.origin)) {
						return value;
					}
					if (value.startsWith('vscode-file://vscode-app')) {
						return value;
					}
					throw new Error(`[trusted_script_src] Invalid script url: ${value}`);
				}
			});
		} else if (this._isWebWorker) {
			this._amdPolicy = (<any>globalThis).trustedTypes?.createPolicy('amdLoader', {
				createScriptURL(value: string) {
					return value;
				}
			});
		}
	}

	public async load<T>(scriptSrc: string): Promise<T> {
		this._initialize();
		const defineCall = await (this._isWebWorker ? this._workerLoadScript(scriptSrc) : this._isRenderer ? this._rendererLoadScript(scriptSrc) : this._nodeJSLoadScript(scriptSrc));
		if (!defineCall) {
			throw new Error(`Did not receive a define call from script ${scriptSrc}`);
		}
		// TODO require, exports, module
		if (Array.isArray(defineCall.dependencies) && defineCall.dependencies.length > 0) {
			throw new Error(`Cannot resolve dependencies for script ${scriptSrc}. The dependencies are: ${defineCall.dependencies.join(', ')}`);
		}
		if (typeof defineCall.callback === 'function') {
			return defineCall.callback([]);
		} else {
			return defineCall.callback;
		}
	}

	private _rendererLoadScript(scriptSrc: string): Promise<DefineCall | undefined> {
		return new Promise<DefineCall | undefined>((resolve, reject) => {
			const scriptElement = document.createElement('script');
			scriptElement.setAttribute('async', 'async');
			scriptElement.setAttribute('type', 'text/javascript');

			const unbind = () => {
				scriptElement.removeEventListener('load', loadEventListener);
				scriptElement.removeEventListener('error', errorEventListener);
			};

			const loadEventListener = (e: any) => {
				unbind();
				resolve(this._defineCalls.pop());
			};

			const errorEventListener = (e: any) => {
				unbind();
				reject(e);
			};

			scriptElement.addEventListener('load', loadEventListener);
			scriptElement.addEventListener('error', errorEventListener);
			if (this._amdPolicy) {
				scriptSrc = this._amdPolicy.createScriptURL(scriptSrc) as any as string;
			}
			scriptElement.setAttribute('src', scriptSrc);
			document.getElementsByTagName('head')[0].appendChild(scriptElement);
		});
	}

	private _workerLoadScript(scriptSrc: string): Promise<DefineCall | undefined> {
		return new Promise<DefineCall | undefined>((resolve, reject) => {
			try {
				if (this._amdPolicy) {
					scriptSrc = this._amdPolicy.createScriptURL(scriptSrc) as any as string;
				}
				importScripts(scriptSrc);
				resolve(this._defineCalls.pop());
			} catch (err) {
				reject(err);
			}
		});
	}

	private async _nodeJSLoadScript(scriptSrc: string): Promise<DefineCall | undefined> {
		try {
			const fs = <typeof import('fs')>globalThis._VSCODE_NODE_MODULES['fs'];
			const vm = <typeof import('vm')>globalThis._VSCODE_NODE_MODULES['vm'];
			const module = <typeof import('module')>globalThis._VSCODE_NODE_MODULES['module'];

			const filePath = URI.parse(scriptSrc).fsPath;
			const content = fs.readFileSync(filePath).toString();
			const scriptSource = module.wrap(content.replace(/^#!.*/, ''));
			const script = new vm.Script(scriptSource);
			const compileWrapper = script.runInThisContext();
			compileWrapper.apply();
			return this._defineCalls.pop();

		} catch (error) {
			throw error;
		}
	}
}

const cache = new Map<string, Promise<any>>();

let _paths: Record<string, string> = {};
if (typeof globalThis.require === 'object') {
	_paths = (<Record<string, any>>globalThis.require).paths ?? {};
}

/**
 * Utility for importing an AMD node module. This util supports AMD and ESM contexts and should be used while the ESM adoption
 * is on its way.
 *
 * e.g. pass in `vscode-textmate/release/main.js`
 */
export async function importAMDNodeModule<T>(nodeModuleName: string, pathInsideNodeModule: string, isBuilt?: boolean): Promise<T> {
	if (isESM) {

		if (isBuilt === undefined) {
			const product = globalThis._VSCODE_PRODUCT_JSON as unknown as IProductConfiguration;
			isBuilt = Boolean((product ?? (<any>globalThis).vscode?.context?.configuration()?.product)?.commit);
		}

		if (_paths[nodeModuleName]) {
			nodeModuleName = _paths[nodeModuleName];
		}

		const nodeModulePath = `${nodeModuleName}/${pathInsideNodeModule}`;
		if (cache.has(nodeModulePath)) {
			return cache.get(nodeModulePath)!;
		}
		let scriptSrc: string;
		if (/^\w[\w\d+.-]*:\/\//.test(nodeModulePath)) {
			// looks like a URL
			// bit of a special case for: src/vs/workbench/services/languageDetection/browser/languageDetectionSimpleWorker.ts
			scriptSrc = nodeModulePath;
		} else {
			const useASAR = (isBuilt && !platform.isWeb);
			const actualNodeModulesPath = (useASAR ? nodeModulesAsarPath : nodeModulesPath);
			const resourcePath: AppResourcePath = `${actualNodeModulesPath}/${nodeModulePath}`;
			scriptSrc = FileAccess.asBrowserUri(resourcePath).toString(true);
		}
		const result = AMDModuleImporter.INSTANCE.load<T>(scriptSrc);
		cache.set(nodeModulePath, result);
		return result;
	} else {
		return await import(nodeModuleName);
	}
}
