/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as os from 'os';
import * as path from 'path';
import { Command, commands, Disposable, LineChange, MessageOptions, Position, ProgressLocation, QuickPickItem, Range, SourceControlResourceState, TextDocumentShowOptions, TextEditor, Uri, ViewColumn, window, workspace, WorkspaceEdit, WorkspaceFolder, TimelineItem, env, Selection, TextDocumentContentProvider, InputBoxValidationSeverity, TabInputText, TabInputTextMerge, QuickPickItemKind, TextDocument, LogOutputChannel, l10n, Memento, UIKind, QuickInputButton, ThemeIcon } from 'vscode';
import TelemetryReporter from '@vscode/extension-telemetry';
import { uniqueNamesGenerator, adjectives, animals, colors, NumberDictionary } from '@joaomoreno/unique-names-generator';
import { Branch, ForcePushMode, GitErrorCodes, Ref, RefType, Status, CommitOptions, RemoteSourcePublisher, Remote } from './api/git';
import { Git, Stash } from './git';
import { Model } from './model';
import { Repository, Resource, ResourceGroupType } from './repository';
import { applyLineChanges, getModifiedRange, intersectDiffWithRange, invertLineChange, toLineRanges } from './staging';
import { fromGitUri, toGitUri, isGitUri, toMergeUris } from './uri';
import { grep, isDescendant, pathEquals, relativePath } from './util';
import { GitTimelineItem } from './timelineProvider';
import { ApiRepository } from './api/api1';
import { getRemoteSourceActions, pickRemoteSource } from './remoteSource';
import { RemoteSourceAction } from './api/git-base';

class CheckoutItem implements QuickPickItem {

	protected get shortCommit(): string { return (this.ref.commit || '').substr(0, 8); }
	get label(): string { return `${this.repository.isBranchProtected(this.ref) ? '$(lock)' : '$(git-branch)'} ${this.ref.name || this.shortCommit}`; }
	get description(): string { return this.shortCommit; }
	get refName(): string | undefined { return this.ref.name; }
	get refRemote(): string | undefined { return this.ref.remote; }
	get buttons(): QuickInputButton[] | undefined { return this._buttons; }
	set buttons(newButtons: QuickInputButton[] | undefined) { this._buttons = newButtons; }

	constructor(protected repository: Repository, protected ref: Ref, protected _buttons?: QuickInputButton[]) { }

	async run(opts?: { detached?: boolean }): Promise<void> {
		if (!this.ref.name) {
			return;
		}

		const config = workspace.getConfiguration('git', Uri.file(this.repository.root));
		const pullBeforeCheckout = config.get<boolean>('pullBeforeCheckout', false) === true;

		const treeish = opts?.detached ? this.ref.commit ?? this.ref.name : this.ref.name;
		await this.repository.checkout(treeish, { ...opts, pullBeforeCheckout });
	}
}

class CheckoutTagItem extends CheckoutItem {

	override get label(): string { return `$(tag) ${this.ref.name || this.shortCommit}`; }
	override get description(): string {
		return l10n.t('Tag at {0}', this.shortCommit);
	}

	override async run(opts?: { detached?: boolean }): Promise<void> {
		if (!this.ref.name) {
			return;
		}

		await this.repository.checkout(this.ref.name, opts);
	}
}

class CheckoutRemoteHeadItem extends CheckoutItem {

	override get label(): string { return `$(cloud) ${this.ref.name || this.shortCommit}`; }
	override get description(): string {
		return l10n.t('Remote branch at {0}', this.shortCommit);
	}

	override async run(opts?: { detached?: boolean }): Promise<void> {
		if (!this.ref.name) {
			return;
		}

		if (opts?.detached) {
			await this.repository.checkout(this.ref.commit ?? this.ref.name, opts);
			return;
		}

		const branches = await this.repository.findTrackingBranches(this.ref.name);

		if (branches.length > 0) {
			await this.repository.checkout(branches[0].name!, opts);
		} else {
			await this.repository.checkoutTracking(this.ref.name, opts);
		}
	}
}

class BranchDeleteItem implements QuickPickItem {

	private get shortCommit(): string { return (this.ref.commit || '').substr(0, 8); }
	get branchName(): string | undefined { return this.ref.name; }
	get label(): string { return this.branchName || ''; }
	get description(): string { return this.shortCommit; }

	constructor(private ref: Ref) { }

	async run(repository: Repository, force?: boolean): Promise<void> {
		if (!this.branchName) {
			return;
		}
		await repository.deleteBranch(this.branchName, force);
	}
}

class MergeItem implements QuickPickItem {

	get label(): string { return this.ref.name || ''; }
	get description(): string { return this.ref.name || ''; }

	constructor(protected ref: Ref) { }

	async run(repository: Repository): Promise<void> {
		await repository.merge(this.ref.name! || this.ref.commit!);
	}
}

class RebaseItem implements QuickPickItem {

	get label(): string { return this.ref.name || ''; }
	description: string = '';

	constructor(readonly ref: Ref) { }

	async run(repository: Repository): Promise<void> {
		if (this.ref?.name) {
			await repository.rebase(this.ref.name);
		}
	}
}

class CreateBranchItem implements QuickPickItem {
	get label(): string { return '$(plus) ' + l10n.t('Create new branch...'); }
	get description(): string { return ''; }
	get alwaysShow(): boolean { return true; }
}

class CreateBranchFromItem implements QuickPickItem {
	get label(): string { return '$(plus) ' + l10n.t('Create new branch from...'); }
	get description(): string { return ''; }
	get alwaysShow(): boolean { return true; }
}

class CheckoutDetachedItem implements QuickPickItem {
	get label(): string { return '$(debug-disconnect) ' + l10n.t('Checkout detached...'); }
	get description(): string { return ''; }
	get alwaysShow(): boolean { return true; }
}

class HEADItem implements QuickPickItem {

	constructor(private repository: Repository) { }

	get label(): string { return 'HEAD'; }
	get description(): string { return (this.repository.HEAD && this.repository.HEAD.commit || '').substr(0, 8); }
	get alwaysShow(): boolean { return true; }
	get refName(): string { return 'HEAD'; }
}

class AddRemoteItem implements QuickPickItem {

	constructor(private cc: CommandCenter) { }

	get label(): string { return '$(plus) ' + l10n.t('Add a new remote...'); }
	get description(): string { return ''; }

	get alwaysShow(): boolean { return true; }

	async run(repository: Repository): Promise<void> {
		await this.cc.addRemote(repository);
	}
}

class RemoteItem implements QuickPickItem {
	get label() { return `$(cloud) ${this.remote.name}`; }
	get description(): string | undefined { return this.remote.fetchUrl; }
	get remoteName(): string { return this.remote.name; }

	constructor(private readonly repository: Repository, private readonly remote: Remote) { }

	async run(): Promise<void> {
		await this.repository.fetch({ remote: this.remote.name });
	}
}

class FetchAllRemotesItem implements QuickPickItem {
	get label(): string { return l10n.t('{0} Fetch all remotes', '$(cloud-download)'); }

	constructor(private readonly repository: Repository) { }

	async run(): Promise<void> {
		await this.repository.fetch({ all: true });
	}
}

class RepositoryItem implements QuickPickItem {
	get label(): string { return `$(repo) ${getRepositoryLabel(this.path)}`; }

	get description(): string { return this.path; }

	constructor(public readonly path: string) { }
}

interface ScmCommandOptions {
	repository?: boolean;
	diff?: boolean;
}

interface ScmCommand {
	commandId: string;
	key: string;
	method: Function;
	options: ScmCommandOptions;
}

const Commands: ScmCommand[] = [];

function command(commandId: string, options: ScmCommandOptions = {}): Function {
	return (_target: any, key: string, descriptor: any) => {
		if (!(typeof descriptor.value === 'function')) {
			throw new Error('not supported');
		}

		Commands.push({ commandId, key, method: descriptor.value, options });
	};
}

// const ImageMimetypes = [
// 	'image/png',
// 	'image/gif',
// 	'image/jpeg',
// 	'image/webp',
// 	'image/tiff',
// 	'image/bmp'
// ];

async function categorizeResourceByResolution(resources: Resource[]): Promise<{ merge: Resource[]; resolved: Resource[]; unresolved: Resource[]; deletionConflicts: Resource[] }> {
	const selection = resources.filter(s => s instanceof Resource) as Resource[];
	const merge = selection.filter(s => s.resourceGroupType === ResourceGroupType.Merge);
	const isBothAddedOrModified = (s: Resource) => s.type === Status.BOTH_MODIFIED || s.type === Status.BOTH_ADDED;
	const isAnyDeleted = (s: Resource) => s.type === Status.DELETED_BY_THEM || s.type === Status.DELETED_BY_US;
	const possibleUnresolved = merge.filter(isBothAddedOrModified);
	const promises = possibleUnresolved.map(s => grep(s.resourceUri.fsPath, /^<{7}|^={7}|^>{7}/));
	const unresolvedBothModified = await Promise.all<boolean>(promises);
	const resolved = possibleUnresolved.filter((_s, i) => !unresolvedBothModified[i]);
	const deletionConflicts = merge.filter(s => isAnyDeleted(s));
	const unresolved = [
		...merge.filter(s => !isBothAddedOrModified(s) && !isAnyDeleted(s)),
		...possibleUnresolved.filter((_s, i) => unresolvedBothModified[i])
	];

	return { merge, resolved, unresolved, deletionConflicts };
}

async function createCheckoutItems(repository: Repository, detached = false): Promise<CheckoutItem[]> {
	const config = workspace.getConfiguration('git');
	const checkoutTypeConfig = config.get<string | string[]>('checkoutType');
	let checkoutTypes: string[];

	if (checkoutTypeConfig === 'all' || !checkoutTypeConfig || checkoutTypeConfig.length === 0) {
		checkoutTypes = ['local', 'remote', 'tags'];
	} else if (typeof checkoutTypeConfig === 'string') {
		checkoutTypes = [checkoutTypeConfig];
	} else {
		checkoutTypes = checkoutTypeConfig;
	}

	if (detached) {
		// Remove tags when in detached mode
		checkoutTypes = checkoutTypes.filter(t => t !== 'tags');
	}

	const refs = await repository.getRefs();
	const processors = checkoutTypes.map(type => getCheckoutProcessor(repository, type))
		.filter(p => !!p) as CheckoutProcessor[];

	for (const ref of refs) {
		for (const processor of processors) {
			processor.onRef(ref);
		}
	}

	const buttons = await getRemoteRefItemButtons(repository);
	let fallbackRemoteButtons: RemoteSourceActionButton[] | undefined = [];
	const remote = repository.remotes.find(r => r.pushUrl === repository.HEAD?.remote || r.fetchUrl === repository.HEAD?.remote) ?? repository.remotes[0];
	const remoteUrl = remote?.pushUrl ?? remote?.fetchUrl;
	if (remoteUrl) {
		fallbackRemoteButtons = buttons.get(remoteUrl);
	}

	return processors.reduce<CheckoutItem[]>((r, p) => r.concat(...p.items.map((item) => {
		if (item.refRemote) {
			const matchingRemote = repository.remotes.find((remote) => remote.name === item.refRemote);
			const remoteUrl = matchingRemote?.pushUrl ?? matchingRemote?.fetchUrl;
			if (remoteUrl) {
				item.buttons = buttons.get(item.refRemote);
			}
		}

		item.buttons = fallbackRemoteButtons;
		return item;
	})), []);
}

type RemoteSourceActionButton = {
	iconPath: ThemeIcon;
	tooltip: string;
	actual: RemoteSourceAction;
};

async function getRemoteRefItemButtons(repository: Repository) {
	// Compute actions for all known remotes
	const remoteUrlsToActions = new Map<string, RemoteSourceActionButton[]>();

	const getButtons = async (remoteUrl: string) => (await getRemoteSourceActions(remoteUrl)).map((action) => ({ iconPath: new ThemeIcon(action.icon), tooltip: action.label, actual: action }));

	for (const remote of repository.remotes) {
		if (remote.fetchUrl) {
			const actions = remoteUrlsToActions.get(remote.fetchUrl) ?? [];
			actions.push(...await getButtons(remote.fetchUrl));
			remoteUrlsToActions.set(remote.fetchUrl, actions);
		}
		if (remote.pushUrl && remote.pushUrl !== remote.fetchUrl) {
			const actions = remoteUrlsToActions.get(remote.pushUrl) ?? [];
			actions.push(...await getButtons(remote.pushUrl));
			remoteUrlsToActions.set(remote.pushUrl, actions);
		}
	}

	return remoteUrlsToActions;
}

class CheckoutProcessor {

	private refs: Ref[] = [];
	get items(): CheckoutItem[] { return this.refs.map(r => new this.ctor(this.repository, r)); }
	constructor(private repository: Repository, private type: RefType, private ctor: { new(repository: Repository, ref: Ref): CheckoutItem }) { }

	onRef(ref: Ref): void {
		if (ref.type === this.type) {
			this.refs.push(ref);
		}
	}
}

function getCheckoutProcessor(repository: Repository, type: string): CheckoutProcessor | undefined {
	switch (type) {
		case 'local':
			return new CheckoutProcessor(repository, RefType.Head, CheckoutItem);
		case 'remote':
			return new CheckoutProcessor(repository, RefType.RemoteHead, CheckoutRemoteHeadItem);
		case 'tags':
			return new CheckoutProcessor(repository, RefType.Tag, CheckoutTagItem);
	}

	return undefined;
}

function getRepositoryLabel(repositoryRoot: string): string {
	const workspaceFolder = workspace.getWorkspaceFolder(Uri.file(repositoryRoot));
	return workspaceFolder?.uri.toString() === repositoryRoot ? workspaceFolder.name : path.basename(repositoryRoot);
}

function compareRepositoryLabel(repositoryRoot1: string, repositoryRoot2: string): number {
	return getRepositoryLabel(repositoryRoot1).localeCompare(getRepositoryLabel(repositoryRoot2));
}

function sanitizeBranchName(name: string, whitespaceChar: string): string {
	return name ? name.trim().replace(/^-+/, '').replace(/^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$|\[|\]$/g, whitespaceChar) : name;
}

function sanitizeRemoteName(name: string) {
	name = name.trim();
	return name && name.replace(/^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$|\[|\]$/g, '-');
}

class TagItem implements QuickPickItem {
	get label(): string { return `$(tag) ${this.ref.name ?? ''}`; }
	get description(): string { return this.ref.commit?.substr(0, 8) ?? ''; }
	constructor(readonly ref: Ref) { }
}

enum PushType {
	Push,
	PushTo,
	PushFollowTags,
	PushTags
}

interface PushOptions {
	pushType: PushType;
	forcePush?: boolean;
	silent?: boolean;

	pushTo?: {
		remote?: string;
		refspec?: string;
		setUpstream?: boolean;
	};
}

class CommandErrorOutputTextDocumentContentProvider implements TextDocumentContentProvider {

	private items = new Map<string, string>();

	set(uri: Uri, contents: string): void {
		this.items.set(uri.path, contents);
	}

	delete(uri: Uri): void {
		this.items.delete(uri.path);
	}

	provideTextDocumentContent(uri: Uri): string | undefined {
		return this.items.get(uri.path);
	}
}

export class CommandCenter {

	private disposables: Disposable[];
	private commandErrors = new CommandErrorOutputTextDocumentContentProvider();

	constructor(
		private git: Git,
		private model: Model,
		private globalState: Memento,
		private logger: LogOutputChannel,
		private telemetryReporter: TelemetryReporter
	) {
		this.disposables = Commands.map(({ commandId, key, method, options }) => {
			const command = this.createCommand(commandId, key, method, options);

			if (options.diff) {
				return commands.registerDiffInformationCommand(commandId, command);
			} else {
				return commands.registerCommand(commandId, command);
			}
		});

		this.disposables.push(workspace.registerTextDocumentContentProvider('git-output', this.commandErrors));
	}

	@command('git.showOutput')
	showOutput(): void {
		this.logger.show();
	}

	@command('git.refresh', { repository: true })
	async refresh(repository: Repository): Promise<void> {
		await repository.status();
	}

	@command('git.openResource')
	async openResource(resource: Resource): Promise<void> {
		const repository = this.model.getRepository(resource.resourceUri);

		if (!repository) {
			return;
		}

		await resource.open();
	}

	@command('git.openAllChanges', { repository: true })
	async openChanges(repository: Repository): Promise<void> {
		for (const resource of [...repository.workingTreeGroup.resourceStates, ...repository.untrackedGroup.resourceStates]) {
			if (
				resource.type === Status.DELETED || resource.type === Status.DELETED_BY_THEM ||
				resource.type === Status.DELETED_BY_US || resource.type === Status.BOTH_DELETED
			) {
				continue;
			}

			void commands.executeCommand(
				'vscode.open',
				resource.resourceUri,
				{ background: true, preview: false, }
			);
		}
	}

	@command('git.openMergeEditor')
	async openMergeEditor(uri: unknown) {
		if (uri === undefined) {
			// fallback to active editor...
			if (window.tabGroups.activeTabGroup.activeTab?.input instanceof TabInputText) {
				uri = window.tabGroups.activeTabGroup.activeTab.input.uri;
			}
		}
		if (!(uri instanceof Uri)) {
			return;
		}
		const repo = this.model.getRepository(uri);
		if (!repo) {
			return;
		}

		const isRebasing = Boolean(repo.rebaseCommit);

		type InputData = { uri: Uri; title?: string; detail?: string; description?: string };
		const mergeUris = toMergeUris(uri);

		let isStashConflict = false;
		try {
			// Look at the conflict markers to check if this is a stash conflict
			const document = await workspace.openTextDocument(uri);
			const firstConflictInfo = findFirstConflictMarker(document);
			isStashConflict = firstConflictInfo?.incomingChangeLabel === 'Stashed changes';
		} catch (error) {
			console.error(error);
		}

		const current: InputData = { uri: mergeUris.ours, title: l10n.t('Current') };
		const incoming: InputData = { uri: mergeUris.theirs, title: l10n.t('Incoming') };

		if (isStashConflict) {
			incoming.title = l10n.t('Stashed Changes');
		}

		try {
			const [head, rebaseOrMergeHead] = await Promise.all([
				repo.getCommit('HEAD'),
				isRebasing ? repo.getCommit('REBASE_HEAD') : repo.getCommit('MERGE_HEAD')
			]);
			// ours (current branch and commit)
			current.detail = head.refNames.map(s => s.replace(/^HEAD ->/, '')).join(', ');
			current.description = '$(git-commit) ' + head.hash.substring(0, 7);
			current.uri = toGitUri(uri, head.hash);

			// theirs
			incoming.detail = rebaseOrMergeHead.refNames.join(', ');
			incoming.description = '$(git-commit) ' + rebaseOrMergeHead.hash.substring(0, 7);
			incoming.uri = toGitUri(uri, rebaseOrMergeHead.hash);

		} catch (error) {
			// not so bad, can continue with just uris
			console.error('FAILED to read HEAD, MERGE_HEAD commits');
			console.error(error);
		}

		const options = {
			base: mergeUris.base,
			input1: isRebasing ? current : incoming,
			input2: isRebasing ? incoming : current,
			output: uri
		};

		await commands.executeCommand(
			'_open.mergeEditor',
			options
		);

		function findFirstConflictMarker(doc: TextDocument): { currentChangeLabel: string; incomingChangeLabel: string } | undefined {
			const conflictMarkerStart = '<<<<<<<';
			const conflictMarkerEnd = '>>>>>>>';
			let inConflict = false;
			let currentChangeLabel: string = '';
			let incomingChangeLabel: string = '';
			let hasConflict = false;

			for (let lineIdx = 0; lineIdx < doc.lineCount; lineIdx++) {
				const lineStr = doc.lineAt(lineIdx).text;
				if (!inConflict) {
					if (lineStr.startsWith(conflictMarkerStart)) {
						currentChangeLabel = lineStr.substring(conflictMarkerStart.length).trim();
						inConflict = true;
						hasConflict = true;
					}
				} else {
					if (lineStr.startsWith(conflictMarkerEnd)) {
						incomingChangeLabel = lineStr.substring(conflictMarkerStart.length).trim();
						inConflict = false;
						break;
					}
				}
			}
			if (hasConflict) {
				return {
					currentChangeLabel,
					incomingChangeLabel
				};
			}
			return undefined;
		}
	}

	async cloneRepository(url?: string, parentPath?: string, options: { recursive?: boolean; ref?: string } = {}): Promise<void> {
		if (!url || typeof url !== 'string') {
			url = await pickRemoteSource({
				providerLabel: provider => l10n.t('Clone from {0}', provider.name),
				urlLabel: l10n.t('Clone from URL')
			});
		}

		if (!url) {
			/* __GDPR__
				"clone" : {
					"owner": "lszomoru",
					"outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "The outcome of the git operation" }
				}
			*/
			this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'no_URL' });
			return;
		}

		url = url.trim().replace(/^git\s+clone\s+/, '');

		if (!parentPath) {
			const config = workspace.getConfiguration('git');
			let defaultCloneDirectory = config.get<string>('defaultCloneDirectory') || os.homedir();
			defaultCloneDirectory = defaultCloneDirectory.replace(/^~/, os.homedir());

			const uris = await window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: Uri.file(defaultCloneDirectory),
				title: l10n.t('Choose a folder to clone {0} into', url),
				openLabel: l10n.t('Select as Repository Destination')
			});

			if (!uris || uris.length === 0) {
				/* __GDPR__
					"clone" : {
						"owner": "lszomoru",
						"outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "The outcome of the git operation" }
					}
				*/
				this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'no_directory' });
				return;
			}

			const uri = uris[0];
			parentPath = uri.fsPath;
		}

		try {
			const opts = {
				location: ProgressLocation.Notification,
				title: l10n.t('Cloning git repository "{0}"...', url),
				cancellable: true
			};

			const repositoryPath = await window.withProgress(
				opts,
				(progress, token) => this.git.clone(url!, { parentPath: parentPath!, progress, recursive: options.recursive, ref: options.ref }, token)
			);

			const config = workspace.getConfiguration('git');
			const openAfterClone = config.get<'always' | 'alwaysNewWindow' | 'whenNoFolderOpen' | 'prompt'>('openAfterClone');

			enum PostCloneAction { Open, OpenNewWindow, AddToWorkspace }
			let action: PostCloneAction | undefined = undefined;

			if (openAfterClone === 'always') {
				action = PostCloneAction.Open;
			} else if (openAfterClone === 'alwaysNewWindow') {
				action = PostCloneAction.OpenNewWindow;
			} else if (openAfterClone === 'whenNoFolderOpen' && !workspace.workspaceFolders) {
				action = PostCloneAction.Open;
			}

			if (action === undefined) {
				let message = l10n.t('Would you like to open the cloned repository?');
				const open = l10n.t('Open');
				const openNewWindow = l10n.t('Open in New Window');
				const choices = [open, openNewWindow];

				const addToWorkspace = l10n.t('Add to Workspace');
				if (workspace.workspaceFolders) {
					message = l10n.t('Would you like to open the cloned repository, or add it to the current workspace?');
					choices.push(addToWorkspace);
				}

				const result = await window.showInformationMessage(message, { modal: true }, ...choices);

				action = result === open ? PostCloneAction.Open
					: result === openNewWindow ? PostCloneAction.OpenNewWindow
						: result === addToWorkspace ? PostCloneAction.AddToWorkspace : undefined;
			}

			/* __GDPR__
				"clone" : {
					"owner": "lszomoru",
					"outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "The outcome of the git operation" },
					"openFolder": { "classification": "SystemMetaData", "purpose": "PerformanceAndHealth", "isMeasurement": true, "comment": "Indicates whether the folder is opened following the clone operation" }
				}
			*/
			this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'success' }, { openFolder: action === PostCloneAction.Open || action === PostCloneAction.OpenNewWindow ? 1 : 0 });

			const uri = Uri.file(repositoryPath);

			if (action === PostCloneAction.Open) {
				commands.executeCommand('vscode.openFolder', uri, { forceReuseWindow: true });
			} else if (action === PostCloneAction.AddToWorkspace) {
				workspace.updateWorkspaceFolders(workspace.workspaceFolders!.length, 0, { uri });
			} else if (action === PostCloneAction.OpenNewWindow) {
				commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
			}
		} catch (err) {
			if (/already exists and is not an empty directory/.test(err && err.stderr || '')) {
				/* __GDPR__
					"clone" : {
						"owner": "lszomoru",
						"outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "The outcome of the git operation" }
					}
				*/
				this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'directory_not_empty' });
			} else if (/Cancelled/i.test(err && (err.message || err.stderr || ''))) {
				return;
			} else {
				/* __GDPR__
					"clone" : {
						"owner": "lszomoru",
						"outcome" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "The outcome of the git operation" }
					}
				*/
				this.telemetryReporter.sendTelemetryEvent('clone', { outcome: 'error' });
			}

			throw err;
		}
	}

	@command('git.continueInLocalClone')
	async continueInLocalClone(): Promise<Uri | void> {
		if (this.model.repositories.length === 0) { return; }

		// Pick a single repository to continue working on in a local clone if there's more than one
		const items = this.model.repositories.reduce<(QuickPickItem & { repository: Repository })[]>((items, repository) => {
			const remote = repository.remotes.find((r) => r.name === repository.HEAD?.upstream?.remote);
			if (remote?.pushUrl) {
				items.push({ repository: repository, label: remote.pushUrl });
			}
			return items;
		}, []);

		let selection = items[0];
		if (items.length > 1) {
			const pick = await window.showQuickPick(items, { canPickMany: false, placeHolder: l10n.t('Choose which repository to clone') });
			if (pick === undefined) { return; }
			selection = pick;
		}

		const uri = selection.label;
		const ref = selection.repository.HEAD?.upstream?.name;

		if (uri !== undefined) {
			let target = `${env.uriScheme}://vscode.git/clone?url=${encodeURIComponent(uri)}`;
			const isWeb = env.uiKind === UIKind.Web;
			const isRemote = env.remoteName !== undefined;

			if (isWeb || isRemote) {
				if (ref !== undefined) {
					target += `&ref=${encodeURIComponent(ref)}`;
				}

				if (isWeb) {
					// Launch desktop client if currently in web
					return Uri.parse(target);
				}

				if (isRemote) {
					// If already in desktop client but in a remote window, we need to force a new window
					// so that the git extension can access the local filesystem for cloning
					target += `&windowId=_blank`;
					return Uri.parse(target);
				}
			}

			// Otherwise, directly clone
			void this.clone(uri, undefined, { ref: ref });
		}
	}

	@command('git.clone')
	async clone(url?: string, parentPath?: string, options?: { ref?: string }): Promise<void> {
		await this.cloneRepository(url, parentPath, options);
	}

	@command('git.cloneRecursive')
	async cloneRecursive(url?: string, parentPath?: string): Promise<void> {
		await this.cloneRepository(url, parentPath, { recursive: true });
	}

	@command('git.init')
	async init(skipFolderPrompt = false): Promise<void> {
		let repositoryPath: string | undefined = undefined;
		let askToOpen = true;

		if (workspace.workspaceFolders) {
			if (skipFolderPrompt && workspace.workspaceFolders.length === 1) {
				repositoryPath = workspace.workspaceFolders[0].uri.fsPath;
				askToOpen = false;
			} else {
				const placeHolder = l10n.t('Pick workspace folder to initialize git repo in');
				const pick = { label: l10n.t('Choose Folder...') };
				const items: { label: string; folder?: WorkspaceFolder }[] = [
					...workspace.workspaceFolders.map(folder => ({ label: folder.name, description: folder.uri.fsPath, folder })),
					pick
				];
				const item = await window.showQuickPick(items, { placeHolder, ignoreFocusOut: true });

				if (!item) {
					return;
				} else if (item.folder) {
					repositoryPath = item.folder.uri.fsPath;
					askToOpen = false;
				}
			}
		}

		if (!repositoryPath) {
			const homeUri = Uri.file(os.homedir());
			const defaultUri = workspace.workspaceFolders && workspace.workspaceFolders.length > 0
				? Uri.file(workspace.workspaceFolders[0].uri.fsPath)
				: homeUri;

			const result = await window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri,
				openLabel: l10n.t('Initialize Repository')
			});

			if (!result || result.length === 0) {
				return;
			}

			const uri = result[0];

			if (homeUri.toString().startsWith(uri.toString())) {
				const yes = l10n.t('Initialize Repository');
				const answer = await window.showWarningMessage(l10n.t('This will create a Git repository in "{0}". Are you sure you want to continue?', uri.fsPath), yes);

				if (answer !== yes) {
					return;
				}
			}

			repositoryPath = uri.fsPath;

			if (workspace.workspaceFolders && workspace.workspaceFolders.some(w => w.uri.toString() === uri.toString())) {
				askToOpen = false;
			}
		}

		const config = workspace.getConfiguration('git');
		const defaultBranchName = config.get<string>('defaultBranchName', 'main');
		const branchWhitespaceChar = config.get<string>('branchWhitespaceChar', '-');

		await this.git.init(repositoryPath, { defaultBranch: sanitizeBranchName(defaultBranchName, branchWhitespaceChar) });

		let message = l10n.t('Would you like to open the initialized repository?');
		const open = l10n.t('Open');
		const openNewWindow = l10n.t('Open in New Window');
		const choices = [open, openNewWindow];

		if (!askToOpen) {
			return;
		}

		const addToWorkspace = l10n.t('Add to Workspace');
		if (workspace.workspaceFolders) {
			message = l10n.t('Would you like to open the initialized repository, or add it to the current workspace?');
			choices.push(addToWorkspace);
		}

		const result = await window.showInformationMessage(message, ...choices);
		const uri = Uri.file(repositoryPath);

		if (result === open) {
			commands.executeCommand('vscode.openFolder', uri);
		} else if (result === addToWorkspace) {
			workspace.updateWorkspaceFolders(workspace.workspaceFolders!.length, 0, { uri });
		} else if (result === openNewWindow) {
			commands.executeCommand('vscode.openFolder', uri, true);
		} else {
			await this.model.openRepository(repositoryPath);
		}
	}

	@command('git.openRepository', { repository: false })
	async openRepository(path?: string): Promise<void> {
		if (!path) {
			const result = await window.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: Uri.file(os.homedir()),
				openLabel: l10n.t('Open Repository')
			});

			if (!result || result.length === 0) {
				return;
			}

			path = result[0].fsPath;
		}

		await this.model.openRepository(path, true);
	}

	@command('git.reopenClosedRepositories', { repository: false })
	async reopenClosedRepositories(): Promise<void> {
		if (this.model.closedRepositories.length === 0) {
			return;
		}

		const closedRepositories: string[] = [];

		const title = l10n.t('Reopen Closed Repositories');
		const placeHolder = l10n.t('Pick a repository to reopen');

		const allRepositoriesLabel = l10n.t('All Repositories');
		const allRepositoriesQuickPickItem: QuickPickItem = { label: allRepositoriesLabel };
		const repositoriesQuickPickItems: QuickPickItem[] = this.model.closedRepositories
			.sort(compareRepositoryLabel).map(r => new RepositoryItem(r));

		const items = this.model.closedRepositories.length === 1 ? [...repositoriesQuickPickItems] :
			[...repositoriesQuickPickItems, { label: '', kind: QuickPickItemKind.Separator }, allRepositoriesQuickPickItem];

		const repositoryItem = await window.showQuickPick(items, { title, placeHolder });
		if (!repositoryItem) {
			return;
		}

		if (repositoryItem === allRepositoriesQuickPickItem) {
			// All Repositories
			closedRepositories.push(...this.model.closedRepositories.values());
		} else {
			// One Repository
			closedRepositories.push((repositoryItem as RepositoryItem).path);
		}

		for (const repository of closedRepositories) {
			await this.model.openRepository(repository, true);
		}
	}

	@command('git.close', { repository: true })
	async close(repository: Repository): Promise<void> {
		this.model.close(repository);
	}

	@command('git.openFile')
	async openFile(arg?: Resource | Uri, ...resourceStates: SourceControlResourceState[]): Promise<void> {
		const preserveFocus = arg instanceof Resource;

		let uris: Uri[] | undefined;

		if (arg instanceof Uri) {
			if (isGitUri(arg)) {
				uris = [Uri.file(fromGitUri(arg).path)];
			} else if (arg.scheme === 'file') {
				uris = [arg];
			}
		} else {
			let resource = arg;

			if (!(resource instanceof Resource)) {
				// can happen when called from a keybinding
				resource = this.getSCMResource();
			}

			if (resource) {
				uris = ([resource, ...resourceStates] as Resource[])
					.filter(r => r.type !== Status.DELETED && r.type !== Status.INDEX_DELETED)
					.map(r => r.resourceUri);
			} else if (window.activeTextEditor) {
				uris = [window.activeTextEditor.document.uri];
			}
		}

		if (!uris) {
			return;
		}

		const activeTextEditor = window.activeTextEditor;
		// Must extract these now because opening a new document will change the activeTextEditor reference
		const previousVisibleRange = activeTextEditor?.visibleRanges[0];
		const previousURI = activeTextEditor?.document.uri;
		const previousSelection = activeTextEditor?.selection;

		for (const uri of uris) {
			const opts: TextDocumentShowOptions = {
				preserveFocus,
				preview: false,
				viewColumn: ViewColumn.Active
			};

			await commands.executeCommand('vscode.open', uri, {
				...opts,
				override: arg instanceof Resource && arg.type === Status.BOTH_MODIFIED ? false : undefined
			});

			const document = window.activeTextEditor?.document;

			// If the document doesn't match what we opened then don't attempt to select the range
			// Additionally if there was no previous document we don't have information to select a range
			if (document?.uri.toString() !== uri.toString() || !activeTextEditor || !previousURI || !previousSelection) {
				continue;
			}

			// Check if active text editor has same path as other editor. we cannot compare via
			// URI.toString() here because the schemas can be different. Instead we just go by path.
			if (previousURI.path === uri.path && document) {
				// preserve not only selection but also visible range
				opts.selection = previousSelection;
				const editor = await window.showTextDocument(document, opts);
				// This should always be defined but just in case
				if (previousVisibleRange) {
					editor.revealRange(previousVisibleRange);
				}
			}
		}
	}

	@command('git.openFile2')
	async openFile2(arg?: Resource | Uri, ...resourceStates: SourceControlResourceState[]): Promise<void> {
		this.openFile(arg, ...resourceStates);
	}

	@command('git.openHEADFile')
	async openHEADFile(arg?: Resource | Uri): Promise<void> {
		let resource: Resource | undefined = undefined;
		const preview = !(arg instanceof Resource);

		if (arg instanceof Resource) {
			resource = arg;
		} else if (arg instanceof Uri) {
			resource = this.getSCMResource(arg);
		} else {
			resource = this.getSCMResource();
		}

		if (!resource) {
			return;
		}

		const HEAD = resource.leftUri;
		const basename = path.basename(resource.resourceUri.fsPath);
		const title = `${basename} (HEAD)`;

		if (!HEAD) {
			window.showWarningMessage(l10n.t('HEAD version of "{0}" is not available.', path.basename(resource.resourceUri.fsPath)));
			return;
		}

		const opts: TextDocumentShowOptions = {
			preview
		};

		return await commands.executeCommand<void>('vscode.open', HEAD, opts, title);
	}

	@command('git.openChange')
	async openChange(arg?: Resource | Uri, ...resourceStates: SourceControlResourceState[]): Promise<void> {
		let resources: Resource[] | undefined = undefined;

		if (arg instanceof Uri) {
			const resource = this.getSCMResource(arg);
			if (resource !== undefined) {
				resources = [resource];
			}
		} else {
			let resource: Resource | undefined = undefined;

			if (arg instanceof Resource) {
				resource = arg;
			} else {
				resource = this.getSCMResource();
			}

			if (resource) {
				resources = [...resourceStates as Resource[], resource];
			}
		}

		if (!resources) {
			return;
		}

		for (const resource of resources) {
			await resource.openChange();
		}
	}

	@command('git.rename', { repository: true })
	async rename(repository: Repository, fromUri: Uri | undefined): Promise<void> {
		fromUri = fromUri ?? window.activeTextEditor?.document.uri;

		if (!fromUri) {
			return;
		}

		const from = relativePath(repository.root, fromUri.fsPath);
		let to = await window.showInputBox({
			value: from,
			valueSelection: [from.length - path.basename(from).length, from.length]
		});

		to = to?.trim();

		if (!to) {
			return;
		}

		await repository.move(from, to);
	}

	@command('git.stage')
	async stage(...resourceStates: SourceControlResourceState[]): Promise<void> {
		this.logger.debug(`git.stage ${resourceStates.length} `);

		resourceStates = resourceStates.filter(s => !!s);

		if (resourceStates.length === 0 || (resourceStates[0] && !(resourceStates[0].resourceUri instanceof Uri))) {
			const resource = this.getSCMResource();

			this.logger.debug(`git.stage.getSCMResource ${resource ? resource.resourceUri.toString() : null} `);

			if (!resource) {
				return;
			}

			resourceStates = [resource];
		}

		const selection = resourceStates.filter(s => s instanceof Resource) as Resource[];
		const { resolved, unresolved, deletionConflicts } = await categorizeResourceByResolution(selection);

		if (unresolved.length > 0) {
			const message = unresolved.length > 1
				? l10n.t('Are you sure you want to stage {0} files with merge conflicts?', unresolved.length)
				: l10n.t('Are you sure you want to stage {0} with merge conflicts?', path.basename(unresolved[0].resourceUri.fsPath));

			const yes = l10n.t('Yes');
			const pick = await window.showWarningMessage(message, { modal: true }, yes);

			if (pick !== yes) {
				return;
			}
		}

		try {
			await this.runByRepository(deletionConflicts.map(r => r.resourceUri), async (repository, resources) => {
				for (const resource of resources) {
					await this._stageDeletionConflict(repository, resource);
				}
			});
		} catch (err) {
			if (/Cancelled/.test(err.message)) {
				return;
			}

			throw err;
		}

		const workingTree = selection.filter(s => s.resourceGroupType === ResourceGroupType.WorkingTree);
		const untracked = selection.filter(s => s.resourceGroupType === ResourceGroupType.Untracked);
		const scmResources = [...workingTree, ...untracked, ...resolved, ...unresolved];

		this.logger.debug(`git.stage.scmResources ${scmResources.length} `);
		if (!scmResources.length) {
			return;
		}

		const resources = scmResources.map(r => r.resourceUri);
		await this.runByRepository(resources, async (repository, resources) => repository.add(resources));
	}

	@command('git.stageAll', { repository: true })
	async stageAll(repository: Repository): Promise<void> {
		const resources = [...repository.workingTreeGroup.resourceStates, ...repository.untrackedGroup.resourceStates];
		const uris = resources.map(r => r.resourceUri);

		if (uris.length > 0) {
			const config = workspace.getConfiguration('git', Uri.file(repository.root));
			const untrackedChanges = config.get<'mixed' | 'separate' | 'hidden'>('untrackedChanges');
			await repository.add(uris, untrackedChanges === 'mixed' ? undefined : { update: true });
		}
	}

	private async _stageDeletionConflict(repository: Repository, uri: Uri): Promise<void> {
		const uriString = uri.toString();
		const resource = repository.mergeGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString)[0];

		if (!resource) {
			return;
		}

		if (resource.type === Status.DELETED_BY_THEM) {
			const keepIt = l10n.t('Keep Our Version');
			const deleteIt = l10n.t('Delete File');
			const result = await window.showInformationMessage(l10n.t('File "{0}" was deleted by them and modified by us.\n\nWhat would you like to do?', path.basename(uri.fsPath)), { modal: true }, keepIt, deleteIt);

			if (result === keepIt) {
				await repository.add([uri]);
			} else if (result === deleteIt) {
				await repository.rm([uri]);
			} else {
				throw new Error('Cancelled');
			}
		} else if (resource.type === Status.DELETED_BY_US) {
			const keepIt = l10n.t('Keep Their Version');
			const deleteIt = l10n.t('Delete File');
			const result = await window.showInformationMessage(l10n.t('File "{0}" was deleted by us and modified by them.\n\nWhat would you like to do?', path.basename(uri.fsPath)), { modal: true }, keepIt, deleteIt);

			if (result === keepIt) {
				await repository.add([uri]);
			} else if (result === deleteIt) {
				await repository.rm([uri]);
			} else {
				throw new Error('Cancelled');
			}
		}
	}

	@command('git.stageAllTracked', { repository: true })
	async stageAllTracked(repository: Repository): Promise<void> {
		const resources = repository.workingTreeGroup.resourceStates
			.filter(r => r.type !== Status.UNTRACKED && r.type !== Status.IGNORED);
		const uris = resources.map(r => r.resourceUri);

		await repository.add(uris);
	}

	@command('git.stageAllUntracked', { repository: true })
	async stageAllUntracked(repository: Repository): Promise<void> {
		const resources = [...repository.workingTreeGroup.resourceStates, ...repository.untrackedGroup.resourceStates]
			.filter(r => r.type === Status.UNTRACKED || r.type === Status.IGNORED);
		const uris = resources.map(r => r.resourceUri);

		await repository.add(uris);
	}

	@command('git.stageAllMerge', { repository: true })
	async stageAllMerge(repository: Repository): Promise<void> {
		const resources = repository.mergeGroup.resourceStates.filter(s => s instanceof Resource) as Resource[];
		const { merge, unresolved, deletionConflicts } = await categorizeResourceByResolution(resources);

		try {
			for (const deletionConflict of deletionConflicts) {
				await this._stageDeletionConflict(repository, deletionConflict.resourceUri);
			}
		} catch (err) {
			if (/Cancelled/.test(err.message)) {
				return;
			}

			throw err;
		}

		if (unresolved.length > 0) {
			const message = unresolved.length > 1
				? l10n.t('Are you sure you want to stage {0} files with merge conflicts?', merge.length)
				: l10n.t('Are you sure you want to stage {0} with merge conflicts?', path.basename(merge[0].resourceUri.fsPath));

			const yes = l10n.t('Yes');
			const pick = await window.showWarningMessage(message, { modal: true }, yes);

			if (pick !== yes) {
				return;
			}
		}

		const uris = resources.map(r => r.resourceUri);

		if (uris.length > 0) {
			await repository.add(uris);
		}
	}

	@command('git.stageChange')
	async stageChange(uri: Uri, changes: LineChange[], index: number): Promise<void> {
		if (!uri) {
			return;
		}

		const textEditor = window.visibleTextEditors.filter(e => e.document.uri.toString() === uri.toString())[0];

		if (!textEditor) {
			return;
		}

		await this._stageChanges(textEditor, [changes[index]]);

		const firstStagedLine = changes[index].modifiedStartLineNumber;
		textEditor.selections = [new Selection(firstStagedLine, 0, firstStagedLine, 0)];
	}

	@command('git.stageSelectedRanges', { diff: true })
	async stageSelectedChanges(changes: LineChange[]): Promise<void> {
		const textEditor = window.activeTextEditor;

		if (!textEditor) {
			return;
		}

		const modifiedDocument = textEditor.document;
		const selectedLines = toLineRanges(textEditor.selections, modifiedDocument);
		const selectedChanges = changes
			.map(diff => selectedLines.reduce<LineChange | null>((result, range) => result || intersectDiffWithRange(modifiedDocument, diff, range), null))
			.filter(d => !!d) as LineChange[];

		if (!selectedChanges.length) {
			window.showInformationMessage(l10n.t('The selection range does not contain any changes.'));
			return;
		}

		await this._stageChanges(textEditor, selectedChanges);
	}

	@command('git.acceptMerge')
	async acceptMerge(_uri: Uri | unknown): Promise<void> {
		const { activeTab } = window.tabGroups.activeTabGroup;
		if (!activeTab) {
			return;
		}

		if (!(activeTab.input instanceof TabInputTextMerge)) {
			return;
		}

		const uri = activeTab.input.result;

		const repository = this.model.getRepository(uri);
		if (!repository) {
			console.log(`FAILED to complete merge because uri ${uri.toString()} doesn't belong to any repository`);
			return;
		}

		const result = await commands.executeCommand('mergeEditor.acceptMerge') as { successful: boolean };
		if (result.successful) {
			await repository.add([uri]);
			await commands.executeCommand('workbench.view.scm');
		}

		/*
		if (!(uri instanceof Uri)) {
			return;
		}




		// make sure to save the merged document
		const doc = workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
		if (!doc) {
			console.log(`FAILED to complete merge because uri ${uri.toString()} doesn't match a document`);
			return;
		}
		if (doc.isDirty) {
			await doc.save();
		}

		// find the merge editor tabs for the resource in question and close them all
		let didCloseTab = false;
		const mergeEditorTabs = window.tabGroups.all.map(group => group.tabs.filter(tab => tab.input instanceof TabInputTextMerge && tab.input.result.toString() === uri.toString())).flat();
		if (mergeEditorTabs.includes(activeTab)) {
			didCloseTab = await window.tabGroups.close(mergeEditorTabs, true);
		}

		// Only stage if the merge editor has been successfully closed. That means all conflicts have been
		// handled or unhandled conflicts are OK by the user.
		if (didCloseTab) {
			await repository.add([uri]);
			await commands.executeCommand('workbench.view.scm');
		}*/
	}

	@command('git.runGitMerge')
	async runGitMergeNoDiff3(): Promise<void> {
		await this.runGitMerge(false);
	}

	@command('git.runGitMergeDiff3')
	async runGitMergeDiff3(): Promise<void> {
		await this.runGitMerge(true);
	}

	private async runGitMerge(diff3: boolean): Promise<void> {
		const { activeTab } = window.tabGroups.activeTabGroup;
		if (!activeTab) {
			return;
		}

		const input = activeTab.input;
		if (!(input instanceof TabInputTextMerge)) {
			return;
		}

		const result = await this.git.mergeFile({
			basePath: input.base.fsPath,
			input1Path: input.input1.fsPath,
			input2Path: input.input2.fsPath,
			diff3,
		});

		const doc = workspace.textDocuments.find(doc => doc.uri.toString() === input.result.toString());
		if (!doc) {
			return;
		}
		const e = new WorkspaceEdit();

		e.replace(
			input.result,
			new Range(
				new Position(0, 0),
				new Position(doc.lineCount, 0),
			),
			result
		);
		await workspace.applyEdit(e);
	}

	private async _stageChanges(textEditor: TextEditor, changes: LineChange[]): Promise<void> {
		const modifiedDocument = textEditor.document;
		const modifiedUri = modifiedDocument.uri;

		if (modifiedUri.scheme !== 'file') {
			return;
		}

		const originalUri = toGitUri(modifiedUri, '~');
		const originalDocument = await workspace.openTextDocument(originalUri);
		const result = applyLineChanges(originalDocument, modifiedDocument, changes);

		await this.runByRepository(modifiedUri, async (repository, resource) => await repository.stage(resource, result));
	}

	@command('git.revertChange')
	async revertChange(uri: Uri, changes: LineChange[], index: number): Promise<void> {
		if (!uri) {
			return;
		}

		const textEditor = window.visibleTextEditors.filter(e => e.document.uri.toString() === uri.toString())[0];

		if (!textEditor) {
			return;
		}

		await this._revertChanges(textEditor, [...changes.slice(0, index), ...changes.slice(index + 1)]);

		const firstStagedLine = changes[index].modifiedStartLineNumber;
		textEditor.selections = [new Selection(firstStagedLine, 0, firstStagedLine, 0)];
	}

	@command('git.revertSelectedRanges', { diff: true })
	async revertSelectedRanges(changes: LineChange[]): Promise<void> {
		const textEditor = window.activeTextEditor;

		if (!textEditor) {
			return;
		}

		const modifiedDocument = textEditor.document;
		const selections = textEditor.selections;
		const selectedChanges = changes.filter(change => {
			const modifiedRange = getModifiedRange(modifiedDocument, change);
			return selections.every(selection => !selection.intersection(modifiedRange));
		});

		if (selectedChanges.length === changes.length) {
			window.showInformationMessage(l10n.t('The selection range does not contain any changes.'));
			return;
		}

		const selectionsBeforeRevert = textEditor.selections;
		await this._revertChanges(textEditor, selectedChanges);
		textEditor.selections = selectionsBeforeRevert;
	}

	private async _revertChanges(textEditor: TextEditor, changes: LineChange[]): Promise<void> {
		const modifiedDocument = textEditor.document;
		const modifiedUri = modifiedDocument.uri;

		if (modifiedUri.scheme !== 'file') {
			return;
		}

		const originalUri = toGitUri(modifiedUri, '~');
		const originalDocument = await workspace.openTextDocument(originalUri);
		const visibleRangesBeforeRevert = textEditor.visibleRanges;
		const result = applyLineChanges(originalDocument, modifiedDocument, changes);

		const edit = new WorkspaceEdit();
		edit.replace(modifiedUri, new Range(new Position(0, 0), modifiedDocument.lineAt(modifiedDocument.lineCount - 1).range.end), result);
		workspace.applyEdit(edit);

		await modifiedDocument.save();

		textEditor.revealRange(visibleRangesBeforeRevert[0]);
	}

	@command('git.unstage')
	async unstage(...resourceStates: SourceControlResourceState[]): Promise<void> {
		resourceStates = resourceStates.filter(s => !!s);

		if (resourceStates.length === 0 || (resourceStates[0] && !(resourceStates[0].resourceUri instanceof Uri))) {
			const resource = this.getSCMResource();

			if (!resource) {
				return;
			}

			resourceStates = [resource];
		}

		const scmResources = resourceStates
			.filter(s => s instanceof Resource && s.resourceGroupType === ResourceGroupType.Index) as Resource[];

		if (!scmResources.length) {
			return;
		}

		const resources = scmResources.map(r => r.resourceUri);
		await this.runByRepository(resources, async (repository, resources) => repository.revert(resources));
	}

	@command('git.unstageAll', { repository: true })
	async unstageAll(repository: Repository): Promise<void> {
		await repository.revert([]);
	}

	@command('git.unstageSelectedRanges', { diff: true })
	async unstageSelectedRanges(diffs: LineChange[]): Promise<void> {
		const textEditor = window.activeTextEditor;

		if (!textEditor) {
			return;
		}

		const modifiedDocument = textEditor.document;
		const modifiedUri = modifiedDocument.uri;

		if (!isGitUri(modifiedUri)) {
			return;
		}

		const { ref } = fromGitUri(modifiedUri);

		if (ref !== '') {
			return;
		}

		const originalUri = toGitUri(modifiedUri, 'HEAD');
		const originalDocument = await workspace.openTextDocument(originalUri);
		const selectedLines = toLineRanges(textEditor.selections, modifiedDocument);
		const selectedDiffs = diffs
			.map(diff => selectedLines.reduce<LineChange | null>((result, range) => result || intersectDiffWithRange(modifiedDocument, diff, range), null))
			.filter(d => !!d) as LineChange[];

		if (!selectedDiffs.length) {
			window.showInformationMessage(l10n.t('The selection range does not contain any changes.'));
			return;
		}

		const invertedDiffs = selectedDiffs.map(invertLineChange);
		const result = applyLineChanges(modifiedDocument, originalDocument, invertedDiffs);

		await this.runByRepository(modifiedUri, async (repository, resource) => await repository.stage(resource, result));
	}

	@command('git.clean')
	async clean(...resourceStates: SourceControlResourceState[]): Promise<void> {
		// Remove duplicate resources
		const resourceUris = new Set<string>();
		resourceStates = resourceStates.filter(s => {
			if (s === undefined) {
				return false;
			}

			if (resourceUris.has(s.resourceUri.toString())) {
				return false;
			}

			resourceUris.add(s.resourceUri.toString());
			return true;
		});

		if (resourceStates.length === 0 || (resourceStates[0] && !(resourceStates[0].resourceUri instanceof Uri))) {
			const resource = this.getSCMResource();

			if (!resource) {
				return;
			}

			resourceStates = [resource];
		}

		const scmResources = resourceStates.filter(s => s instanceof Resource
			&& (s.resourceGroupType === ResourceGroupType.WorkingTree || s.resourceGroupType === ResourceGroupType.Untracked)) as Resource[];

		if (!scmResources.length) {
			return;
		}

		const untrackedCount = scmResources.reduce((s, r) => s + (r.type === Status.UNTRACKED ? 1 : 0), 0);
		let message: string;
		let yes = l10n.t('Discard Changes');

		if (scmResources.length === 1) {
			if (untrackedCount > 0) {
				message = l10n.t('Are you sure you want to DELETE {0}?\nThis is IRREVERSIBLE!\nThis file will be FOREVER LOST if you proceed.', path.basename(scmResources[0].resourceUri.fsPath));
				yes = l10n.t('Delete file');
			} else {
				if (scmResources[0].type === Status.DELETED) {
					yes = l10n.t('Restore file');
					message = l10n.t('Are you sure you want to restore {0}?', path.basename(scmResources[0].resourceUri.fsPath));
				} else {
					message = l10n.t('Are you sure you want to discard changes in {0}?', path.basename(scmResources[0].resourceUri.fsPath));
				}
			}
		} else {
			if (scmResources.every(resource => resource.type === Status.DELETED)) {
				yes = l10n.t('Restore files');
				message = l10n.t('Are you sure you want to restore {0} files?', scmResources.length);
			} else {
				message = l10n.t('Are you sure you want to discard changes in {0} files?', scmResources.length);
			}

			if (untrackedCount > 0) {
				message = `${message}\n\n${l10n.t('This will DELETE {0} untracked files!\nThis is IRREVERSIBLE!\nThese files will be FOREVER LOST.', untrackedCount)}`;
			}
		}

		const pick = await window.showWarningMessage(message, { modal: true }, yes);

		if (pick !== yes) {
			return;
		}

		const resources = scmResources.map(r => r.resourceUri);
		await this.runByRepository(resources, async (repository, resources) => repository.clean(resources));
	}

	@command('git.cleanAll', { repository: true })
	async cleanAll(repository: Repository): Promise<void> {
		let resources = repository.workingTreeGroup.resourceStates;

		if (resources.length === 0) {
			return;
		}

		const trackedResources = resources.filter(r => r.type !== Status.UNTRACKED && r.type !== Status.IGNORED);
		const untrackedResources = resources.filter(r => r.type === Status.UNTRACKED || r.type === Status.IGNORED);

		if (untrackedResources.length === 0) {
			await this._cleanTrackedChanges(repository, resources);
		} else if (resources.length === 1) {
			await this._cleanUntrackedChange(repository, resources[0]);
		} else if (trackedResources.length === 0) {
			await this._cleanUntrackedChanges(repository, resources);
		} else { // resources.length > 1 && untrackedResources.length > 0 && trackedResources.length > 0
			const untrackedMessage = untrackedResources.length === 1
				? l10n.t('The following untracked file will be DELETED FROM DISK if discarded: {0}.', path.basename(untrackedResources[0].resourceUri.fsPath))
				: l10n.t('There are {0} untracked files which will be DELETED FROM DISK if discarded.', untrackedResources.length);

			const message = l10n.t('{0}\n\nThis is IRREVERSIBLE, your current working set will be FOREVER LOST.', untrackedMessage, resources.length);

			const yesTracked = trackedResources.length === 1
				? l10n.t('Discard 1 Tracked File', trackedResources.length)
				: l10n.t('Discard {0} Tracked Files', trackedResources.length);

			const yesAll = l10n.t('Discard All {0} Files', resources.length);
			const pick = await window.showWarningMessage(message, { modal: true }, yesTracked, yesAll);

			if (pick === yesTracked) {
				resources = trackedResources;
			} else if (pick !== yesAll) {
				return;
			}

			await repository.clean(resources.map(r => r.resourceUri));
		}
	}

	@command('git.cleanAllTracked', { repository: true })
	async cleanAllTracked(repository: Repository): Promise<void> {
		const resources = repository.workingTreeGroup.resourceStates
			.filter(r => r.type !== Status.UNTRACKED && r.type !== Status.IGNORED);

		if (resources.length === 0) {
			return;
		}

		await this._cleanTrackedChanges(repository, resources);
	}

	@command('git.cleanAllUntracked', { repository: true })
	async cleanAllUntracked(repository: Repository): Promise<void> {
		const resources = [...repository.workingTreeGroup.resourceStates, ...repository.untrackedGroup.resourceStates]
			.filter(r => r.type === Status.UNTRACKED || r.type === Status.IGNORED);

		if (resources.length === 0) {
			return;
		}

		if (resources.length === 1) {
			await this._cleanUntrackedChange(repository, resources[0]);
		} else {
			await this._cleanUntrackedChanges(repository, resources);
		}
	}

	private async _cleanTrackedChanges(repository: Repository, resources: Resource[]): Promise<void> {
		const message = resources.length === 1
			? l10n.t('Are you sure you want to discard changes in {0}?', path.basename(resources[0].resourceUri.fsPath))
			: l10n.t('Are you sure you want to discard ALL changes in {0} files?\nThis is IRREVERSIBLE!\nYour current working set will be FOREVER LOST if you proceed.', resources.length);
		const yes = resources.length === 1
			? l10n.t('Discard 1 File')
			: l10n.t('Discard All {0} Files', resources.length);
		const pick = await window.showWarningMessage(message, { modal: true }, yes);

		if (pick !== yes) {
			return;
		}

		await repository.clean(resources.map(r => r.resourceUri));
	}

	private async _cleanUntrackedChange(repository: Repository, resource: Resource): Promise<void> {
		const message = l10n.t('Are you sure you want to DELETE {0}?\nThis is IRREVERSIBLE!\nThis file will be FOREVER LOST if you proceed.', path.basename(resource.resourceUri.fsPath));
		const yes = l10n.t('Delete file');
		const pick = await window.showWarningMessage(message, { modal: true }, yes);

		if (pick !== yes) {
			return;
		}

		await repository.clean([resource.resourceUri]);
	}

	private async _cleanUntrackedChanges(repository: Repository, resources: Resource[]): Promise<void> {
		const message = l10n.t('Are you sure you want to DELETE {0} files?\nThis is IRREVERSIBLE!\nThese files will be FOREVER LOST if you proceed.', resources.length);
		const yes = l10n.t('Delete Files');
		const pick = await window.showWarningMessage(message, { modal: true }, yes);

		if (pick !== yes) {
			return;
		}

		await repository.clean(resources.map(r => r.resourceUri));
	}

	private async smartCommit(
		repository: Repository,
		getCommitMessage: () => Promise<string | undefined>,
		opts: CommitOptions
	): Promise<void> {
		const config = workspace.getConfiguration('git', Uri.file(repository.root));
		let promptToSaveFilesBeforeCommit = config.get<'always' | 'staged' | 'never'>('promptToSaveFilesBeforeCommit');

		// migration
		if (promptToSaveFilesBeforeCommit as any === true) {
			promptToSaveFilesBeforeCommit = 'always';
		} else if (promptToSaveFilesBeforeCommit as any === false) {
			promptToSaveFilesBeforeCommit = 'never';
		}

		const enableSmartCommit = config.get<boolean>('enableSmartCommit') === true;
		const enableCommitSigning = config.get<boolean>('enableCommitSigning') === true;
		let noStagedChanges = repository.indexGroup.resourceStates.length === 0;
		let noUnstagedChanges = repository.workingTreeGroup.resourceStates.length === 0;

		if (promptToSaveFilesBeforeCommit !== 'never') {
			let documents = workspace.textDocuments
				.filter(d => !d.isUntitled && d.isDirty && isDescendant(repository.root, d.uri.fsPath));

			if (promptToSaveFilesBeforeCommit === 'staged' || repository.indexGroup.resourceStates.length > 0) {
				documents = documents
					.filter(d => repository.indexGroup.resourceStates.some(s => pathEquals(s.resourceUri.fsPath, d.uri.fsPath)));
			}

			if (documents.length > 0) {
				const message = documents.length === 1
					? l10n.t('The following file has unsaved changes which won\'t be included in the commit if you proceed: {0}.\n\nWould you like to save it before committing?', path.basename(documents[0].uri.fsPath))
					: l10n.t('There are {0} unsaved files.\n\nWould you like to save them before committing?', documents.length);
				const saveAndCommit = l10n.t('Save All & Commit Changes');
				const commit = l10n.t('Commit Changes');
				const pick = await window.showWarningMessage(message, { modal: true }, saveAndCommit, commit);

				if (pick === saveAndCommit) {
					await Promise.all(documents.map(d => d.save()));

					// After saving the dirty documents, if there are any documents that are part of the
					// index group we have to add them back in order for the saved changes to be committed
					documents = documents
						.filter(d => repository.indexGroup.resourceStates.some(s => pathEquals(s.resourceUri.fsPath, d.uri.fsPath)));
					await repository.add(documents.map(d => d.uri));

					noStagedChanges = repository.indexGroup.resourceStates.length === 0;
					noUnstagedChanges = repository.workingTreeGroup.resourceStates.length === 0;
				} else if (pick !== commit) {
					return; // do not commit on cancel
				}
			}
		}

		// no changes, and the user has not configured to commit all in this case
		if (!noUnstagedChanges && noStagedChanges && !enableSmartCommit && !opts.empty && !opts.all) {
			const suggestSmartCommit = config.get<boolean>('suggestSmartCommit') === true;

			if (!suggestSmartCommit) {
				return;
			}

			// prompt the user if we want to commit all or not
			const message = l10n.t('There are no staged changes to commit.\n\nWould you like to stage all your changes and commit them directly?');
			const yes = l10n.t('Yes');
			const always = l10n.t('Always');
			const never = l10n.t('Never');
			const pick = await window.showWarningMessage(message, { modal: true }, yes, always, never);

			if (pick === always) {
				config.update('enableSmartCommit', true, true);
			} else if (pick === never) {
				config.update('suggestSmartCommit', false, true);
				return;
			} else if (pick !== yes) {
				return; // do not commit on cancel
			}
		}

		if (opts.all === undefined) {
			opts = { ...opts, all: noStagedChanges };
		} else if (!opts.all && noStagedChanges && !opts.empty) {
			opts = { ...opts, all: true };
		}

		// enable signing of commits if configured
		opts.signCommit = enableCommitSigning;

		if (config.get<boolean>('alwaysSignOff')) {
			opts.signoff = true;
		}

		if (config.get<boolean>('useEditorAsCommitInput')) {
			opts.useEditor = true;

			if (config.get<boolean>('verboseCommit')) {
				opts.verbose = true;
			}
		}

		const smartCommitChanges = config.get<'all' | 'tracked'>('smartCommitChanges');

		if (
			(
				// no changes
				(noStagedChanges && noUnstagedChanges)
				// or no staged changes and not `all`
				|| (!opts.all && noStagedChanges)
				// no staged changes and no tracked unstaged changes
				|| (noStagedChanges && smartCommitChanges === 'tracked' && repository.workingTreeGroup.resourceStates.every(r => r.type === Status.UNTRACKED))
			)
			// amend allows changing only the commit message
			&& !opts.amend
			&& !opts.empty
			// rebase not in progress
			&& repository.rebaseCommit === undefined
		) {
			const commitAnyway = l10n.t('Create Empty Commit');
			const answer = await window.showInformationMessage(l10n.t('There are no changes to commit.'), commitAnyway);

			if (answer !== commitAnyway) {
				return;
			}

			opts.empty = true;
		}

		if (opts.noVerify) {
			if (!config.get<boolean>('allowNoVerifyCommit')) {
				await window.showErrorMessage(l10n.t('Commits without verification are not allowed, please enable them with the "git.allowNoVerifyCommit" setting.'));
				return;
			}

			if (config.get<boolean>('confirmNoVerifyCommit')) {
				const message = l10n.t('You are about to commit your changes without verification, this skips pre-commit hooks and can be undesirable.\n\nAre you sure to continue?');
				const yes = l10n.t('OK');
				const neverAgain = l10n.t('OK, Don\'t Ask Again');
				const pick = await window.showWarningMessage(message, { modal: true }, yes, neverAgain);

				if (pick === neverAgain) {
					config.update('confirmNoVerifyCommit', false, true);
				} else if (pick !== yes) {
					return;
				}
			}
		}

		const message = await getCommitMessage();

		if (!message && !opts.amend && !opts.useEditor) {
			return;
		}

		if (opts.all && smartCommitChanges === 'tracked') {
			opts.all = 'tracked';
		}

		if (opts.all && config.get<'mixed' | 'separate' | 'hidden'>('untrackedChanges') !== 'mixed') {
			opts.all = 'tracked';
		}

		// Branch protection
		const branchProtectionPrompt = config.get<'alwaysCommit' | 'alwaysCommitToNewBranch' | 'alwaysPrompt'>('branchProtectionPrompt')!;
		if (repository.isBranchProtected() && (branchProtectionPrompt === 'alwaysPrompt' || branchProtectionPrompt === 'alwaysCommitToNewBranch')) {
			const commitToNewBranch = l10n.t('Commit to a New Branch');

			let pick: string | undefined = commitToNewBranch;

			if (branchProtectionPrompt === 'alwaysPrompt') {
				const message = l10n.t('You are trying to commit to a protected branch and you might not have permission to push your commits to the remote.\n\nHow would you like to proceed?');
				const commit = l10n.t('Commit Anyway');

				pick = await window.showWarningMessage(message, { modal: true }, commitToNewBranch, commit);
			}

			if (!pick) {
				return;
			} else if (pick === commitToNewBranch) {
				const branchName = await this.promptForBranchName(repository);

				if (!branchName) {
					return;
				}

				await repository.branch(branchName, true);
			}
		}

		await repository.commit(message, opts);
	}

	private async commitWithAnyInput(repository: Repository, opts: CommitOptions): Promise<void> {
		const message = repository.inputBox.value;
		const root = Uri.file(repository.root);
		const config = workspace.getConfiguration('git', root);

		const getCommitMessage = async () => {
			let _message: string | undefined = message;

			if (!_message && !config.get<boolean>('useEditorAsCommitInput')) {
				const value: string | undefined = undefined;

				if (opts && opts.amend && repository.HEAD && repository.HEAD.commit) {
					return undefined;
				}

				const branchName = repository.headShortName;
				let placeHolder: string;

				if (branchName) {
					placeHolder = l10n.t('Message (commit on "{0}")', branchName);
				} else {
					placeHolder = l10n.t('Commit message');
				}

				_message = await window.showInputBox({
					value,
					placeHolder,
					prompt: l10n.t('Please provide a commit message'),
					ignoreFocusOut: true
				});
			}

			return _message;
		};

		await this.smartCommit(repository, getCommitMessage, opts);
	}

	@command('git.commit', { repository: true })
	async commit(repository: Repository, postCommitCommand?: string | null): Promise<void> {
		await this.commitWithAnyInput(repository, { postCommitCommand });
	}

	@command('git.commitAmend', { repository: true })
	async commitAmend(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { amend: true });
	}

	@command('git.commitSigned', { repository: true })
	async commitSigned(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { signoff: true });
	}

	@command('git.commitStaged', { repository: true })
	async commitStaged(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: false });
	}

	@command('git.commitStagedSigned', { repository: true })
	async commitStagedSigned(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: false, signoff: true });
	}

	@command('git.commitStagedAmend', { repository: true })
	async commitStagedAmend(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: false, amend: true });
	}

	@command('git.commitAll', { repository: true })
	async commitAll(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: true });
	}

	@command('git.commitAllSigned', { repository: true })
	async commitAllSigned(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: true, signoff: true });
	}

	@command('git.commitAllAmend', { repository: true })
	async commitAllAmend(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: true, amend: true });
	}

	@command('git.commitMessageAccept')
	async commitMessageAccept(arg?: Uri): Promise<void> {
		if (!arg && !window.activeTextEditor) { return; }
		arg ??= window.activeTextEditor!.document.uri;

		// Close the tab
		this._closeEditorTab(arg);
	}

	@command('git.commitMessageDiscard')
	async commitMessageDiscard(arg?: Uri): Promise<void> {
		if (!arg && !window.activeTextEditor) { return; }
		arg ??= window.activeTextEditor!.document.uri;

		// Clear the contents of the editor
		const editors = window.visibleTextEditors
			.filter(e => e.document.languageId === 'git-commit' && e.document.uri.toString() === arg!.toString());

		if (editors.length !== 1) { return; }

		const commitMsgEditor = editors[0];
		const commitMsgDocument = commitMsgEditor.document;

		const editResult = await commitMsgEditor.edit(builder => {
			const firstLine = commitMsgDocument.lineAt(0);
			const lastLine = commitMsgDocument.lineAt(commitMsgDocument.lineCount - 1);

			builder.delete(new Range(firstLine.range.start, lastLine.range.end));
		});

		if (!editResult) { return; }

		// Save the document
		const saveResult = await commitMsgDocument.save();
		if (!saveResult) { return; }

		// Close the tab
		this._closeEditorTab(arg);
	}

	private _closeEditorTab(uri: Uri): void {
		const tabToClose = window.tabGroups.all.map(g => g.tabs).flat()
			.filter(t => t.input instanceof TabInputText && t.input.uri.toString() === uri.toString());

		window.tabGroups.close(tabToClose);
	}

	private async _commitEmpty(repository: Repository, noVerify?: boolean): Promise<void> {
		const root = Uri.file(repository.root);
		const config = workspace.getConfiguration('git', root);
		const shouldPrompt = config.get<boolean>('confirmEmptyCommits') === true;

		if (shouldPrompt) {
			const message = l10n.t('Are you sure you want to create an empty commit?');
			const yes = l10n.t('Yes');
			const neverAgain = l10n.t('Yes, Don\'t Show Again');
			const pick = await window.showWarningMessage(message, { modal: true }, yes, neverAgain);

			if (pick === neverAgain) {
				await config.update('confirmEmptyCommits', false, true);
			} else if (pick !== yes) {
				return;
			}
		}

		await this.commitWithAnyInput(repository, { empty: true, noVerify });
	}

	@command('git.commitEmpty', { repository: true })
	async commitEmpty(repository: Repository): Promise<void> {
		await this._commitEmpty(repository);
	}

	@command('git.commitNoVerify', { repository: true })
	async commitNoVerify(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { noVerify: true });
	}

	@command('git.commitStagedNoVerify', { repository: true })
	async commitStagedNoVerify(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: false, noVerify: true });
	}

	@command('git.commitStagedSignedNoVerify', { repository: true })
	async commitStagedSignedNoVerify(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: false, signoff: true, noVerify: true });
	}

	@command('git.commitAmendNoVerify', { repository: true })
	async commitAmendNoVerify(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { amend: true, noVerify: true });
	}

	@command('git.commitSignedNoVerify', { repository: true })
	async commitSignedNoVerify(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { signoff: true, noVerify: true });
	}

	@command('git.commitStagedAmendNoVerify', { repository: true })
	async commitStagedAmendNoVerify(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: false, amend: true, noVerify: true });
	}

	@command('git.commitAllNoVerify', { repository: true })
	async commitAllNoVerify(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: true, noVerify: true });
	}

	@command('git.commitAllSignedNoVerify', { repository: true })
	async commitAllSignedNoVerify(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: true, signoff: true, noVerify: true });
	}

	@command('git.commitAllAmendNoVerify', { repository: true })
	async commitAllAmendNoVerify(repository: Repository): Promise<void> {
		await this.commitWithAnyInput(repository, { all: true, amend: true, noVerify: true });
	}

	@command('git.commitEmptyNoVerify', { repository: true })
	async commitEmptyNoVerify(repository: Repository): Promise<void> {
		await this._commitEmpty(repository, true);
	}

	@command('git.restoreCommitTemplate', { repository: true })
	async restoreCommitTemplate(repository: Repository): Promise<void> {
		repository.inputBox.value = await repository.getCommitTemplate();
	}

	@command('git.undoCommit', { repository: true })
	async undoCommit(repository: Repository): Promise<void> {
		const HEAD = repository.HEAD;

		if (!HEAD || !HEAD.commit) {
			window.showWarningMessage(l10n.t('Can\'t undo because HEAD doesn\'t point to any commit.'));
			return;
		}

		const commit = await repository.getCommit('HEAD');

		if (commit.parents.length > 1) {
			const yes = l10n.t('Undo merge commit');
			const result = await window.showWarningMessage(l10n.t('The last commit was a merge commit. Are you sure you want to undo it?'), { modal: true }, yes);

			if (result !== yes) {
				return;
			}
		}

		if (commit.parents.length > 0) {
			await repository.reset('HEAD~');
		} else {
			await repository.deleteRef('HEAD');
			await this.unstageAll(repository);
		}

		repository.inputBox.value = commit.message;
	}

	@command('git.checkout', { repository: true })
	async checkout(repository: Repository, treeish?: string): Promise<boolean> {
		return this._checkout(repository, { treeish });
	}

	@command('git.checkoutDetached', { repository: true })
	async checkoutDetached(repository: Repository, treeish?: string): Promise<boolean> {
		return this._checkout(repository, { detached: true, treeish });
	}

	private async _checkout(repository: Repository, opts?: { detached?: boolean; treeish?: string }): Promise<boolean> {
		if (typeof opts?.treeish === 'string') {
			await repository.checkout(opts?.treeish, opts);
			return true;
		}

		const createBranch = new CreateBranchItem();
		const createBranchFrom = new CreateBranchFromItem();
		const checkoutDetached = new CheckoutDetachedItem();
		const picks: QuickPickItem[] = [];

		if (!opts?.detached) {
			picks.push(createBranch, createBranchFrom, checkoutDetached, { label: '', kind: QuickPickItemKind.Separator });
		}

		const quickpick = window.createQuickPick();
		quickpick.busy = true;
		quickpick.placeholder = opts?.detached
			? l10n.t('Select a branch to checkout in detached mode')
			: l10n.t('Select a branch or tag to checkout');

		quickpick.show();

		picks.push(... await createCheckoutItems(repository, opts?.detached));
		quickpick.items = picks;
		quickpick.busy = false;

		const choice = await new Promise<QuickPickItem | undefined>(c => {
			quickpick.onDidAccept(() => c(quickpick.activeItems[0]));
			quickpick.onDidTriggerItemButton((e) => {
				quickpick.hide();
				const button = e.button as QuickInputButton & { actual: RemoteSourceAction };
				const item = e.item as CheckoutItem;
				if (button.actual && item.refName) {
					button.actual.run(item.refRemote ? item.refName.substring(item.refRemote.length + 1) : item.refName);
				}
			});
		});
		quickpick.hide();

		if (!choice) {
			return false;
		}

		if (choice === createBranch) {
			await this._branch(repository, quickpick.value);
		} else if (choice === createBranchFrom) {
			await this._branch(repository, quickpick.value, true);
		} else if (choice === checkoutDetached) {
			return this._checkout(repository, { detached: true });
		} else {
			const item = choice as CheckoutItem;

			try {
				await item.run(opts);
			} catch (err) {
				if (err.gitErrorCode !== GitErrorCodes.DirtyWorkTree) {
					throw err;
				}

				const stash = l10n.t('Stash & Checkout');
				const migrate = l10n.t('Migrate Changes');
				const force = l10n.t('Force Checkout');
				const choice = await window.showWarningMessage(l10n.t('Your local changes would be overwritten by checkout.'), { modal: true }, stash, migrate, force);

				if (choice === force) {
					await this.cleanAll(repository);
					await item.run(opts);
				} else if (choice === stash || choice === migrate) {
					if (await this._stash(repository)) {
						await item.run(opts);

						if (choice === migrate) {
							await this.stashPopLatest(repository);
						}
					}
				}
			}
		}

		return true;
	}

	@command('git.branch', { repository: true })
	async branch(repository: Repository): Promise<void> {
		await this._branch(repository);
	}

	@command('git.branchFrom', { repository: true })
	async branchFrom(repository: Repository): Promise<void> {
		await this._branch(repository, undefined, true);
	}

	private async generateRandomBranchName(repository: Repository, separator: string): Promise<string> {
		const config = workspace.getConfiguration('git');
		const branchRandomNameDictionary = config.get<string[]>('branchRandomName.dictionary')!;

		const dictionaries: string[][] = [];
		for (const dictionary of branchRandomNameDictionary) {
			if (dictionary.toLowerCase() === 'adjectives') {
				dictionaries.push(adjectives);
			}
			if (dictionary.toLowerCase() === 'animals') {
				dictionaries.push(animals);
			}
			if (dictionary.toLowerCase() === 'colors') {
				dictionaries.push(colors);
			}
			if (dictionary.toLowerCase() === 'numbers') {
				dictionaries.push(NumberDictionary.generate({ length: 3 }));
			}
		}

		if (dictionaries.length === 0) {
			return '';
		}

		// 5 attempts to generate a random branch name
		for (let index = 0; index < 5; index++) {
			const randomName = uniqueNamesGenerator({
				dictionaries,
				length: dictionaries.length,
				separator
			});

			// Check for local ref conflict
			const refs = await repository.getRefs({ pattern: `refs/heads/${randomName}` });
			if (refs.length === 0) {
				return randomName;
			}
		}

		return '';
	}

	private async promptForBranchName(repository: Repository, defaultName?: string, initialValue?: string): Promise<string> {
		const config = workspace.getConfiguration('git');
		const branchPrefix = config.get<string>('branchPrefix')!;
		const branchWhitespaceChar = config.get<string>('branchWhitespaceChar')!;
		const branchValidationRegex = config.get<string>('branchValidationRegex')!;

		let rawBranchName = defaultName;

		if (!rawBranchName) {
			// Branch name
			if (!initialValue) {
				const branchRandomNameEnabled = config.get<boolean>('branchRandomName.enable', false);
				const branchName = branchRandomNameEnabled ? await this.generateRandomBranchName(repository, branchWhitespaceChar) : '';

				initialValue = `${branchPrefix}${branchName}`;
			}

			// Branch name selection
			const initialValueSelection: [number, number] | undefined =
				initialValue.startsWith(branchPrefix) ? [branchPrefix.length, initialValue.length] : undefined;

			rawBranchName = await window.showInputBox({
				placeHolder: l10n.t('Branch name'),
				prompt: l10n.t('Please provide a new branch name'),
				value: initialValue,
				valueSelection: initialValueSelection,
				ignoreFocusOut: true,
				validateInput: (name: string) => {
					const validateName = new RegExp(branchValidationRegex);
					const sanitizedName = sanitizeBranchName(name, branchWhitespaceChar);
					if (validateName.test(sanitizedName)) {
						// If the sanitized name that we will use is different than what is
						// in the input box, show an info message to the user informing them
						// the branch name that will be used.
						return name === sanitizedName
							? null
							: {
								message: l10n.t('The new branch will be "{0}"', sanitizedName),
								severity: InputBoxValidationSeverity.Info
							};
					}

					return l10n.t('Branch name needs to match regex: {0}', branchValidationRegex);
				}
			});
		}

		return sanitizeBranchName(rawBranchName || '', branchWhitespaceChar);
	}

	private async _branch(repository: Repository, defaultName?: string, from = false): Promise<void> {
		let target = 'HEAD';

		if (from) {
			const getRefPicks = async () => {
				return [new HEADItem(repository), ...await createCheckoutItems(repository)];
			};

			const placeHolder = l10n.t('Select a ref to create the branch from');
			const choice = await window.showQuickPick(getRefPicks(), { placeHolder });

			if (!choice) {
				return;
			}

			if (choice.refName) {
				target = choice.refName;
			}
		}

		const branchName = await this.promptForBranchName(repository, defaultName);

		if (!branchName) {
			return;
		}

		await repository.branch(branchName, true, target);
	}

	@command('git.deleteBranch', { repository: true })
	async deleteBranch(repository: Repository, name: string, force?: boolean): Promise<void> {
		let run: (force?: boolean) => Promise<void>;
		if (typeof name === 'string') {
			run = force => repository.deleteBranch(name, force);
		} else {
			const getBranchPicks = async () => {
				const refs = await repository.getRefs({ pattern: 'refs/heads' });
				const currentHead = repository.HEAD && repository.HEAD.name;

				return refs.filter(ref => ref.name !== currentHead).map(ref => new BranchDeleteItem(ref));
			};

			const placeHolder = l10n.t('Select a branch to delete');
			const choice = await window.showQuickPick<BranchDeleteItem>(getBranchPicks(), { placeHolder });

			if (!choice || !choice.branchName) {
				return;
			}
			name = choice.branchName;
			run = force => choice.run(repository, force);
		}

		try {
			await run(force);
		} catch (err) {
			if (err.gitErrorCode !== GitErrorCodes.BranchNotFullyMerged) {
				throw err;
			}

			const message = l10n.t('The branch "{0}" is not fully merged. Delete anyway?', name);
			const yes = l10n.t('Delete Branch');
			const pick = await window.showWarningMessage(message, { modal: true }, yes);

			if (pick === yes) {
				await run(true);
			}
		}
	}

	@command('git.renameBranch', { repository: true })
	async renameBranch(repository: Repository): Promise<void> {
		const currentBranchName = repository.HEAD && repository.HEAD.name;
		const branchName = await this.promptForBranchName(repository, undefined, currentBranchName);

		if (!branchName) {
			return;
		}

		try {
			await repository.renameBranch(branchName);
		} catch (err) {
			switch (err.gitErrorCode) {
				case GitErrorCodes.InvalidBranchName:
					window.showErrorMessage(l10n.t('Invalid branch name'));
					return;
				case GitErrorCodes.BranchAlreadyExists:
					window.showErrorMessage(l10n.t('A branch named "{0}" already exists', branchName));
					return;
				default:
					throw err;
			}
		}
	}

	@command('git.merge', { repository: true })
	async merge(repository: Repository): Promise<void> {
		const config = workspace.getConfiguration('git');
		const checkoutType = config.get<string | string[]>('checkoutType');
		const includeRemotes = checkoutType === 'all' || checkoutType === 'remote' || checkoutType?.includes('remote');

		const getBranchPicks = async (): Promise<MergeItem[]> => {
			const refs = await repository.getRefs();

			const heads = refs.filter(ref => ref.type === RefType.Head)
				.filter(ref => ref.name || ref.commit)
				.map(ref => new MergeItem(ref as Branch));

			const remoteHeads = (includeRemotes ? refs.filter(ref => ref.type === RefType.RemoteHead) : [])
				.filter(ref => ref.name || ref.commit)
				.map(ref => new MergeItem(ref as Branch));

			return [...heads, ...remoteHeads];
		};

		const placeHolder = l10n.t('Select a branch to merge from');
		const choice = await window.showQuickPick<MergeItem>(getBranchPicks(), { placeHolder });

		if (!choice) {
			return;
		}

		await choice.run(repository);
	}

	@command('git.mergeAbort', { repository: true })
	async abortMerge(repository: Repository): Promise<void> {
		await repository.mergeAbort();
	}

	@command('git.rebase', { repository: true })
	async rebase(repository: Repository): Promise<void> {
		const config = workspace.getConfiguration('git');
		const checkoutType = config.get<string | string[]>('checkoutType');
		const includeRemotes = checkoutType === 'all' || checkoutType === 'remote' || checkoutType?.includes('remote');

		const getBranchPicks = async () => {
			const refs = await repository.getRefs();

			const heads = refs.filter(ref => ref.type === RefType.Head)
				.filter(ref => ref.name !== repository.HEAD?.name)
				.filter(ref => ref.name || ref.commit);

			const remoteHeads = (includeRemotes ? refs.filter(ref => ref.type === RefType.RemoteHead) : [])
				.filter(ref => ref.name || ref.commit);

			const picks = [...heads, ...remoteHeads].map(ref => new RebaseItem(ref));

			// set upstream branch as first
			if (repository.HEAD?.upstream) {
				const upstreamName = `${repository.HEAD?.upstream.remote}/${repository.HEAD?.upstream.name}`;
				const index = picks.findIndex(e => e.ref.name === upstreamName);

				if (index > -1) {
					const [ref] = picks.splice(index, 1);
					ref.description = '(upstream)';
					picks.unshift(ref);
				}
			}

			return picks;
		};

		const placeHolder = l10n.t('Select a branch to rebase onto');
		const choice = await window.showQuickPick<RebaseItem>(getBranchPicks(), { placeHolder });

		if (!choice) {
			return;
		}

		await choice.run(repository);
	}

	@command('git.createTag', { repository: true })
	async createTag(repository: Repository): Promise<void> {
		const inputTagName = await window.showInputBox({
			placeHolder: l10n.t('Tag name'),
			prompt: l10n.t('Please provide a tag name'),
			ignoreFocusOut: true
		});

		if (!inputTagName) {
			return;
		}

		const inputMessage = await window.showInputBox({
			placeHolder: l10n.t('Message'),
			prompt: l10n.t('Please provide a message to annotate the tag'),
			ignoreFocusOut: true
		});

		const name = inputTagName.replace(/^\.|\/\.|\.\.|~|\^|:|\/$|\.lock$|\.lock\/|\\|\*|\s|^\s*$|\.$/g, '-');
		await repository.tag(name, inputMessage);
	}

	@command('git.deleteTag', { repository: true })
	async deleteTag(repository: Repository): Promise<void> {
		const tagPicks = async (): Promise<TagItem[] | QuickPickItem[]> => {
			const remoteTags = await repository.getRefs({ pattern: 'refs/tags' });
			return remoteTags.length === 0 ? [{ label: l10n.t('$(info) This repository has no tags.') }] : remoteTags.map(ref => new TagItem(ref));
		};

		const placeHolder = l10n.t('Select a tag to delete');
		const choice = await window.showQuickPick<TagItem | QuickPickItem>(tagPicks(), { placeHolder });

		if (choice && choice instanceof TagItem && choice.ref.name) {
			await repository.deleteTag(choice.ref.name);
		}
	}

	@command('git.deleteRemoteTag', { repository: true })
	async deleteRemoteTag(repository: Repository): Promise<void> {
		const remotePicks = repository.remotes
			.filter(r => r.pushUrl !== undefined)
			.map(r => new RemoteItem(repository, r));

		if (remotePicks.length === 0) {
			window.showErrorMessage(l10n.t("Your repository has no remotes configured to push to."));
			return;
		}

		let remoteName = remotePicks[0].remoteName;
		if (remotePicks.length > 1) {
			const remotePickPlaceholder = l10n.t('Select a remote to delete a tag from');
			const remotePick = await window.showQuickPick(remotePicks, { placeHolder: remotePickPlaceholder });

			if (!remotePick) {
				return;
			}

			remoteName = remotePick.remoteName;
		}

		const remoteTagPicks = async (): Promise<TagItem[] | QuickPickItem[]> => {
			const remoteTagsRaw = await repository.getRemoteRefs(remoteName, { tags: true });

			// Deduplicate annotated and lightweight tags
			const remoteTagNames = new Set<string>();
			const remoteTags: Ref[] = [];

			for (const tag of remoteTagsRaw) {
				const tagName = (tag.name ?? '').replace(/\^{}$/, '');
				if (!remoteTagNames.has(tagName)) {
					remoteTags.push({ ...tag, name: tagName });
					remoteTagNames.add(tagName);
				}
			}

			return remoteTags.length === 0 ? [{ label: l10n.t('$(info) Remote "{0}" has no tags.', remoteName) }] : remoteTags.map(ref => new TagItem(ref));
		};

		const tagPickPlaceholder = l10n.t('Select a tag to delete');
		const remoteTagPick = await window.showQuickPick<TagItem | QuickPickItem>(remoteTagPicks(), { placeHolder: tagPickPlaceholder });

		if (remoteTagPick && remoteTagPick instanceof TagItem && remoteTagPick.ref.name) {
			await repository.deleteRemoteTag(remoteName, remoteTagPick.ref.name);
		}
	}

	@command('git.fetch', { repository: true })
	async fetch(repository: Repository): Promise<void> {
		if (repository.remotes.length === 0) {
			window.showWarningMessage(l10n.t('This repository has no remotes configured to fetch from.'));
			return;
		}

		if (repository.remotes.length === 1) {
			await repository.fetchDefault();
			return;
		}

		const remoteItems: RemoteItem[] = repository.remotes.map(r => new RemoteItem(repository, r));

		if (repository.HEAD?.upstream?.remote) {
			// Move default remote to the top
			const defaultRemoteIndex = remoteItems
				.findIndex(r => r.remoteName === repository.HEAD!.upstream!.remote);

			if (defaultRemoteIndex !== -1) {
				remoteItems.splice(0, 0, ...remoteItems.splice(defaultRemoteIndex, 1));
			}
		}

		const quickpick = window.createQuickPick();
		quickpick.placeholder = l10n.t('Select a remote to fetch');
		quickpick.canSelectMany = false;
		quickpick.items = [...remoteItems, { label: '', kind: QuickPickItemKind.Separator }, new FetchAllRemotesItem(repository)];

		quickpick.show();
		const remoteItem = await new Promise<RemoteItem | FetchAllRemotesItem | undefined>(resolve => {
			quickpick.onDidAccept(() => resolve(quickpick.activeItems[0] as RemoteItem | FetchAllRemotesItem));
			quickpick.onDidHide(() => resolve(undefined));
		});
		quickpick.hide();

		if (!remoteItem) {
			return;
		}

		await remoteItem.run();
	}

	@command('git.fetchPrune', { repository: true })
	async fetchPrune(repository: Repository): Promise<void> {
		if (repository.remotes.length === 0) {
			window.showWarningMessage(l10n.t('This repository has no remotes configured to fetch from.'));
			return;
		}

		await repository.fetchPrune();
	}


	@command('git.fetchAll', { repository: true })
	async fetchAll(repository: Repository): Promise<void> {
		if (repository.remotes.length === 0) {
			window.showWarningMessage(l10n.t('This repository has no remotes configured to fetch from.'));
			return;
		}

		await repository.fetchAll();
	}

	@command('git.pullFrom', { repository: true })
	async pullFrom(repository: Repository): Promise<void> {
		const remotes = repository.remotes;

		if (remotes.length === 0) {
			window.showWarningMessage(l10n.t('Your repository has no remotes configured to pull from.'));
			return;
		}

		let remoteName = remotes[0].name;
		if (remotes.length > 1) {
			const remotePicks = remotes.filter(r => r.fetchUrl !== undefined).map(r => ({ label: r.name, description: r.fetchUrl! }));
			const placeHolder = l10n.t('Pick a remote to pull the branch from');
			const remotePick = await window.showQuickPick(remotePicks, { placeHolder });

			if (!remotePick) {
				return;
			}

			remoteName = remotePick.label;
		}

		const getBranchPicks = async (): Promise<QuickPickItem[]> => {
			const remoteRefs = await repository.getRefs();
			const remoteRefsFiltered = remoteRefs.filter(r => (r.remote === remoteName));
			return remoteRefsFiltered.map(r => ({ label: r.name! }));
		};

		const branchPlaceHolder = l10n.t('Pick a branch to pull from');
		const branchPick = await window.showQuickPick(getBranchPicks(), { placeHolder: branchPlaceHolder });

		if (!branchPick) {
			return;
		}

		const remoteCharCnt = remoteName.length;
		await repository.pullFrom(false, remoteName, branchPick.label.slice(remoteCharCnt + 1));
	}

	@command('git.pull', { repository: true })
	async pull(repository: Repository): Promise<void> {
		const remotes = repository.remotes;

		if (remotes.length === 0) {
			window.showWarningMessage(l10n.t('Your repository has no remotes configured to pull from.'));
			return;
		}

		await repository.pull(repository.HEAD);
	}

	@command('git.pullRebase', { repository: true })
	async pullRebase(repository: Repository): Promise<void> {
		const remotes = repository.remotes;

		if (remotes.length === 0) {
			window.showWarningMessage(l10n.t('Your repository has no remotes configured to pull from.'));
			return;
		}

		await repository.pullWithRebase(repository.HEAD);
	}

	private async _push(repository: Repository, pushOptions: PushOptions) {
		const remotes = repository.remotes;

		if (remotes.length === 0) {
			if (pushOptions.silent) {
				return;
			}

			const addRemote = l10n.t('Add Remote');
			const result = await window.showWarningMessage(l10n.t('Your repository has no remotes configured to push to.'), addRemote);

			if (result === addRemote) {
				await this.addRemote(repository);
			}

			return;
		}

		const config = workspace.getConfiguration('git', Uri.file(repository.root));
		let forcePushMode: ForcePushMode | undefined = undefined;

		if (pushOptions.forcePush) {
			if (!config.get<boolean>('allowForcePush')) {
				await window.showErrorMessage(l10n.t('Force push is not allowed, please enable it with the "git.allowForcePush" setting.'));
				return;
			}

			forcePushMode = config.get<boolean>('useForcePushWithLease') === true ? ForcePushMode.ForceWithLease : ForcePushMode.Force;

			if (config.get<boolean>('confirmForcePush')) {
				const message = l10n.t('You are about to force push your changes, this can be destructive and could inadvertently overwrite changes made by others.\n\nAre you sure to continue?');
				const yes = l10n.t('OK');
				const neverAgain = l10n.t('OK, Don\'t Ask Again');
				const pick = await window.showWarningMessage(message, { modal: true }, yes, neverAgain);

				if (pick === neverAgain) {
					config.update('confirmForcePush', false, true);
				} else if (pick !== yes) {
					return;
				}
			}
		}

		if (pushOptions.pushType === PushType.PushFollowTags) {
			await repository.pushFollowTags(undefined, forcePushMode);
			return;
		}

		if (pushOptions.pushType === PushType.PushTags) {
			await repository.pushTags(undefined, forcePushMode);
		}

		if (!repository.HEAD || !repository.HEAD.name) {
			if (!pushOptions.silent) {
				window.showWarningMessage(l10n.t('Please check out a branch to push to a remote.'));
			}
			return;
		}

		if (pushOptions.pushType === PushType.Push) {
			try {
				await repository.push(repository.HEAD, forcePushMode);
			} catch (err) {
				if (err.gitErrorCode !== GitErrorCodes.NoUpstreamBranch) {
					throw err;
				}

				if (pushOptions.silent) {
					return;
				}

				if (this.globalState.get<boolean>('confirmBranchPublish', true)) {
					const branchName = repository.HEAD.name;
					const message = l10n.t('The branch "{0}" has no remote branch. Would you like to publish this branch?', branchName);
					const yes = l10n.t('OK');
					const neverAgain = l10n.t('OK, Don\'t Ask Again');
					const pick = await window.showWarningMessage(message, { modal: true }, yes, neverAgain);

					if (pick === yes || pick === neverAgain) {
						if (pick === neverAgain) {
							this.globalState.update('confirmBranchPublish', false);
						}
						await this.publish(repository);
					}
				} else {
					await this.publish(repository);
				}
			}
		} else {
			const branchName = repository.HEAD.name;
			if (!pushOptions.pushTo?.remote) {
				const addRemote = new AddRemoteItem(this);
				const picks = [...remotes.filter(r => r.pushUrl !== undefined).map(r => ({ label: r.name, description: r.pushUrl })), addRemote];
				const placeHolder = l10n.t('Pick a remote to publish the branch "{0}" to:', branchName);
				const choice = await window.showQuickPick(picks, { placeHolder });

				if (!choice) {
					return;
				}

				if (choice === addRemote) {
					const newRemote = await this.addRemote(repository);

					if (newRemote) {
						await repository.pushTo(newRemote, branchName, undefined, forcePushMode);
					}
				} else {
					await repository.pushTo(choice.label, branchName, undefined, forcePushMode);
				}
			} else {
				await repository.pushTo(pushOptions.pushTo.remote, pushOptions.pushTo.refspec || branchName, pushOptions.pushTo.setUpstream, forcePushMode);
			}
		}
	}

	@command('git.push', { repository: true })
	async push(repository: Repository): Promise<void> {
		await this._push(repository, { pushType: PushType.Push });
	}

	@command('git.pushForce', { repository: true })
	async pushForce(repository: Repository): Promise<void> {
		await this._push(repository, { pushType: PushType.Push, forcePush: true });
	}

	@command('git.pushWithTags', { repository: true })
	async pushFollowTags(repository: Repository): Promise<void> {
		await this._push(repository, { pushType: PushType.PushFollowTags });
	}

	@command('git.pushWithTagsForce', { repository: true })
	async pushFollowTagsForce(repository: Repository): Promise<void> {
		await this._push(repository, { pushType: PushType.PushFollowTags, forcePush: true });
	}

	@command('git.cherryPick', { repository: true })
	async cherryPick(repository: Repository): Promise<void> {
		const hash = await window.showInputBox({
			placeHolder: l10n.t('Commit Hash'),
			prompt: l10n.t('Please provide the commit hash'),
			ignoreFocusOut: true
		});

		if (!hash) {
			return;
		}

		await repository.cherryPick(hash);
	}

	@command('git.pushTo', { repository: true })
	async pushTo(repository: Repository, remote?: string, refspec?: string, setUpstream?: boolean): Promise<void> {
		await this._push(repository, { pushType: PushType.PushTo, pushTo: { remote: remote, refspec: refspec, setUpstream: setUpstream } });
	}

	@command('git.pushToForce', { repository: true })
	async pushToForce(repository: Repository, remote?: string, refspec?: string, setUpstream?: boolean): Promise<void> {
		await this._push(repository, { pushType: PushType.PushTo, pushTo: { remote: remote, refspec: refspec, setUpstream: setUpstream }, forcePush: true });
	}

	@command('git.pushTags', { repository: true })
	async pushTags(repository: Repository): Promise<void> {
		await this._push(repository, { pushType: PushType.PushTags });
	}

	@command('git.addRemote', { repository: true })
	async addRemote(repository: Repository): Promise<string | undefined> {
		const url = await pickRemoteSource({
			providerLabel: provider => l10n.t('Add remote from {0}', provider.name),
			urlLabel: l10n.t('Add remote from URL')
		});

		if (!url) {
			return;
		}

		const resultName = await window.showInputBox({
			placeHolder: l10n.t('Remote name'),
			prompt: l10n.t('Please provide a remote name'),
			ignoreFocusOut: true,
			validateInput: (name: string) => {
				if (!sanitizeRemoteName(name)) {
					return l10n.t('Remote name format invalid');
				} else if (repository.remotes.find(r => r.name === name)) {
					return l10n.t('Remote "{0}" already exists.', name);
				}

				return null;
			}
		});

		const name = sanitizeRemoteName(resultName || '');

		if (!name) {
			return;
		}

		await repository.addRemote(name, url.trim());
		await repository.fetch({ remote: name });
		return name;
	}

	@command('git.removeRemote', { repository: true })
	async removeRemote(repository: Repository): Promise<void> {
		const remotes = repository.remotes;

		if (remotes.length === 0) {
			window.showErrorMessage(l10n.t('Your repository has no remotes.'));
			return;
		}

		const picks: RemoteItem[] = repository.remotes.map(r => new RemoteItem(repository, r));
		const placeHolder = l10n.t('Pick a remote to remove');

		const remote = await window.showQuickPick(picks, { placeHolder });

		if (!remote) {
			return;
		}

		await repository.removeRemote(remote.remoteName);
	}

	private async _sync(repository: Repository, rebase: boolean): Promise<void> {
		const HEAD = repository.HEAD;

		if (!HEAD) {
			return;
		} else if (!HEAD.upstream) {
			this._push(repository, { pushType: PushType.Push });
			return;
		}

		const remoteName = HEAD.remote || HEAD.upstream.remote;
		const remote = repository.remotes.find(r => r.name === remoteName);
		const isReadonly = remote && remote.isReadOnly;

		const config = workspace.getConfiguration('git');
		const shouldPrompt = !isReadonly && config.get<boolean>('confirmSync') === true;

		if (shouldPrompt) {
			const message = l10n.t('This action will pull and push commits from and to "{0}/{1}".', HEAD.upstream.remote, HEAD.upstream.name);
			const yes = l10n.t('OK');
			const neverAgain = l10n.t('OK, Don\'t Show Again');
			const pick = await window.showWarningMessage(message, { modal: true }, yes, neverAgain);

			if (pick === neverAgain) {
				await config.update('confirmSync', false, true);
			} else if (pick !== yes) {
				return;
			}
		}

		await repository.sync(HEAD, rebase);
	}

	@command('git.sync', { repository: true })
	async sync(repository: Repository): Promise<void> {
		const config = workspace.getConfiguration('git', Uri.file(repository.root));
		const rebase = config.get<boolean>('rebaseWhenSync', false) === true;

		try {
			await this._sync(repository, rebase);
		} catch (err) {
			if (/Cancelled/i.test(err && (err.message || err.stderr || ''))) {
				return;
			}

			throw err;
		}
	}

	@command('git._syncAll')
	async syncAll(): Promise<void> {
		await Promise.all(this.model.repositories.map(async repository => {
			const config = workspace.getConfiguration('git', Uri.file(repository.root));
			const rebase = config.get<boolean>('rebaseWhenSync', false) === true;

			const HEAD = repository.HEAD;

			if (!HEAD || !HEAD.upstream) {
				return;
			}

			await repository.sync(HEAD, rebase);
		}));
	}

	@command('git.syncRebase', { repository: true })
	async syncRebase(repository: Repository): Promise<void> {
		try {
			await this._sync(repository, true);
		} catch (err) {
			if (/Cancelled/i.test(err && (err.message || err.stderr || ''))) {
				return;
			}

			throw err;
		}
	}

	@command('git.publish', { repository: true })
	async publish(repository: Repository): Promise<void> {
		const branchName = repository.HEAD && repository.HEAD.name || '';
		const remotes = repository.remotes;

		if (remotes.length === 0) {
			const publishers = this.model.getRemoteSourcePublishers();

			if (publishers.length === 0) {
				window.showWarningMessage(l10n.t('Your repository has no remotes configured to publish to.'));
				return;
			}

			let publisher: RemoteSourcePublisher;

			if (publishers.length === 1) {
				publisher = publishers[0];
			} else {
				const picks = publishers
					.map(provider => ({ label: (provider.icon ? `$(${provider.icon}) ` : '') + l10n.t('Publish to {0}', provider.name), alwaysShow: true, provider }));
				const placeHolder = l10n.t('Pick a provider to publish the branch "{0}" to:', branchName);
				const choice = await window.showQuickPick(picks, { placeHolder });

				if (!choice) {
					return;
				}

				publisher = choice.provider;
			}

			await publisher.publishRepository(new ApiRepository(repository));
			this.model.firePublishEvent(repository, branchName);

			return;
		}

		if (remotes.length === 1) {
			await repository.pushTo(remotes[0].name, branchName, true);
			this.model.firePublishEvent(repository, branchName);

			return;
		}

		const addRemote = new AddRemoteItem(this);
		const picks = [...repository.remotes.map(r => ({ label: r.name, description: r.pushUrl })), addRemote];
		const placeHolder = l10n.t('Pick a remote to publish the branch "{0}" to:', branchName);
		const choice = await window.showQuickPick(picks, { placeHolder });

		if (!choice) {
			return;
		}

		if (choice === addRemote) {
			const newRemote = await this.addRemote(repository);

			if (newRemote) {
				await repository.pushTo(newRemote, branchName, true);

				this.model.firePublishEvent(repository, branchName);
			}
		} else {
			await repository.pushTo(choice.label, branchName, true);

			this.model.firePublishEvent(repository, branchName);
		}
	}

	@command('git.ignore')
	async ignore(...resourceStates: SourceControlResourceState[]): Promise<void> {
		resourceStates = resourceStates.filter(s => !!s);

		if (resourceStates.length === 0 || (resourceStates[0] && !(resourceStates[0].resourceUri instanceof Uri))) {
			const resource = this.getSCMResource();

			if (!resource) {
				return;
			}

			resourceStates = [resource];
		}

		const resources = resourceStates
			.filter(s => s instanceof Resource)
			.map(r => r.resourceUri);

		if (!resources.length) {
			return;
		}

		await this.runByRepository(resources, async (repository, resources) => repository.ignore(resources));
	}

	@command('git.revealInExplorer')
	async revealInExplorer(resourceState: SourceControlResourceState): Promise<void> {
		if (!resourceState) {
			return;
		}

		if (!(resourceState.resourceUri instanceof Uri)) {
			return;
		}

		await commands.executeCommand('revealInExplorer', resourceState.resourceUri);
	}

	@command('git.revealFileInOS.linux')
	@command('git.revealFileInOS.mac')
	@command('git.revealFileInOS.windows')
	async revealFileInOS(resourceState: SourceControlResourceState): Promise<void> {
		if (!resourceState) {
			return;
		}

		if (!(resourceState.resourceUri instanceof Uri)) {
			return;
		}

		await commands.executeCommand('revealFileInOS', resourceState.resourceUri);
	}

	private async _stash(repository: Repository, includeUntracked = false, staged = false): Promise<boolean> {
		const noUnstagedChanges = repository.workingTreeGroup.resourceStates.length === 0
			&& (!includeUntracked || repository.untrackedGroup.resourceStates.length === 0);
		const noStagedChanges = repository.indexGroup.resourceStates.length === 0;

		if (staged) {
			if (noStagedChanges) {
				window.showInformationMessage(l10n.t('There are no staged changes to stash.'));
				return false;
			}
		} else {
			if (noUnstagedChanges && noStagedChanges) {
				window.showInformationMessage(l10n.t('There are no changes to stash.'));
				return false;
			}
		}

		const config = workspace.getConfiguration('git', Uri.file(repository.root));
		const promptToSaveFilesBeforeStashing = config.get<'always' | 'staged' | 'never'>('promptToSaveFilesBeforeStash');

		if (promptToSaveFilesBeforeStashing !== 'never') {
			let documents = workspace.textDocuments
				.filter(d => !d.isUntitled && d.isDirty && isDescendant(repository.root, d.uri.fsPath));

			if (promptToSaveFilesBeforeStashing === 'staged' || repository.indexGroup.resourceStates.length > 0) {
				documents = documents
					.filter(d => repository.indexGroup.resourceStates.some(s => pathEquals(s.resourceUri.fsPath, d.uri.fsPath)));
			}

			if (documents.length > 0) {
				const message = documents.length === 1
					? l10n.t('The following file has unsaved changes which won\'t be included in the stash if you proceed: {0}.\n\nWould you like to save it before stashing?', path.basename(documents[0].uri.fsPath))
					: l10n.t('There are {0} unsaved files.\n\nWould you like to save them before stashing?', documents.length);
				const saveAndStash = l10n.t('Save All & Stash');
				const stash = l10n.t('Stash Anyway');
				const pick = await window.showWarningMessage(message, { modal: true }, saveAndStash, stash);

				if (pick === saveAndStash) {
					await Promise.all(documents.map(d => d.save()));
				} else if (pick !== stash) {
					return false; // do not stash on cancel
				}
			}
		}

		let message: string | undefined;

		if (config.get<boolean>('useCommitInputAsStashMessage') && (!repository.sourceControl.commitTemplate || repository.inputBox.value !== repository.sourceControl.commitTemplate)) {
			message = repository.inputBox.value;
		}

		message = await window.showInputBox({
			value: message,
			prompt: l10n.t('Optionally provide a stash message'),
			placeHolder: l10n.t('Stash message')
		});

		if (typeof message === 'undefined') {
			return false;
		}

		try {
			await repository.createStash(message, includeUntracked, staged);
			return true;
		} catch (err) {
			if (/You do not have the initial commit yet/.test(err.stderr || '')) {
				window.showInformationMessage(l10n.t('The repository does not have any commits. Please make an initial commit before creating a stash.'));
				return false;
			}

			throw err;
		}
	}

	@command('git.stash', { repository: true })
	async stash(repository: Repository): Promise<void> {
		await this._stash(repository);
	}

	@command('git.stashStaged', { repository: true })
	async stashStaged(repository: Repository): Promise<void> {
		await this._stash(repository, false, true);
	}

	@command('git.stashIncludeUntracked', { repository: true })
	async stashIncludeUntracked(repository: Repository): Promise<void> {
		await this._stash(repository, true);
	}

	@command('git.stashPop', { repository: true })
	async stashPop(repository: Repository): Promise<void> {
		const placeHolder = l10n.t('Pick a stash to pop');
		const stash = await this.pickStash(repository, placeHolder);

		if (!stash) {
			return;
		}

		await repository.popStash(stash.index);
	}

	@command('git.stashPopLatest', { repository: true })
	async stashPopLatest(repository: Repository): Promise<void> {
		const stashes = await repository.getStashes();

		if (stashes.length === 0) {
			window.showInformationMessage(l10n.t('There are no stashes in the repository.'));
			return;
		}

		await repository.popStash();
	}

	@command('git.stashApply', { repository: true })
	async stashApply(repository: Repository): Promise<void> {
		const placeHolder = l10n.t('Pick a stash to apply');
		const stash = await this.pickStash(repository, placeHolder);

		if (!stash) {
			return;
		}

		await repository.applyStash(stash.index);
	}

	@command('git.stashApplyLatest', { repository: true })
	async stashApplyLatest(repository: Repository): Promise<void> {
		const stashes = await repository.getStashes();

		if (stashes.length === 0) {
			window.showInformationMessage(l10n.t('There are no stashes in the repository.'));
			return;
		}

		await repository.applyStash();
	}

	@command('git.stashDrop', { repository: true })
	async stashDrop(repository: Repository): Promise<void> {
		const placeHolder = l10n.t('Pick a stash to drop');
		const stash = await this.pickStash(repository, placeHolder);

		if (!stash) {
			return;
		}

		// request confirmation for the operation
		const yes = l10n.t('Yes');
		const result = await window.showWarningMessage(
			l10n.t('Are you sure you want to drop the stash: {0}?', stash.description),
			{ modal: true },
			yes
		);
		if (result !== yes) {
			return;
		}

		await repository.dropStash(stash.index);
	}

	@command('git.stashDropAll', { repository: true })
	async stashDropAll(repository: Repository): Promise<void> {
		const stashes = await repository.getStashes();

		if (stashes.length === 0) {
			window.showInformationMessage(l10n.t('There are no stashes in the repository.'));
			return;
		}

		// request confirmation for the operation
		const yes = l10n.t('Yes');
		const question = stashes.length === 1 ?
			l10n.t('Are you sure you want to drop ALL stashes? There is 1 stash that will be subject to pruning, and MAY BE IMPOSSIBLE TO RECOVER.') :
			l10n.t('Are you sure you want to drop ALL stashes? There are {0} stashes that will be subject to pruning, and MAY BE IMPOSSIBLE TO RECOVER.', stashes.length);

		const result = await window.showWarningMessage(question, { modal: true }, yes);
		if (result !== yes) {
			return;
		}

		await repository.dropStash();
	}

	private async pickStash(repository: Repository, placeHolder: string): Promise<Stash | undefined> {
		const stashes = await repository.getStashes();

		if (stashes.length === 0) {
			window.showInformationMessage(l10n.t('There are no stashes in the repository.'));
			return;
		}

		const picks = stashes.map(stash => ({ label: `#${stash.index}:  ${stash.description}`, description: '', details: '', stash }));
		const result = await window.showQuickPick(picks, { placeHolder });
		return result && result.stash;
	}

	@command('git.timeline.openDiff', { repository: false })
	async timelineOpenDiff(item: TimelineItem, uri: Uri | undefined, _source: string) {
		const cmd = this.resolveTimelineOpenDiffCommand(
			item, uri,
			{
				preserveFocus: true,
				preview: true,
				viewColumn: ViewColumn.Active
			},
		);
		if (cmd === undefined) {
			return undefined;
		}

		return commands.executeCommand(cmd.command, ...(cmd.arguments ?? []));
	}

	resolveTimelineOpenDiffCommand(item: TimelineItem, uri: Uri | undefined, options?: TextDocumentShowOptions): Command | undefined {
		if (uri === undefined || uri === null || !GitTimelineItem.is(item)) {
			return undefined;
		}

		const basename = path.basename(uri.fsPath);

		let title;
		if ((item.previousRef === 'HEAD' || item.previousRef === '~') && item.ref === '') {
			title = l10n.t('{0} (Working Tree)', basename);
		}
		else if (item.previousRef === 'HEAD' && item.ref === '~') {
			title = l10n.t('{0} (Index)', basename);
		} else {
			title = l10n.t('{0} ({1}) ↔ {0} ({2})', basename, item.shortPreviousRef, item.shortRef);
		}

		return {
			command: 'vscode.diff',
			title: l10n.t('Open Comparison'),
			arguments: [toGitUri(uri, item.previousRef), item.ref === '' ? uri : toGitUri(uri, item.ref), title, options]
		};
	}

	@command('git.timeline.copyCommitId', { repository: false })
	async timelineCopyCommitId(item: TimelineItem, _uri: Uri | undefined, _source: string) {
		if (!GitTimelineItem.is(item)) {
			return;
		}

		env.clipboard.writeText(item.ref);
	}

	@command('git.timeline.copyCommitMessage', { repository: false })
	async timelineCopyCommitMessage(item: TimelineItem, _uri: Uri | undefined, _source: string) {
		if (!GitTimelineItem.is(item)) {
			return;
		}

		env.clipboard.writeText(item.message);
	}

	private _selectedForCompare: { uri: Uri; item: GitTimelineItem } | undefined;

	@command('git.timeline.selectForCompare', { repository: false })
	async timelineSelectForCompare(item: TimelineItem, uri: Uri | undefined, _source: string) {
		if (!GitTimelineItem.is(item) || !uri) {
			return;
		}

		this._selectedForCompare = { uri, item };
		await commands.executeCommand('setContext', 'git.timeline.selectedForCompare', true);
	}

	@command('git.timeline.compareWithSelected', { repository: false })
	async timelineCompareWithSelected(item: TimelineItem, uri: Uri | undefined, _source: string) {
		if (!GitTimelineItem.is(item) || !uri || !this._selectedForCompare || uri.toString() !== this._selectedForCompare.uri.toString()) {
			return;
		}

		const { item: selected } = this._selectedForCompare;

		const basename = path.basename(uri.fsPath);
		let leftTitle;
		if ((selected.previousRef === 'HEAD' || selected.previousRef === '~') && selected.ref === '') {
			leftTitle = l10n.t('{0} (Working Tree)', basename);
		}
		else if (selected.previousRef === 'HEAD' && selected.ref === '~') {
			leftTitle = l10n.t('{0} (Index)', basename);
		} else {
			leftTitle = l10n.t('{0} ({1})', basename, selected.shortRef);
		}

		let rightTitle;
		if ((item.previousRef === 'HEAD' || item.previousRef === '~') && item.ref === '') {
			rightTitle = l10n.t('{0} (Working Tree)', basename);
		}
		else if (item.previousRef === 'HEAD' && item.ref === '~') {
			rightTitle = l10n.t('{0} (Index)', basename);
		} else {
			rightTitle = l10n.t('{0} ({1})', basename, item.shortRef);
		}


		const title = l10n.t('{0} ↔ {1}', leftTitle, rightTitle);
		await commands.executeCommand('vscode.diff', selected.ref === '' ? uri : toGitUri(uri, selected.ref), item.ref === '' ? uri : toGitUri(uri, item.ref), title);
	}

	@command('git.rebaseAbort', { repository: true })
	async rebaseAbort(repository: Repository): Promise<void> {
		if (repository.rebaseCommit) {
			await repository.rebaseAbort();
		} else {
			await window.showInformationMessage(l10n.t('No rebase in progress.'));
		}
	}

	@command('git.closeAllDiffEditors', { repository: true })
	closeDiffEditors(repository: Repository): void {
		repository.closeDiffEditors(undefined, undefined, true);
	}

	@command('git.openRepositoriesInParentFolders')
	async openRepositoriesInParentFolders(): Promise<void> {
		const parentRepositories: string[] = [];

		const title = l10n.t('Open Repositories In Parent Folders');
		const placeHolder = l10n.t('Pick a repository to open');

		const allRepositoriesLabel = l10n.t('All Repositories');
		const allRepositoriesQuickPickItem: QuickPickItem = { label: allRepositoriesLabel };
		const repositoriesQuickPickItems: QuickPickItem[] = this.model.parentRepositories
			.sort(compareRepositoryLabel).map(r => new RepositoryItem(r));

		const items = this.model.parentRepositories.length === 1 ? [...repositoriesQuickPickItems] :
			[...repositoriesQuickPickItems, { label: '', kind: QuickPickItemKind.Separator }, allRepositoriesQuickPickItem];

		const repositoryItem = await window.showQuickPick(items, { title, placeHolder });
		if (!repositoryItem) {
			return;
		}

		if (repositoryItem === allRepositoriesQuickPickItem) {
			// All Repositories
			parentRepositories.push(...this.model.parentRepositories);
		} else {
			// One Repository
			parentRepositories.push((repositoryItem as RepositoryItem).path);
		}

		for (const parentRepository of parentRepositories) {
			await this.model.openParentRepository(parentRepository);
		}
	}

	@command('git.manageUnsafeRepositories')
	async manageUnsafeRepositories(): Promise<void> {
		const unsafeRepositories: string[] = [];

		const quickpick = window.createQuickPick();
		quickpick.title = l10n.t('Manage Unsafe Repositories');
		quickpick.placeholder = l10n.t('Pick a repository to mark as safe and open');

		const allRepositoriesLabel = l10n.t('All Repositories');
		const allRepositoriesQuickPickItem: QuickPickItem = { label: allRepositoriesLabel };
		const repositoriesQuickPickItems: QuickPickItem[] = this.model.unsafeRepositories
			.sort(compareRepositoryLabel).map(r => new RepositoryItem(r));

		quickpick.items = this.model.unsafeRepositories.length === 1 ? [...repositoriesQuickPickItems] :
			[...repositoriesQuickPickItems, { label: '', kind: QuickPickItemKind.Separator }, allRepositoriesQuickPickItem];

		quickpick.show();
		const repositoryItem = await new Promise<RepositoryItem | QuickPickItem | undefined>(
			resolve => {
				quickpick.onDidAccept(() => resolve(quickpick.activeItems[0]));
				quickpick.onDidHide(() => resolve(undefined));
			});
		quickpick.hide();

		if (!repositoryItem) {
			return;
		}

		if (repositoryItem.label === allRepositoriesLabel) {
			// All Repositories
			unsafeRepositories.push(...this.model.unsafeRepositories);
		} else {
			// One Repository
			unsafeRepositories.push((repositoryItem as RepositoryItem).path);
		}

		for (const unsafeRepository of unsafeRepositories) {
			// Mark as Safe
			await this.git.addSafeDirectory(this.model.getUnsafeRepositoryPath(unsafeRepository)!);

			// Open Repository
			await this.model.openRepository(unsafeRepository);
			this.model.deleteUnsafeRepository(unsafeRepository);
		}
	}

	private createCommand(id: string, key: string, method: Function, options: ScmCommandOptions): (...args: any[]) => any {
		const result = (...args: any[]) => {
			let result: Promise<any>;

			if (!options.repository) {
				result = Promise.resolve(method.apply(this, args));
			} else {
				// try to guess the repository based on the first argument
				const repository = this.model.getRepository(args[0]);
				let repositoryPromise: Promise<Repository | undefined>;

				if (repository) {
					repositoryPromise = Promise.resolve(repository);
				} else if (this.model.repositories.length === 1) {
					repositoryPromise = Promise.resolve(this.model.repositories[0]);
				} else {
					repositoryPromise = this.model.pickRepository();
				}

				result = repositoryPromise.then(repository => {
					if (!repository) {
						return Promise.resolve();
					}

					return Promise.resolve(method.apply(this, [repository, ...args.slice(1)]));
				});
			}

			/* __GDPR__
				"git.command" : {
					"owner": "lszomoru",
					"command" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "comment": "The command id of the command being executed" }
				}
			*/
			this.telemetryReporter.sendTelemetryEvent('git.command', { command: id });

			return result.catch(err => {
				const options: MessageOptions = {
					modal: true
				};

				let message: string;
				let type: 'error' | 'warning' | 'information' = 'error';

				const choices = new Map<string, () => void>();
				const openOutputChannelChoice = l10n.t('Open Git Log');
				const outputChannelLogger = this.logger;
				choices.set(openOutputChannelChoice, () => outputChannelLogger.show());

				const showCommandOutputChoice = l10n.t('Show Command Output');
				if (err.stderr) {
					choices.set(showCommandOutputChoice, async () => {
						const timestamp = new Date().getTime();
						const uri = Uri.parse(`git-output:/git-error-${timestamp}`);

						let command = 'git';

						if (err.gitArgs) {
							command = `${command} ${err.gitArgs.join(' ')}`;
						} else if (err.gitCommand) {
							command = `${command} ${err.gitCommand}`;
						}

						this.commandErrors.set(uri, `> ${command}\n${err.stderr}`);

						try {
							const doc = await workspace.openTextDocument(uri);
							await window.showTextDocument(doc);
						} finally {
							this.commandErrors.delete(uri);
						}
					});
				}

				switch (err.gitErrorCode) {
					case GitErrorCodes.DirtyWorkTree:
						message = l10n.t('Please clean your repository working tree before checkout.');
						break;
					case GitErrorCodes.PushRejected:
						message = l10n.t('Can\'t push refs to remote. Try running "Pull" first to integrate your changes.');
						break;
					case GitErrorCodes.Conflict:
						message = l10n.t('There are merge conflicts. Resolve them before committing.');
						type = 'warning';
						choices.set(l10n.t('Show Changes'), () => commands.executeCommand('workbench.view.scm'));
						options.modal = false;
						break;
					case GitErrorCodes.StashConflict:
						message = l10n.t('There were merge conflicts while applying the stash.');
						choices.set(l10n.t('Show Changes'), () => commands.executeCommand('workbench.view.scm'));
						type = 'warning';
						options.modal = false;
						break;
					case GitErrorCodes.AuthenticationFailed: {
						const regex = /Authentication failed for '(.*)'/i;
						const match = regex.exec(err.stderr || String(err));

						message = match
							? l10n.t('Failed to authenticate to git remote:\n\n{0}', match[1])
							: l10n.t('Failed to authenticate to git remote.');
						break;
					}
					case GitErrorCodes.NoUserNameConfigured:
					case GitErrorCodes.NoUserEmailConfigured:
						message = l10n.t('Make sure you configure your "user.name" and "user.email" in git.');
						choices.set(l10n.t('Learn More'), () => commands.executeCommand('vscode.open', Uri.parse('https://aka.ms/vscode-setup-git')));
						break;
					case GitErrorCodes.EmptyCommitMessage:
						message = l10n.t('Commit operation was cancelled due to empty commit message.');
						choices.clear();
						type = 'information';
						options.modal = false;
						break;
					default: {
						const hint = (err.stderr || err.message || String(err))
							.replace(/^error: /mi, '')
							.replace(/^> husky.*$/mi, '')
							.split(/[\r\n]/)
							.filter((line: string) => !!line)
						[0];

						message = hint
							? l10n.t('Git: {0}', hint)
							: l10n.t('Git error');

						break;
					}
				}

				if (!message) {
					console.error(err);
					return;
				}

				// We explicitly do not await this promise, because we do not
				// want the command execution to be stuck waiting for the user
				// to take action on the notification.
				this.showErrorNotification(type, message, options, choices);
			});
		};

		// patch this object, so people can call methods directly
		(this as any)[key] = result;

		return result;
	}

	private async showErrorNotification(type: 'error' | 'warning' | 'information', message: string, options: MessageOptions, choices: Map<string, () => void>): Promise<void> {
		let result: string | undefined;
		const allChoices = Array.from(choices.keys());

		switch (type) {
			case 'error':
				result = await window.showErrorMessage(message, options, ...allChoices);
				break;
			case 'warning':
				result = await window.showWarningMessage(message, options, ...allChoices);
				break;
			case 'information':
				result = await window.showInformationMessage(message, options, ...allChoices);
				break;
		}

		if (result) {
			const resultFn = choices.get(result);

			resultFn?.();
		}
	}

	private getSCMResource(uri?: Uri): Resource | undefined {
		uri = uri ? uri : (window.activeTextEditor && window.activeTextEditor.document.uri);

		this.logger.debug(`git.getSCMResource.uri ${uri && uri.toString()}`);

		for (const r of this.model.repositories.map(r => r.root)) {
			this.logger.debug(`repo root ${r}`);
		}

		if (!uri) {
			return undefined;
		}

		if (isGitUri(uri)) {
			const { path } = fromGitUri(uri);
			uri = Uri.file(path);
		}

		if (uri.scheme === 'file') {
			const uriString = uri.toString();
			const repository = this.model.getRepository(uri);

			if (!repository) {
				return undefined;
			}

			return repository.workingTreeGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString)[0]
				|| repository.indexGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString)[0]
				|| repository.mergeGroup.resourceStates.filter(r => r.resourceUri.toString() === uriString)[0];
		}
		return undefined;
	}

	private runByRepository<T>(resource: Uri, fn: (repository: Repository, resource: Uri) => Promise<T>): Promise<T[]>;
	private runByRepository<T>(resources: Uri[], fn: (repository: Repository, resources: Uri[]) => Promise<T>): Promise<T[]>;
	private async runByRepository<T>(arg: Uri | Uri[], fn: (repository: Repository, resources: any) => Promise<T>): Promise<T[]> {
		const resources = arg instanceof Uri ? [arg] : arg;
		const isSingleResource = arg instanceof Uri;

		const groups = resources.reduce((result, resource) => {
			let repository = this.model.getRepository(resource);

			if (!repository) {
				console.warn('Could not find git repository for ', resource);
				return result;
			}

			// Could it be a submodule?
			if (pathEquals(resource.fsPath, repository.root)) {
				repository = this.model.getRepositoryForSubmodule(resource) || repository;
			}

			const tuple = result.filter(p => p.repository === repository)[0];

			if (tuple) {
				tuple.resources.push(resource);
			} else {
				result.push({ repository, resources: [resource] });
			}

			return result;
		}, [] as { repository: Repository; resources: Uri[] }[]);

		const promises = groups
			.map(({ repository, resources }) => fn(repository as Repository, isSingleResource ? resources[0] : resources));

		return Promise.all(promises);
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}
