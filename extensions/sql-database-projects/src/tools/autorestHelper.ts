/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as child_process from 'child_process';

export class AutorestHelper {
	private autorestVersionOutput: string | undefined;
	private autorestGenerationOutput: string | undefined;

	public async detectAutorestInstallation(): Promise<boolean> {
		const child = child_process.spawn('autorest --version', [], { shell: true });

		child.stdout.on('data', (data) => {
			this.autorestVersionOutput = String(data);
		});

		const isDetected: boolean = await this.onDetectExit(child);

		return isDetected;
	}

	private async onDetectExit(childProcess: child_process.ChildProcess): Promise<boolean> {
		return new Promise((resolve, reject) => {
			childProcess.on('exit', () => {
				resolve(this.autorestVersionOutput?.startsWith('AutoRest code generation utility') ?? false);
			});

			childProcess.on('error', () => {
				reject(false);
			});
		});
	}

	public async generateAutorestFiles(swaggerPath: string, outputFolder: string): Promise<boolean> {

		if (!(await this.detectAutorestInstallation())) {
			throw new Error('Autorest tool not found.  Please ensure it\'s accessible from your system path.');
		}

		const command = `autorest --use:autorest-sql-testing --input-file="${swaggerPath}" --output-folder="${outputFolder}" --clear-output-folder`;

		const child = child_process.spawn(command, [], { shell: true });

		child.stdout.on('data', (data) => {
			this.autorestGenerationOutput = String(data);
		});

		const generated: boolean = await this.onGenerateExit(child);

		return generated;
	}


	private async onGenerateExit(childProcess: child_process.ChildProcess): Promise<boolean> {
		return new Promise((resolve, reject) => {
			childProcess.on('exit', () => {
				console.log(this.autorestGenerationOutput);
				resolve(true);
			});

			childProcess.on('error', () => {
				reject(false);
			});
		});
	}
}
