/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as which from 'which';
import * as utils from '../common/utils';
import { ShellExecutionHelper } from './shellExecutionHelper';

const autorestPackageVersion = '0.0.2'; // latest version of AutoRest.Sql package on npm

export class AutorestHelper extends ShellExecutionHelper {

	constructor(_outputChannel: vscode.OutputChannel) {
		super(_outputChannel);
	}

	public async detectAutorestInstallation(): Promise<boolean> {
		try {
			const found = await which('autorest');
			if (found) {
				return true;
			}
		} catch (err) {
			console.log(utils.getErrorMessage(err));
		}

		return false;
	}

	public async generateAutorestFiles(swaggerPath: string, outputFolder: string): Promise<string> {
		if (!(await this.detectAutorestInstallation())) {
			throw new Error('Autorest tool not found.  Please ensure it\'s accessible from your system path.');
		}

		// should --clear-output-folder be included? We should always be writing to a folder created just for this, but potentially risky
		const command = `autorest --use:autorest-sql-testing@${autorestPackageVersion} --input-file="${swaggerPath}" --output-folder="${outputFolder}" --clear-output-folder`;

		const output = await this.runStreamedCommand(command, this._outputChannel);

		return output;
	}
}
