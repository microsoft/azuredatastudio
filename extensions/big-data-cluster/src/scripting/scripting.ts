/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { fs } from '../utility/fs';
import { Shell } from '../utility/shell';
import * as vscode from 'vscode';
import * as path from 'path';
import mkdirp = require('mkdirp');
import { Kubectl, baseKubectlPath } from '../kubectl/kubectl';
import { KubectlContext } from '../kubectl/kubectlUtils';


 export interface Scriptable {
		getScriptProperties(): ScriptingDictionary<string>;
		getTargetKubectlContext() : KubectlContext;
 }

 export interface ScriptingDictionary<V> {
	[name: string]: V;
}

const deployFilePrefix : string = 'mssql-bdc-deploy';
export class ScriptGenerator {

	private _shell: Shell;
	private _kubectl: Kubectl;

	private _kubectlPath: string;
	constructor(_kubectl: Kubectl) {
		this._kubectl = _kubectl;
		this._shell = this._kubectl.getContext().shell;
		this._kubectlPath = baseKubectlPath(this._kubectl.getContext());
	}

	public async generateDeploymentScript(scriptable: Scriptable) : Promise<void> {
		let targetClusterName = scriptable.getTargetKubectlContext().clusterName;
		let targetContextName = scriptable.getTargetKubectlContext().contextName;

		let timestamp = new Date().getTime();
		let deployFolder = this.getDeploymentFolder(this._shell);
		let deployFileSuffix = this._shell.isWindows() ? `.bat` : `.sh`;
		let deployFileName = `${deployFilePrefix}-${targetClusterName}-${timestamp}${deployFileSuffix}`;
		let deployFilePath = path.join(deployFolder, deployFileName);

		let envVars = "";
		let propertiesDict = scriptable.getScriptProperties();
		for (let key in propertiesDict) {
			let value = propertiesDict[key];
			envVars += this._shell.isWindows() ? `Set ${key} = ${value}\n` : `export ${key} = ${value}\n`;
		}
		envVars += '\n';

		let kubeContextcommand = `${this._kubectlPath} config use-context ${targetContextName}\n`;
		let deployCommand = `mssqlctl create cluster ${targetClusterName}\n`;

		let deployContent = envVars + kubeContextcommand + deployCommand;
		await fs.writeFile(deployFilePath, deployContent, handleError);
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