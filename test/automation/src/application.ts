/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { Workbench } from './workbench';
import { Code, spawn, SpawnOptions } from './code';
import { Logger, measureAndLog } from './logger';

export const enum Quality {
	Dev,
	Insiders,
	Stable
}

export interface ApplicationOptions extends SpawnOptions {
	quality: Quality;
	workspacePath: string;
	waitTime: number;
	screenshotsPath: string | null;
}

export class Application {

	constructor(private options: ApplicationOptions) {
		this._userDataPath = options.userDataDir;
		this._workspacePathOrFolder = options.workspacePath;
	}

	private _code: Code | undefined;
	get code(): Code { return this._code!; }

	private _workbench: Workbench | undefined;
	get workbench(): Workbench { return this._workbench!; }

	get quality(): Quality {
		return this.options.quality;
	}

	get logger(): Logger {
		return this.options.logger;
	}

	get remote(): boolean {
		return !!this.options.remote;
	}

	get web(): boolean {
		return !!this.options.web;
	}

	private _workspacePathOrFolder: string;
	get workspacePathOrFolder(): string {
		return this._workspacePathOrFolder;
	}

	get extensionsPath(): string {
		return this.options.extensionsPath;
	}

	private _userDataPath: string;
	get userDataPath(): string {
		return this._userDataPath;
	}

	async start(): Promise<any> {
		await this._start();
		await this.code.waitForElement('.object-explorer-view'); // {{SQL CARBON EDIT}} We have a different startup view
	}

	async restart(options?: { workspaceOrFolder?: string, extraArgs?: string[] }): Promise<any> {
		await this.stop();
		await this._start(options?.workspaceOrFolder, options?.extraArgs);
	}

	private async _start(workspaceOrFolder = this.workspacePathOrFolder, extraArgs: string[] = []): Promise<any> {
		this._workspacePathOrFolder = workspaceOrFolder;

		const code = await this.startApplication(extraArgs);
		await this.checkWindowReady(code);
	}

	async stop(): Promise<any> {
		if (this._code) {
			try {
				await this._code.exit();
			} finally {
				this._code = undefined;
			}
		}
	}

	async captureScreenshot(name: string): Promise<void> {
		if (this.options.screenshotsPath) {
			const raw = await measureAndLog(this.code.capturePage(), 'capturePage', this.options.logger);
			const buffer = Buffer.from(raw, 'base64');
			const screenshotPath = path.join(this.options.screenshotsPath, `${name}.png`);
			this.logger.log('Screenshot recorded:', screenshotPath);

			fs.writeFileSync(screenshotPath, buffer);
		}
	}

	async startTracing(name: string): Promise<void> {
		await this._code?.startTracing(name);
	}

	async stopTracing(name: string, persist: boolean): Promise<void> {
		await this._code?.stopTracing(name, persist);
	}

	private async startApplication(extraArgs: string[] = []): Promise<Code> {
		const code = this._code = await spawn({
			...this.options,
			extraArgs: [...(this.options.extraArgs || []), ...extraArgs],
		});

		this._workbench = new Workbench(this._code, this.userDataPath);

		return code;
	}

	private async checkWindowReady(code: Code): Promise<any> {
		await code.waitForWindowIds(ids => ids.length > 0);
		await code.waitForElement('.monaco-workbench');

		// {{SQL CARBON EDIT}} Wait for specified status bar items before considering the app ready - we wait for them together to avoid timing
		// issues with the status bar items disappearing
		const statusbarPromises: Promise<string>[] = [];

		if (this.remote) {
			await this.code.waitForTextContent('.monaco-workbench .statusbar-item[id="status.host"]', ' TestResolver', undefined, 2000);
		}
		// Wait for SQL Tools Service to start before considering the app ready
		statusbarPromises.push(this.code.waitForTextContent('.monaco-workbench .statusbar-item[id="Microsoft.mssql"]', 'SQL Tools Service Started', undefined, 30000));
		await Promise.all(statusbarPromises);

	}
}
