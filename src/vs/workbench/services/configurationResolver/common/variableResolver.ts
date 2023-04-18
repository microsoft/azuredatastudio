/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as paths from 'vs/base/common/path';
import * as process from 'vs/base/common/process';
import * as types from 'vs/base/common/types';
import * as objects from 'vs/base/common/objects';
import { IStringDictionary } from 'vs/base/common/collections';
import { IProcessEnvironment, isWindows, isMacintosh, isLinux } from 'vs/base/common/platform';
import { normalizeDriveLetter } from 'vs/base/common/labels';
import { localize } from 'vs/nls';
import { URI as uri } from 'vs/base/common/uri';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';
import { IWorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { ILabelService } from 'vs/platform/label/common/label';
import { replaceAsync } from 'vs/base/common/strings';

export interface IVariableResolveContext {
	getFolderUri(folderName: string): uri | undefined;
	getWorkspaceFolderCount(): number;
	getConfigurationValue(folderUri: uri | undefined, section: string): string | undefined;
	getAppRoot(): string | undefined;
	getExecPath(): string | undefined;
	getFilePath(): string | undefined;
	getWorkspaceFolderPathForFile?(): string | undefined;
	getSelectedText(): string | undefined;
	getLineNumber(): string | undefined;
	getExtension(id: string): Promise<{ readonly extensionLocation: uri } | undefined>;
}

type Environment = { env: IProcessEnvironment | undefined; userHome: string | undefined };

export class AbstractVariableResolverService implements IConfigurationResolverService {

	static readonly VARIABLE_LHS = '${';
	static readonly VARIABLE_REGEXP = /\$\{(.*?)\}/g;

	declare readonly _serviceBrand: undefined;

	private _context: IVariableResolveContext;
	private _labelService?: ILabelService;
	private _envVariablesPromise?: Promise<IProcessEnvironment>;
	private _userHomePromise?: Promise<string>;
	protected _contributedVariables: Map<string, () => Promise<string | undefined>> = new Map();

	constructor(_context: IVariableResolveContext, _labelService?: ILabelService, _userHomePromise?: Promise<string>, _envVariablesPromise?: Promise<IProcessEnvironment>) {
		this._context = _context;
		this._labelService = _labelService;
		this._userHomePromise = _userHomePromise;
		if (_envVariablesPromise) {
			this._envVariablesPromise = _envVariablesPromise.then(envVariables => {
				return this.prepareEnv(envVariables);
			});
		}
	}

	private prepareEnv(envVariables: IProcessEnvironment): IProcessEnvironment {
		// windows env variables are case insensitive
		if (isWindows) {
			const ev: IProcessEnvironment = Object.create(null);
			Object.keys(envVariables).forEach(key => {
				ev[key.toLowerCase()] = envVariables[key];
			});
			return ev;
		}
		return envVariables;
	}

	public resolveWithEnvironment(environment: IProcessEnvironment, root: IWorkspaceFolder | undefined, value: string): Promise<string> {
		return this.recursiveResolve({ env: this.prepareEnv(environment), userHome: undefined }, root ? root.uri : undefined, value);
	}

	public async resolveAsync(root: IWorkspaceFolder | undefined, value: string): Promise<string>;
	public async resolveAsync(root: IWorkspaceFolder | undefined, value: string[]): Promise<string[]>;
	public async resolveAsync(root: IWorkspaceFolder | undefined, value: IStringDictionary<string>): Promise<IStringDictionary<string>>;
	public async resolveAsync(root: IWorkspaceFolder | undefined, value: any): Promise<any> {
		const environment: Environment = {
			env: await this._envVariablesPromise,
			userHome: await this._userHomePromise
		};
		return this.recursiveResolve(environment, root ? root.uri : undefined, value);
	}

	private async resolveAnyBase(workspaceFolder: IWorkspaceFolder | undefined, config: any, commandValueMapping?: IStringDictionary<string>, resolvedVariables?: Map<string, string>): Promise<any> {

		const result = objects.deepClone(config) as any;

		// hoist platform specific attributes to top level
		if (isWindows && result.windows) {
			Object.keys(result.windows).forEach(key => result[key] = result.windows[key]);
		} else if (isMacintosh && result.osx) {
			Object.keys(result.osx).forEach(key => result[key] = result.osx[key]);
		} else if (isLinux && result.linux) {
			Object.keys(result.linux).forEach(key => result[key] = result.linux[key]);
		}

		// delete all platform specific sections
		delete result.windows;
		delete result.osx;
		delete result.linux;

		// substitute all variables recursively in string values
		const environmentPromises: Environment = {
			env: await this._envVariablesPromise,
			userHome: await this._userHomePromise
		};
		return this.recursiveResolve(environmentPromises, workspaceFolder ? workspaceFolder.uri : undefined, result, commandValueMapping, resolvedVariables);
	}

	public async resolveAnyAsync(workspaceFolder: IWorkspaceFolder | undefined, config: any, commandValueMapping?: IStringDictionary<string>): Promise<any> {
		return this.resolveAnyBase(workspaceFolder, config, commandValueMapping);
	}

	public async resolveAnyMap(workspaceFolder: IWorkspaceFolder | undefined, config: any, commandValueMapping?: IStringDictionary<string>): Promise<{ newConfig: any; resolvedVariables: Map<string, string> }> {
		const resolvedVariables = new Map<string, string>();
		const newConfig = await this.resolveAnyBase(workspaceFolder, config, commandValueMapping, resolvedVariables);
		return { newConfig, resolvedVariables };
	}

	public resolveWithInteractionReplace(folder: IWorkspaceFolder | undefined, config: any, section?: string, variables?: IStringDictionary<string>): Promise<any> {
		throw new Error('resolveWithInteractionReplace not implemented.');
	}

	public resolveWithInteraction(folder: IWorkspaceFolder | undefined, config: any, section?: string, variables?: IStringDictionary<string>): Promise<Map<string, string> | undefined> {
		throw new Error('resolveWithInteraction not implemented.');
	}

	public contributeVariable(variable: string, resolution: () => Promise<string | undefined>): void {
		if (this._contributedVariables.has(variable)) {
			throw new Error('Variable ' + variable + ' is contributed twice.');
		} else {
			this._contributedVariables.set(variable, resolution);
		}
	}

	private async recursiveResolve(environment: Environment, folderUri: uri | undefined, value: any, commandValueMapping?: IStringDictionary<string>, resolvedVariables?: Map<string, string>): Promise<any> {
		if (types.isString(value)) {
			return this.resolveString(environment, folderUri, value, commandValueMapping, resolvedVariables);
		} else if (types.isArray(value)) {
			return Promise.all(value.map(s => this.recursiveResolve(environment, folderUri, s, commandValueMapping, resolvedVariables)));
		} else if (types.isObject(value)) {
			const result: IStringDictionary<string | IStringDictionary<string> | string[]> = Object.create(null);
			const replaced = await Promise.all(Object.keys(value).map(async key => {
				const replaced = await this.resolveString(environment, folderUri, key, commandValueMapping, resolvedVariables);
				return [replaced, await this.recursiveResolve(environment, folderUri, value[key], commandValueMapping, resolvedVariables)] as const;
			}));
			// two step process to preserve object key order
			for (const [key, value] of replaced) {
				result[key] = value;
			}
			return result;
		}
		return value;
	}

	private resolveString(environment: Environment, folderUri: uri | undefined, value: string, commandValueMapping: IStringDictionary<string> | undefined, resolvedVariables?: Map<string, string>): Promise<string> {
		// loop through all variables occurrences in 'value'
		return replaceAsync(value, AbstractVariableResolverService.VARIABLE_REGEXP, async (match: string, variable: string) => {
			// disallow attempted nesting, see #77289. This doesn't exclude variables that resolve to other variables.
			if (variable.includes(AbstractVariableResolverService.VARIABLE_LHS)) {
				return match;
			}

			let resolvedValue = await this.evaluateSingleVariable(environment, match, variable, folderUri, commandValueMapping);

			resolvedVariables?.set(variable, resolvedValue);

			if ((resolvedValue !== match) && types.isString(resolvedValue) && resolvedValue.match(AbstractVariableResolverService.VARIABLE_REGEXP)) {
				resolvedValue = await this.resolveString(environment, folderUri, resolvedValue, commandValueMapping, resolvedVariables);
			}

			return resolvedValue;
		});
	}

	private fsPath(displayUri: uri): string {
		return this._labelService ? this._labelService.getUriLabel(displayUri, { noPrefix: true }) : displayUri.fsPath;
	}

	private async evaluateSingleVariable(environment: Environment, match: string, variable: string, folderUri: uri | undefined, commandValueMapping: IStringDictionary<string> | undefined): Promise<string> {

		// try to separate variable arguments from variable name
		let argument: string | undefined;
		const parts = variable.split(':');
		if (parts.length > 1) {
			variable = parts[0];
			argument = parts[1];
		}

		// common error handling for all variables that require an open editor
		const getFilePath = (): string => {

			const filePath = this._context.getFilePath();
			if (filePath) {
				return filePath;
			}
			throw new Error(localize('canNotResolveFile', "Variable {0} can not be resolved. Please open an editor.", match));
		};

		// common error handling for all variables that require an open editor
		const getFolderPathForFile = (): string => {

			const filePath = getFilePath();		// throws error if no editor open
			if (this._context.getWorkspaceFolderPathForFile) {
				const folderPath = this._context.getWorkspaceFolderPathForFile();
				if (folderPath) {
					return folderPath;
				}
			}
			throw new Error(localize('canNotResolveFolderForFile', "Variable {0}: can not find workspace folder of '{1}'.", match, paths.basename(filePath)));
		};

		// common error handling for all variables that require an open folder and accept a folder name argument
		const getFolderUri = (): uri => {

			if (argument) {
				const folder = this._context.getFolderUri(argument);
				if (folder) {
					return folder;
				}
				throw new Error(localize('canNotFindFolder', "Variable {0} can not be resolved. No such folder '{1}'.", match, argument));
			}

			if (folderUri) {
				return folderUri;
			}

			if (this._context.getWorkspaceFolderCount() > 1) {
				throw new Error(localize('canNotResolveWorkspaceFolderMultiRoot', "Variable {0} can not be resolved in a multi folder workspace. Scope this variable using ':' and a workspace folder name.", match));
			}
			throw new Error(localize('canNotResolveWorkspaceFolder', "Variable {0} can not be resolved. Please open a folder.", match));
		};


		switch (variable) {

			case 'env':
				if (argument) {
					if (environment.env) {
						// Depending on the source of the environment, on Windows, the values may all be lowercase.
						const env = environment.env[isWindows ? argument.toLowerCase() : argument];
						if (types.isString(env)) {
							return env;
						}
					}
					// For `env` we should do the same as a normal shell does - evaluates undefined envs to an empty string #46436
					return '';
				}
				throw new Error(localize('missingEnvVarName', "Variable {0} can not be resolved because no environment variable name is given.", match));

			case 'config':
				if (argument) {
					const config = this._context.getConfigurationValue(folderUri, argument);
					if (types.isUndefinedOrNull(config)) {
						throw new Error(localize('configNotFound', "Variable {0} can not be resolved because setting '{1}' not found.", match, argument));
					}
					if (types.isObject(config)) {
						throw new Error(localize('configNoString', "Variable {0} can not be resolved because '{1}' is a structured value.", match, argument));
					}
					return config;
				}
				throw new Error(localize('missingConfigName', "Variable {0} can not be resolved because no settings name is given.", match));

			case 'command':
				return this.resolveFromMap(match, argument, commandValueMapping, 'command');

			case 'input':
				return this.resolveFromMap(match, argument, commandValueMapping, 'input');

			case 'extensionInstallFolder':
				if (argument) {
					const ext = await this._context.getExtension(argument);
					if (!ext) {
						throw new Error(localize('extensionNotInstalled', "Variable {0} can not be resolved because the extension {1} is not installed.", match, argument));
					}
					return this.fsPath(ext.extensionLocation);
				}
				throw new Error(localize('missingExtensionName', "Variable {0} can not be resolved because no extension name is given.", match));

			default: {

				switch (variable) {
					case 'workspaceRoot':
					case 'workspaceFolder':
						return normalizeDriveLetter(this.fsPath(getFolderUri()));

					case 'cwd':
						return ((folderUri || argument) ? normalizeDriveLetter(this.fsPath(getFolderUri())) : process.cwd());

					case 'workspaceRootFolderName':
					case 'workspaceFolderBasename':
						return paths.basename(this.fsPath(getFolderUri()));

					case 'userHome': {
						if (environment.userHome) {
							return environment.userHome;
						}
						throw new Error(localize('canNotResolveUserHome', "Variable {0} can not be resolved. UserHome path is not defined", match));
					}

					case 'lineNumber': {
						const lineNumber = this._context.getLineNumber();
						if (lineNumber) {
							return lineNumber;
						}
						throw new Error(localize('canNotResolveLineNumber', "Variable {0} can not be resolved. Make sure to have a line selected in the active editor.", match));
					}
					case 'selectedText': {
						const selectedText = this._context.getSelectedText();
						if (selectedText) {
							return selectedText;
						}
						throw new Error(localize('canNotResolveSelectedText', "Variable {0} can not be resolved. Make sure to have some text selected in the active editor.", match));
					}
					case 'file':
						return getFilePath();

					case 'fileWorkspaceFolder':
						return getFolderPathForFile();

					case 'relativeFile':
						if (folderUri || argument) {
							return paths.relative(this.fsPath(getFolderUri()), getFilePath());
						}
						return getFilePath();

					case 'relativeFileDirname': {
						const dirname = paths.dirname(getFilePath());
						if (folderUri || argument) {
							const relative = paths.relative(this.fsPath(getFolderUri()), dirname);
							return relative.length === 0 ? '.' : relative;
						}
						return dirname;
					}
					case 'fileDirname':
						return paths.dirname(getFilePath());

					case 'fileExtname':
						return paths.extname(getFilePath());

					case 'fileBasename':
						return paths.basename(getFilePath());

					case 'fileBasenameNoExtension': {
						const basename = paths.basename(getFilePath());
						return (basename.slice(0, basename.length - paths.extname(basename).length));
					}
					case 'fileDirnameBasename':
						return paths.basename(paths.dirname(getFilePath()));

					case 'execPath': {
						const ep = this._context.getExecPath();
						if (ep) {
							return ep;
						}
						return match;
					}
					case 'execInstallFolder': {
						const ar = this._context.getAppRoot();
						if (ar) {
							return ar;
						}
						return match;
					}
					case 'pathSeparator':
						return paths.sep;

					default:
						try {
							const key = argument ? `${variable}:${argument}` : variable;
							return this.resolveFromMap(match, key, commandValueMapping, undefined);
						} catch (error) {
							return match;
						}
				}
			}
		}
	}

	private resolveFromMap(match: string, argument: string | undefined, commandValueMapping: IStringDictionary<string> | undefined, prefix: string | undefined): string {
		if (argument && commandValueMapping) {
			const v = (prefix === undefined) ? commandValueMapping[argument] : commandValueMapping[prefix + ':' + argument];
			if (typeof v === 'string') {
				return v;
			}
			throw new Error(localize('noValueForCommand', "Variable {0} can not be resolved because the command has no value.", match));
		}
		return match;
	}
}
