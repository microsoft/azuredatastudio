/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DoNotAskAgain, Install, nodeButNotAutorestFound, nodeNotFound } from '../common/constants';
import * as utils from '../common/utils';
import { DBProjectConfigurationKey } from './netcoreTool';
import { ShellExecutionHelper } from './shellExecutionHelper';

const autorestPackageVersion = '0.0.2'; // latest version of AutoRest.Sql package on npm
const autorestPackageName = 'autorest-sql-testing'; // name of AutoRest.Sql package on npm
const nodejsDoNotAskAgainKey: string = 'nodejsDoNotAsk';

export class AutorestHelper extends ShellExecutionHelper {

	constructor(_outputChannel: vscode.OutputChannel) {
		super(_outputChannel);
	}

	/**
	 * @returns the beginning of the command to execute autorest; 'autorest' if available, 'npx autorest' if module not installed, or undefined if neither
	 */
	public async detectInstallation(): Promise<string | undefined> {
		const autorestCommand = 'autorest';
		const npxCommand = 'npx';

		if (await utils.detectCommandInstallation(autorestCommand)) {
			return autorestCommand;
		}

		if (await utils.detectCommandInstallation(npxCommand)) {
			this._outputChannel.appendLine(nodeButNotAutorestFound);
			return `${npxCommand} ${autorestCommand}`;
		}

		return undefined;
	}

	public async generateAutorestFiles(specPath: string, outputFolder: string): Promise<string | undefined> {
		const commandExecutable = await this.detectInstallation();

		if (commandExecutable === undefined) {
			// unable to find autorest or npx

			if (vscode.workspace.getConfiguration(DBProjectConfigurationKey)[nodejsDoNotAskAgainKey] !== true) {
				this._outputChannel.appendLine(nodeNotFound);
				return; // user doesn't want to be prompted about installing it
			}

			// prompt user to install Node.js
			const result = await vscode.window.showErrorMessage(nodeNotFound, DoNotAskAgain, Install);

			if (result === Install) {
				//open install link
				const nodejsInstallationUrl = 'https://nodejs.dev/download';
				await vscode.env.openExternal(vscode.Uri.parse(nodejsInstallationUrl));
			} else if (result === DoNotAskAgain) {
				const config = vscode.workspace.getConfiguration(DBProjectConfigurationKey);
				await config.update(nodejsDoNotAskAgainKey, true, vscode.ConfigurationTarget.Global);
			}

			return;
		}

		const command = this.constructAutorestCommand(commandExecutable, specPath, outputFolder);
		const output = await this.runStreamedCommand(command, this._outputChannel);

		return output;
	}

	public constructAutorestCommand(executable: string, swaggerPath: string, outputFolder: string): string {
		// TODO: should --clear-output-folder be included? We should always be writing to a folder created just for this, but potentially risky
		return `${executable} --use:${autorestPackageName}@${autorestPackageVersion} --input-file="${swaggerPath}" --output-folder="${outputFolder}" --clear-output-folder`;
	}
}
