/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as glob from 'glob';

import * as utils from '../common/utils';
import * as constants from '../common/constants';

export interface PythonPathInfo {
	installDir: string;
	version: string;
}

export interface PythonCommand {
	command: string;
	args?: string[];
}

export class PythonPathLookup {
	private readonly _condaLocations: string[];
	private readonly _pythonCommands: PythonCommand[];
	constructor() {
		if (process.platform !== constants.winPlatform) {
			let userFolder = process.env['HOME'];
			this._condaLocations = [
				'/opt/*conda*/bin/python3',
				'/usr/share/*conda*/bin/python3',
				`${userFolder}/*conda*/bin/python3`
			];
		} else {
			let userFolder = process.env['USERPROFILE'].replace(/\\/g, '/').replace('C:', '');
			this._condaLocations = [
				'/ProgramData/[Mm]iniconda*/python.exe',
				'/ProgramData/[Aa]naconda*/python.exe',
				`${userFolder}/[Mm]iniconda*/python.exe`,
				`${userFolder}/[Aa]naconda*/python.exe`,
				`${userFolder}/AppData/Local/Continuum/[Mm]iniconda*/python.exe`,
				`${userFolder}/AppData/Local/Continuum/[Aa]naconda*/python.exe`
			];
		}

		this._pythonCommands = [
			{ command: 'python3.7' },
			{ command: 'python3.6' },
			{ command: 'python3' },
			{ command: 'python' }
		];

		if (process.platform === constants.winPlatform) {
			this._pythonCommands.concat([
				{ command: 'py', args: ['-3.7'] },
				{ command: 'py', args: ['-3.6'] },
				{ command: 'py', args: ['-3'] }
			]);
		}
	}

	public async getSuggestions(): Promise<PythonPathInfo[]> {
		let pythonSuggestions = await this.getPythonSuggestions(this._pythonCommands);
		let condaSuggestions = await this.getCondaSuggestions(this._condaLocations);

		let allSuggestions = pythonSuggestions.concat(condaSuggestions);
		return this.getInfoForPaths(allSuggestions);
	}

	public async getCondaSuggestions(condaLocations: string[]): Promise<string[]> {
		try {
			let condaResults = await Promise.all(condaLocations.map(location => this.globSearch(location)));
			let condaFiles = condaResults.reduce((first, second) => first.concat(second));
			return condaFiles.filter(condaPath => condaPath && condaPath.length > 0);
		} catch (err) {
			console.log(`Problem encountered getting Conda installs: ${err}`);
		}
		return [];
	}

	public globSearch(globPattern: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			glob(globPattern, (err, files) => {
				if (err) {
					return reject(err);
				}
				resolve(Array.isArray(files) ? files : []);
			});
		});
	}

	public async getPythonSuggestions(pythonCommands: PythonCommand[]): Promise<string[]> {
		try {
			let pythonPaths = await Promise.all(pythonCommands.map(item => this.getPythonPath(item)));
			return pythonPaths.filter(path => path && path.length > 0);
		} catch (err) {
			console.log(`Problem encountered getting Python installs: ${err}`);
		}
		return [];
	}

	public async getPythonPath(options: PythonCommand): Promise<string | undefined> {
		try {
			let args = Array.isArray(options.args) ? options.args : [];
			args = args.concat(['-c', '"import sys;print(sys.executable)"']);
			const cmd = `"${options.command}" ${args.join(' ')}`;
			let output = await utils.executeBufferedCommand(cmd, {});
			let value = output ? output.trim() : '';
			if (value.length > 0 && await utils.exists(value)) {
				return value;
			}
		} catch (err) {
			// Ignoring this error since it's probably from trying to run a non-existent python executable.
		}

		return undefined;
	}

	public async getInfoForPaths(pythonPaths: string[]): Promise<PythonPathInfo[]> {
		let pathsInfo = await Promise.all(pythonPaths.map(path => this.getInfoForPath(path)));

		// Remove duplicate paths, and entries with missing values
		let pathSet = new Set<string>();
		return pathsInfo.filter(path => {
			if (!path || !path.installDir || !path.version || path.installDir.length === 0 || path.version.length === 0) {
				return false;
			}

			let majorVersion = Number.parseInt(path.version.substring(0, path.version.indexOf('.')));
			if (Number.isNaN(majorVersion) || majorVersion < 3) {
				return false;
			}

			let key = `${path.installDir} ${path.version}`;
			if (pathSet.has(key)) {
				return false;
			} else {
				pathSet.add(key);
				return true;
			}
		});
	}

	public async getInfoForPath(pythonPath: string): Promise<PythonPathInfo | undefined> {
		try {
			// "python --version" returns nothing from executeBufferedCommand with Python 2.X,
			// so use sys.version_info here instead.
			let cmd = `"${pythonPath}" -c "import sys;print('.'.join(str(i) for i in sys.version_info[:3]))"`;
			let output = await utils.executeBufferedCommand(cmd, {});
			let pythonVersion = output ? output.trim() : '';

			cmd = `"${pythonPath}" -c "import sys;print(sys.exec_prefix)"`;
			output = await utils.executeBufferedCommand(cmd, {});
			let pythonPrefix = output ? output.trim() : '';

			if (pythonVersion.length > 0 && pythonPrefix.length > 0) {
				return {
					installDir: pythonPrefix,
					version: pythonVersion
				};
			}
		} catch (err) {
			console.log(`Problem encountered getting Python info for path: ${err}`);
		}
		return undefined;
	}
}
