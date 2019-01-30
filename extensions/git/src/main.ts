/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

import { ExtensionContext, workspace, window, Disposable, commands, OutputChannel } from 'vscode'; // {{SQL CARBON EDIT}} - remove unused imports
import { findGit, Git, IGit } from './git';
import { Model } from './model';
import { CommandCenter } from './commands';
import { GitContentProvider } from './contentProvider';
import { GitDecorations } from './decorationProvider';
import { Askpass } from './askpass';
import { toDisposable, filterEvent, eventToPromise } from './util';
import TelemetryReporter from 'vscode-extension-telemetry';
import { GitExtension } from './api/git';
import { GitProtocolHandler } from './protocolHandler';
import { GitExtensionImpl } from './api/extension';
// {{SQL CARBON EDIT}} - remove unused imports
// import * as path from 'path';
// import * as fs from 'fs';

const deactivateTasks: { (): Promise<any>; }[] = [];

export async function deactivate(): Promise<any> {
	for (const task of deactivateTasks) {
		await task();
	}
}

async function createModel(context: ExtensionContext, outputChannel: OutputChannel, telemetryReporter: TelemetryReporter, disposables: Disposable[]): Promise<Model> {
	const pathHint = workspace.getConfiguration('git').get<string>('path');
	const info = await findGit(pathHint, path => outputChannel.appendLine(localize('looking', "Looking for git in: {0}", path)));
	const askpass = new Askpass();
	disposables.push(askpass);

	const env = await askpass.getEnv();
	const git = new Git({ gitPath: info.path, version: info.version, env });
	const model = new Model(git, context.globalState, outputChannel);
	disposables.push(model);

	const onRepository = () => commands.executeCommand('setContext', 'gitOpenRepositoryCount', `${model.repositories.length}`);
	model.onDidOpenRepository(onRepository, null, disposables);
	model.onDidCloseRepository(onRepository, null, disposables);
	onRepository();

	outputChannel.appendLine(localize('using git', "Using git {0} from {1}", info.version, info.path));

	const onOutput = (str: string) => {
		const lines = str.split(/\r?\n/mg);

		while (/^\s*$/.test(lines[lines.length - 1])) {
			lines.pop();
		}

		outputChannel.appendLine(lines.join('\n'));
	};
	git.onOutput.addListener('log', onOutput);
	disposables.push(toDisposable(() => git.onOutput.removeListener('log', onOutput)));

	disposables.push(
		new CommandCenter(git, model, outputChannel, telemetryReporter),
		new GitContentProvider(model),
		new GitDecorations(model),
		new GitProtocolHandler()
	);

	await checkGitVersion(info);

	return model;
}

// {{SQL CARBON EDIT}} - Comment out function that is unused due to our edit below
// async function isGitRepository(folder: WorkspaceFolder): Promise<boolean> {
// 	if (folder.uri.scheme !== 'file') {
// 		return false;
// 	}

// 	const dotGit = path.join(folder.uri.fsPath, '.git');

// 	try {
// 		const dotGitStat = await new Promise<fs.Stats>((c, e) => fs.stat(dotGit, (err, stat) => err ? e(err) : c(stat)));
// 		return dotGitStat.isDirectory();
// 	} catch (err) {
// 		return false;
// 	}
// }

// {{SQL CARBON EDIT}} - Comment out function that is unused due to our edit below
// async function warnAboutMissingGit(): Promise<void> {
// 	const config = workspace.getConfiguration('git');
// 	const shouldIgnore = config.get<boolean>('ignoreMissingGitWarning') === true;

// 	if (shouldIgnore) {
// 		return;
// 	}

// 	if (!workspace.workspaceFolders) {
// 		return;
// 	}

// 	const areGitRepositories = await Promise.all(workspace.workspaceFolders.map(isGitRepository));

// 	if (areGitRepositories.every(isGitRepository => !isGitRepository)) {
// 		return;
// 	}

// 	const download = localize('downloadgit', "Download Git");
// 	const neverShowAgain = localize('neverShowAgain', "Don't Show Again");
// 	const choice = await window.showWarningMessage(
// 		localize('notfound', "Git not found. Install it or configure it using the 'git.path' setting."),
// 		download,
// 		neverShowAgain
// 	);

// 	if (choice === download) {
// 		commands.executeCommand('vscode.open', Uri.parse('https://git-scm.com/'));
// 	} else if (choice === neverShowAgain) {
// 		await config.update('ignoreMissingGitWarning', true, true);
// 	}
// }

export async function activate(context: ExtensionContext): Promise<GitExtension> {
	const disposables: Disposable[] = [];
	context.subscriptions.push(new Disposable(() => Disposable.from(...disposables).dispose()));

	const outputChannel = window.createOutputChannel('Git');
	commands.registerCommand('git.showOutput', () => outputChannel.show());
	disposables.push(outputChannel);

	const { name, version, aiKey } = require('../package.json') as { name: string, version: string, aiKey: string };
	const telemetryReporter = new TelemetryReporter(name, version, aiKey);
	deactivateTasks.push(() => telemetryReporter.dispose());

	const config = workspace.getConfiguration('git', null);
	const enabled = config.get<boolean>('enabled');

	if (!enabled) {
		const onConfigChange = filterEvent(workspace.onDidChangeConfiguration, e => e.affectsConfiguration('git'));
		const onEnabled = filterEvent(onConfigChange, () => workspace.getConfiguration('git', null).get<boolean>('enabled') === true);
		const result = new GitExtensionImpl();

		eventToPromise(onEnabled).then(async () => result.model = await createModel(context, outputChannel, telemetryReporter, disposables));
		return result;
	}

	try {
		const model = await createModel(context, outputChannel, telemetryReporter, disposables);
		return new GitExtensionImpl(model);
	} catch (err) {
		if (!/Git installation not found/.test(err.message || '')) {
			throw err;
		}

		// {{SQL CARBON EDIT}} turn-off Git missing prompt
		// console.warn(err.message);
		// outputChannel.appendLine(err.message);

		// warnAboutMissingGit();

		return new GitExtensionImpl();
	}
}

// {{SQL CARBON EDIT}} - Rename info to _info to prevent error due to unused variable
async function checkGitVersion(_info: IGit): Promise<void> {

	// {{SQL CARBON EDIT}}
	// remove Git version check for azuredatastudio

	return;

	/*
	const config = workspace.getConfiguration('git');
	const shouldIgnore = config.get<boolean>('ignoreLegacyWarning') === true;

	if (shouldIgnore) {
		return;
	}

	if (!/^[01]/.test(info.version)) {
		return;
	}

	const update = localize('updateGit', "Update Git");
	const neverShowAgain = localize('neverShowAgain', "Don't Show Again");

	const choice = await window.showWarningMessage(
		localize('git20', "You seem to have git {0} installed. Code works best with git >= 2", info.version),
		update,
		neverShowAgain
	);

	if (choice === update) {
		commands.executeCommand('vscode.open', Uri.parse('https://git-scm.com/'));
	} else if (choice === neverShowAgain) {
		await config.update('ignoreLegacyWarning', true, true);
	}
	// {{SQL CARBON EDIT}}
	*/
}
