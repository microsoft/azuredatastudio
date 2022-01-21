/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as cp from 'child_process';
import * as os from 'os';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import { tmpName } from 'tmp';
import { IDriver, connect as connectElectronDriver, IDisposable, IElement, Thenable, ILocalizedStrings, ILocaleInfo } from './driver';
import { connect as connectPlaywrightDriver, launch } from './playwrightDriver';
import { Logger } from './logger';
import { ncp } from 'ncp';
import { URI } from 'vscode-uri';

const repoPath = path.join(__dirname, '../../..');

function getDevElectronPath(): string {
	const buildPath = path.join(repoPath, '.build');
	const product = require(path.join(repoPath, 'product.json'));

	switch (process.platform) {
		case 'darwin':
			return path.join(buildPath, 'electron', `${product.nameLong}.app`, 'Contents', 'MacOS', 'Electron');
		case 'linux':
			return path.join(buildPath, 'electron', `${product.applicationName}`);
		case 'win32':
			return path.join(buildPath, 'electron', `${product.nameShort}.exe`);
		default:
			throw new Error('Unsupported platform.');
	}
}

function getBuildElectronPath(root: string): string {
	switch (process.platform) {
		case 'darwin':
			return path.join(root, 'Contents', 'MacOS', 'Electron');
		case 'linux': {
			const product = require(path.join(root, 'resources', 'app', 'product.json'));
			return path.join(root, product.applicationName);
		}
		case 'win32': {
			const product = require(path.join(root, 'resources', 'app', 'product.json'));
			return path.join(root, `${product.nameShort}.exe`);
		}
		default:
			throw new Error('Unsupported platform.');
	}
}

function getDevOutPath(): string {
	return path.join(repoPath, 'out');
}

function getBuildOutPath(root: string): string {
	switch (process.platform) {
		case 'darwin':
			return path.join(root, 'Contents', 'Resources', 'app', 'out');
		default:
			return path.join(root, 'resources', 'app', 'out');
	}
}

async function connect(connectDriver: typeof connectElectronDriver, child: cp.ChildProcess | undefined, outPath: string, handlePath: string, logger: Logger): Promise<Code> {
	let errCount = 0;

	while (true) {
		try {
			const { client, driver } = await connectDriver(outPath, handlePath);
			return new Code(client, driver, logger);
		} catch (err) {
			if (++errCount > 50) {
				if (child) {
					child.kill();
				}
				throw err;
			}

			// retry
			await new Promise(c => setTimeout(c, 100));
		}
	}
}

// Kill all running instances, when dead
const instances = new Set<cp.ChildProcess>();
process.once('exit', () => instances.forEach(code => code.kill()));

export interface SpawnOptions {
	codePath?: string;
	workspacePath: string;
	userDataDir: string;
	extensionsPath: string;
	logger: Logger;
	verbose?: boolean;
	extraArgs?: string[];
	log?: string;
	remote?: boolean;
	web?: boolean;
	headless?: boolean;
	browser?: 'chromium' | 'webkit' | 'firefox';
}

async function createDriverHandle(): Promise<string> {
	if ('win32' === os.platform()) {
		const name = [...Array(15)].map(() => Math.random().toString(36)[3]).join('');
		return `\\\\.\\pipe\\${name}`;
	} else {
		return await new Promise<string>((c, e) => tmpName((err, handlePath) => err ? e(err) : c(handlePath)));
	}
}

export async function spawn(options: SpawnOptions): Promise<Code> {
	const handle = await createDriverHandle();

	let child: cp.ChildProcess | undefined;
	let connectDriver: typeof connectElectronDriver;

	copyExtension(options.extensionsPath, 'vscode-notebook-tests');

	if (options.web) {
		await launch(options.userDataDir, options.workspacePath, options.codePath, options.extensionsPath, Boolean(options.verbose));
		connectDriver = connectPlaywrightDriver.bind(connectPlaywrightDriver, options);
		return connect(connectDriver, child, '', handle, options.logger);
	}

	const env = { ...process.env };
	const codePath = options.codePath;
	const outPath = codePath ? getBuildOutPath(codePath) : getDevOutPath();

	const args = [
		options.workspacePath,
		'--skip-release-notes',
		'--skip-welcome',
		'--disable-telemetry',
		'--no-cached-data',
		'--disable-updates',
		'--disable-keytar',
		'--disable-crash-reporter',
		'--disable-workspace-trust',
		`--extensions-dir=${options.extensionsPath}`,
		`--user-data-dir=${options.userDataDir}`,
		`--logsPath=${path.join(repoPath, '.build', 'logs', 'smoke-tests')}`,
		'--driver', handle
	];

	if (process.platform === 'linux') {
		args.push('--disable-gpu'); // Linux has trouble in VMs to render properly with GPU enabled
	}

	if (options.remote) {
		// Replace workspace path with URI
		args[0] = `--${options.workspacePath.endsWith('.code-workspace') ? 'file' : 'folder'}-uri=vscode-remote://test+test/${URI.file(options.workspacePath).path}`;

		if (codePath) {
			// running against a build: copy the test resolver extension
			copyExtension(options.extensionsPath, 'vscode-test-resolver');
		}
		args.push('--enable-proposed-api=vscode.vscode-test-resolver');
		const remoteDataDir = `${options.userDataDir}-server`;
		mkdirp.sync(remoteDataDir);

		if (codePath) {
			// running against a build: copy the test resolver extension into remote extensions dir
			const remoteExtensionsDir = path.join(remoteDataDir, 'extensions');
			mkdirp.sync(remoteExtensionsDir);
			copyExtension(remoteExtensionsDir, 'vscode-notebook-tests');
		}

		env['TESTRESOLVER_DATA_FOLDER'] = remoteDataDir;
	}

	const spawnOptions: cp.SpawnOptions = { env };

	args.push('--enable-proposed-api=vscode.vscode-notebook-tests');

	if (!codePath) {
		args.unshift(repoPath);
	}

	if (options.verbose) {
		args.push('--driver-verbose');
		spawnOptions.stdio = ['ignore', 'inherit', 'inherit'];
	}

	if (options.log) {
		args.push('--log', options.log);
	}

	if (options.extraArgs) {
		args.push(...options.extraArgs);
	}

	const electronPath = codePath ? getBuildElectronPath(codePath) : getDevElectronPath();
	child = cp.spawn(electronPath, args, spawnOptions);
	instances.add(child);
	child.once('exit', () => instances.delete(child!));
	connectDriver = connectElectronDriver;
	return connect(connectDriver, child, outPath, handle, options.logger);
}

async function copyExtension(extensionsPath: string, extId: string): Promise<void> {
	const dest = path.join(extensionsPath, extId);
	if (!fs.existsSync(dest)) {
		const orig = path.join(repoPath, 'extensions', extId);
		await new Promise<void>((c, e) => ncp(orig, dest, err => err ? e(err) : c()));
	}
}

async function poll<T>(
	fn: () => Thenable<T>,
	acceptFn: (result: T) => boolean,
	timeoutMessage: string,
	retryCount: number = 200,
	retryInterval: number = 100 // millis
): Promise<T> {
	let trial = 1;
	let lastError: string = '';

	while (true) {
		if (trial > retryCount) {
			console.error('** Timeout!');
			console.error(lastError);

			throw new Error(`Timeout: ${timeoutMessage} after ${(retryCount * retryInterval) / 1000} seconds.`);
		}

		let result;
		try {
			result = await fn();

			if (acceptFn(result)) {
				return result;
			} else {
				lastError = 'Did not pass accept function';
			}
		} catch (e: any) {
			lastError = Array.isArray(e.stack) ? e.stack.join(os.EOL) : e.stack;
		}

		await new Promise(resolve => setTimeout(resolve, retryInterval));
		trial++;
	}
}

export class Code {

	private _activeWindowId: number | undefined = undefined;
	private driver: IDriver;

	constructor(
		private client: IDisposable,
		driver: IDriver,
		readonly logger: Logger
	) {
		this.driver = new Proxy(driver, {
			get(target, prop, receiver) {
				if (typeof prop === 'symbol') {
					throw new Error('Invalid usage');
				}

				const targetProp = (target as any)[prop];
				if (typeof targetProp !== 'function') {
					return targetProp;
				}

				return function (this: any, ...args: any[]) {
					logger.log(`${prop}`, ...args.filter(a => typeof a === 'string'));
					return targetProp.apply(this, args);
				};
			}
		});
	}

	async capturePage(): Promise<string> {
		const windowId = await this.getActiveWindowId();
		return await this.driver.capturePage(windowId);
	}

	async waitForWindowIds(fn: (windowIds: number[]) => boolean): Promise<void> {
		await poll(() => this.driver.getWindowIds(), fn, `get window ids`, 600, 100); // {{SQL CARBON EDIT}}
	}

	async dispatchKeybinding(keybinding: string): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await this.driver.dispatchKeybinding(windowId, keybinding);
	}

	async reload(): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await this.driver.reloadWindow(windowId);
	}

	async exit(): Promise<void> {
		const veto = await this.driver.exitApplication();
		if (veto === true) {
			throw new Error('Code exit was blocked by a veto.');
		}
	}

	async waitForTextContent(selector: string, textContent?: string, accept?: (result: string) => boolean, retryCount?: number): Promise<string> {
		const windowId = await this.getActiveWindowId();
		accept = accept || (result => textContent !== undefined ? textContent === result : !!result);

		// {{SQL CARBON EDIT}} Print out found element
		const element = await poll(
			() => this.driver.getElements(windowId, selector).then(els => els.length > 0 ? Promise.resolve(els[0]) : Promise.reject(new Error('Element not found for textContent'))),
			s => accept!(typeof s.textContent === 'string' ? s.textContent : ''),
			`get text content '${selector}'`,
			retryCount
		);
		this.logger.log(`got text content element ${JSON.stringify(element)}`);
		return element.textContent;
	}

	async waitAndClick(selector: string, xoffset?: number, yoffset?: number, retryCount: number = 200): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await poll(() => this.driver.click(windowId, selector, xoffset, yoffset), () => true, `click '${selector}'`, retryCount);
	}

	async waitAndDoubleClick(selector: string): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await poll(() => this.driver.doubleClick(windowId, selector), () => true, `double click '${selector}'`);
	}

	async waitForSetValue(selector: string, value: string): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await poll(() => this.driver.setValue(windowId, selector, value), () => true, `set value '${selector}'`);
	}

	async waitForElements(selector: string, recursive: boolean, accept: (result: IElement[]) => boolean = result => result.length > 0): Promise<IElement[]> {
		const windowId = await this.getActiveWindowId();
		// {{SQL CARBON EDIT}} Print out found element
		const elements = await poll(() => this.driver.getElements(windowId, selector, recursive), accept, `get elements '${selector}'`);
		this.logger.log(`got elements ${elements.map(element => JSON.stringify(element)).join('\n')}`);
		return elements;
	}

	async waitForElement(selector: string, accept: (result: IElement | undefined) => boolean = result => !!result, retryCount: number = 200): Promise<IElement> {
		const windowId = await this.getActiveWindowId();
		// {{SQL CARBON EDIT}} Print out found element
		const element = await poll<IElement>(() => this.driver.getElements(windowId, selector).then(els => els[0]), accept, `get element '${selector}'`, retryCount);
		this.logger.log(`got element ${JSON.stringify(element)}`);
		return element;
	}

	async waitForElementGone(selector: string, accept: (result: IElement | undefined) => boolean = result => !result, retryCount: number = 200): Promise<IElement> {
		const windowId = await this.getActiveWindowId();
		return await poll<IElement>(() => this.driver.getElements(windowId, selector).then(els => els[0]), accept, `get element gone '${selector}'`, retryCount);
	}

	async waitForActiveElement(selector: string, retryCount: number = 200): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await poll(() => this.driver.isActiveElement(windowId, selector), r => r, `is active element '${selector}'`, retryCount);
	}

	async waitForTitle(fn: (title: string) => boolean): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await poll(() => this.driver.getTitle(windowId), fn, `get title`);
	}

	async waitForTypeInEditor(selector: string, text: string): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await poll(() => this.driver.typeInEditor(windowId, selector, text), () => true, `type in editor '${selector}'`);
	}

	async waitForTerminalBuffer(selector: string, accept: (result: string[]) => boolean): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await poll(() => this.driver.getTerminalBuffer(windowId, selector), accept, `get terminal buffer '${selector}'`);
	}

	async writeInTerminal(selector: string, value: string): Promise<void> {
		const windowId = await this.getActiveWindowId();
		await poll(() => this.driver.writeInTerminal(windowId, selector, value), () => true, `writeInTerminal '${selector}'`);
	}

	async getLocaleInfo(): Promise<ILocaleInfo> {
		const windowId = await this.getActiveWindowId();
		return await this.driver.getLocaleInfo(windowId);
	}

	async getLocalizedStrings(): Promise<ILocalizedStrings> {
		const windowId = await this.getActiveWindowId();
		return await this.driver.getLocalizedStrings(windowId);
	}

	private async getActiveWindowId(): Promise<number> {
		if (typeof this._activeWindowId !== 'number') {
			const windows = await this.driver.getWindowIds();
			this._activeWindowId = windows[0];
		}

		return this._activeWindowId;
	}

	dispose(): void {
		this.client.dispose();
	}
}

export function findElement(element: IElement, fn: (element: IElement) => boolean): IElement | null {
	const queue = [element];

	while (queue.length > 0) {
		const element = queue.shift()!;

		if (fn(element)) {
			return element;
		}

		queue.push(...element.children);
	}

	return null;
}

export function findElements(element: IElement, fn: (element: IElement) => boolean): IElement[] {
	const result: IElement[] = [];
	const queue = [element];

	while (queue.length > 0) {
		const element = queue.shift()!;

		if (fn(element)) {
			result.push(element);
		}

		queue.push(...element.children);
	}

	return result;
}
