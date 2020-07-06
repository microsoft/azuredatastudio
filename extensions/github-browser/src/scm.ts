/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';
import { CancellationToken, commands, Disposable, scm, SourceControl, SourceControlResourceGroup, SourceControlResourceState, Uri, window, workspace } from 'vscode';
import * as nls from 'vscode-nls';
import { IChangeStore } from './changeStore';
import { GitHubApi, CommitOperation } from './github/api';
import { getRelativePath } from './extension';

const localize = nls.loadMessageBundle();

interface ScmProvider {
	sourceControl: SourceControl,
	groups: SourceControlResourceGroup[]
}

export class VirtualSCM implements Disposable {
	private readonly providers: ScmProvider[] = [];

	private disposable: Disposable;

	constructor(
		private readonly originalScheme: string,
		private readonly github: GitHubApi,
		private readonly changeStore: IChangeStore,
	) {
		this.registerCommands();

		// TODO@eamodio listen for workspace folder changes
		for (const folder of workspace.workspaceFolders ?? []) {
			this.createScmProvider(folder.uri, folder.name);
		}

		this.disposable = Disposable.from(
			changeStore.onDidChange(e => this.update(e.rootUri, e.uri)),
		);

		for (const { uri } of workspace.workspaceFolders ?? []) {
			for (const operation of changeStore.getChanges(uri)) {
				this.update(uri, operation.uri);
			}
		}
	}

	dispose() {
		this.disposable.dispose();
	}

	private registerCommands() {
		commands.registerCommand('githubBrowser.commit', (...args: any[]) => this.commitChanges(args[0]));

		commands.registerCommand('githubBrowser.discardChanges', (resourceState: SourceControlResourceState) =>
			this.discardChanges(resourceState.resourceUri)
		);

		commands.registerCommand('githubBrowser.openChanges', (resourceState: SourceControlResourceState) =>
			this.openChanges(resourceState.resourceUri)
		);

		commands.registerCommand('githubBrowser.openFile', (resourceState: SourceControlResourceState) =>
			this.openFile(resourceState.resourceUri)
		);
	}

	async commitChanges(sourceControl: SourceControl): Promise<void> {
		const operations = this.changeStore
			.getChanges(sourceControl.rootUri!)
			.map<CommitOperation>(operation => {
				const path = getRelativePath(sourceControl.rootUri!, operation.uri);
				switch (operation.type) {
					case 'created':
						return { type: operation.type, path: path, content: this.changeStore.getContent(operation.uri)! };
					case 'changed':
						return { type: operation.type, path: path, content: this.changeStore.getContent(operation.uri)! };
					case 'deleted':
						return { type: operation.type, path: path };
				}
			});
		if (!operations.length) {
			window.showInformationMessage(localize('no changes', "There are no changes to commit."));

			return;
		}

		const message = sourceControl.inputBox.value;
		if (message) {
			const sha = await this.github.commit(this.getOriginalResource(sourceControl.rootUri!), message, operations);
			if (sha !== undefined) {
				this.changeStore.acceptAll(sourceControl.rootUri!);
				sourceControl.inputBox.value = '';
			}
		}
	}

	discardChanges(uri: Uri): Promise<void> {
		return this.changeStore.discard(uri);
	}

	openChanges(uri: Uri) {
		return this.changeStore.openChanges(uri, this.getOriginalResource(uri));
	}

	openFile(uri: Uri) {
		return this.changeStore.openFile(uri);
	}

	private update(rootUri: Uri, uri: Uri) {
		const folder = workspace.getWorkspaceFolder(uri);
		if (folder === undefined) {
			return;
		}

		const provider = this.createScmProvider(rootUri, folder.name);
		const group = this.createChangesGroup(provider);
		group.resourceStates = this.changeStore.getChanges(rootUri).map<SourceControlResourceState>(op => {
			const rs: SourceControlResourceState = {
				decorations: {
					strikeThrough: op.type === 'deleted'
				},
				resourceUri: op.uri,
				command: {
					command: 'githubBrowser.openChanges',
					title: 'Open Changes',
				}
			};
			rs.command!.arguments = [rs];
			return rs;
		});
	}

	private createScmProvider(rootUri: Uri, name: string) {
		let provider = this.providers.find(sc => sc.sourceControl.rootUri?.toString() === rootUri.toString());
		if (provider === undefined) {
			const sourceControl = scm.createSourceControl('github', name, rootUri);
			sourceControl.quickDiffProvider = { provideOriginalResource: uri => this.getOriginalResource(uri) };
			sourceControl.acceptInputCommand = {
				command: 'githubBrowser.commit',
				title: 'Commit',
				arguments: [sourceControl]
			};
			sourceControl.inputBox.placeholder = `Message (Ctrl+Enter to commit '${name}')`;
			// sourceControl.inputBox.validateInput = value => value ? undefined : 'Invalid commit message';

			provider = { sourceControl: sourceControl, groups: [] };
			this.createChangesGroup(provider);
			this.providers.push(provider);
		}

		return provider;
	}

	private createChangesGroup(provider: ScmProvider) {
		let group = provider.groups.find(g => g.id === 'github.changes');
		if (group === undefined) {
			group = provider.sourceControl.createResourceGroup('github.changes', 'Changes');
			provider.groups.push(group);
		}

		return group;
	}

	private getOriginalResource(uri: Uri, _token?: CancellationToken): Uri {
		return uri.with({ scheme: this.originalScheme });
	}
}
