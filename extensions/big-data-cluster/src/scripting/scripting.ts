/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { fs } from '../utility/fs';
import { Shell } from '../utility/shell';
import * as vscode from 'vscode';
import * as path from 'path';
import mkdirp = require('mkdirp');
import { Kubectl } from '../kubectl/kubectl';


 export interface Scriptable {
		getScriptProperties(): ScriptingDictionary<String>;
		getScriptTargetClusterName() : String;
 }

 export interface ScriptingDictionary<V> {
	[name: string]: V;
}

const deployFilePrefix : string = 'mssql-bdc-deploy';
export class ScriptGenerator {

	private _shell: Shell;
	private _kubectl: Kubectl;

	constructor(_kubectl: Kubectl) {
		this._kubectl = _kubectl;
		this._shell = this._kubectl.getContext().shell;
	}

	public async generateDeploymentScript(scriptable: Scriptable) : Promise<void> {
		let envVars = "";
		let propertiesDict = scriptable.getScriptProperties();
		for (let key in propertiesDict) {
			let value = propertiesDict[key];
			envVars += this._shell.isWindows() ? `Set ${key}=${value}\n` : `export ${key}=${value}\n`;
		}
		let clusterName = scriptable.getScriptTargetClusterName();
		let timestamp = new Date().getTime();
		let deployFolder = this.getDeploymentFolder(this._shell);
		let deployFileSuffix = this._shell.isWindows() ? `.bat` : `.sh`;
		let deployFileName = `${deployFilePrefix}-${clusterName}-${timestamp}${deployFileSuffix}`;

		mkdirp.sync(deployFolder);
		await fs.writeFile(path.join(deployFolder, deployFileName), envVars, handleError);
	}

	public getDeploymentFolder(shell: Shell): string {
		return path.join(shell.home(), `.mssql-bdc/deployment`);
	}
}

const handleError = (err: NodeJS.ErrnoException) => {
    if (err) {
        vscode.window.showErrorMessage(err.message);
    }
};