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

export class PythonPathLookup {
	private condaLocations: string[];
	constructor() {
		if (process.platform !== constants.winPlatform) {
			let userFolder = process.env['HOME'];
			this.condaLocations = [
				'/opt/*conda*/bin/python3',
				'/usr/share/*conda*/bin/python3',
				`${userFolder}/*conda*/bin/python3`
			];
		} else {
			let userFolder = process.env['USERPROFILE'].replace('\\', '/').replace('C:', '');
			this.condaLocations = [
				'/ProgramData/[Mm]iniconda*/python.exe',
				'/ProgramData/[Aa]naconda*/python.exe',
				`${userFolder}/[Mm]iniconda*/python.exe`,
				`${userFolder}/[Aa]naconda*/python.exe`,
				`${userFolder}/AppData/Local/Continuum/[Mm]iniconda*/python.exe`,
				`${userFolder}/AppData/Local/Continuum/[Aa]naconda*/python.exe`
			];
		}
	}

	public async getSuggestions(): Promise<PythonPathInfo[]> {
		let pythonSuggestions = await this.getPythonSuggestions();
		let condaSuggestions = await this.getCondaSuggestions();

		if (pythonSuggestions) {
			if (condaSuggestions && condaSuggestions.length > 0) {
				pythonSuggestions = pythonSuggestions.concat(condaSuggestions);
			}
			return this.getInfoForPaths(pythonSuggestions);
		} else {
			return [];
		}
	}

	private async getCondaSuggestions(): Promise<string[]> {
		try {
			let condaResults = await Promise.all(this.condaLocations.map(location => this.globSearch(location)));
			let condaFiles = condaResults.reduce((first, second) => first.concat(second));
			return condaFiles.filter(condaPath => condaPath && condaPath.length > 0);
		} catch (err) {
		}
		return [];
	}

	private globSearch(globPattern: string): Promise<string[]> {
		return new Promise<string[]>((resolve, reject) => {
			glob(globPattern, (err, files) => {
				if (err) {
					return reject(err);
				}
				resolve(Array.isArray(files) ? files : []);
			});
		});
	}

	private async getPythonSuggestions(): Promise<string[]> {
		let pathsToCheck = this.getPythonCommands();

		let pythonPaths = await Promise.all(pathsToCheck.map(item => this.getPythonPath(item)));
		let results: string[];
		if (pythonPaths) {
			results = pythonPaths.filter(path => path && path.length > 0);
		} else {
			results = [];
		}
		return results;
	}

	private async getPythonPath(options: { command: string; args?: string[] }): Promise<string> {
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
			// Ignore errors here, since this python version will just be excluded.
		}

		return undefined;
	}

	private getPythonCommands(): { command: string; args?: string[] }[] {
		const paths = ['python3.7', 'python3.6', 'python3', 'python']
			.map(item => { return { command: item }; });
		if (process.platform !== constants.winPlatform) {
			return paths;
		}

		const versions = ['3.7', '3.6', '3'];
		return paths.concat(versions.map(version => {
			return { command: 'py', args: [`-${version}`] };
		}));
	}

	private async getInfoForPaths(pythonPaths: string[]): Promise<PythonPathInfo[]> {
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

	private async getInfoForPath(pythonPath: string): Promise<PythonPathInfo> {
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
			// Ignore errors here, since this python version will just be excluded.
		}
		return undefined;
	}
}
