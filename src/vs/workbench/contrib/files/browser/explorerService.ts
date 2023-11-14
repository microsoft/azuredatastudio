/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import { IWorkspaceContextService } from 'vs/platform/workspace/common/workspace';
import { DisposableStore } from 'vs/base/common/lifecycle';
import { IFilesConfiguration, ISortOrderConfiguration, SortOrder, LexicographicOptions } from 'vs/workbench/contrib/files/common/files';
import { ExplorerItem, ExplorerModel } from 'vs/workbench/contrib/files/common/explorerModel';
import { URI } from 'vs/base/common/uri';
import { FileOperationEvent, FileOperation, IFileService, FileChangesEvent, FileChangeType, IResolveFileOptions } from 'vs/platform/files/common/files';
import { dirname, basename } from 'vs/base/common/resources';
import { IConfigurationService, IConfigurationChangeEvent } from 'vs/platform/configuration/common/configuration';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IEditableData } from 'vs/workbench/common/views';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { IBulkEditService, ResourceFileEdit } from 'vs/editor/browser/services/bulkEditService';
import { UndoRedoSource } from 'vs/platform/undoRedo/common/undoRedo';
import { IExplorerView, IExplorerService } from 'vs/workbench/contrib/files/browser/files';
import { IProgressService, ProgressLocation, IProgressNotificationOptions, IProgressCompositeOptions } from 'vs/platform/progress/common/progress';
import { CancellationTokenSource } from 'vs/base/common/cancellation';
import { RunOnceScheduler } from 'vs/base/common/async';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { IExpression } from 'vs/base/common/glob';
import { ResourceGlobMatcher } from 'vs/workbench/common/resources';
import { IFilesConfigurationService } from 'vs/workbench/services/filesConfiguration/common/filesConfigurationService';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';

export const UNDO_REDO_SOURCE = new UndoRedoSource();

export class ExplorerService implements IExplorerService {
	declare readonly _serviceBrand: undefined;

	private static readonly EXPLORER_FILE_CHANGES_REACT_DELAY = 500; // delay in ms to react to file changes to give our internal events a chance to react first

	private readonly disposables = new DisposableStore();
	private editable: { stat: ExplorerItem; data: IEditableData } | undefined;
	private config: IFilesConfiguration['explorer'];
	private cutItems: ExplorerItem[] | undefined;
	private view: IExplorerView | undefined;
	private model: ExplorerModel;
	private onFileChangesScheduler: RunOnceScheduler;
	private fileChangeEvents: FileChangesEvent[] = [];
	private revealExcludeMatcher: ResourceGlobMatcher;

	constructor(
		@IFileService private fileService: IFileService,
		@IConfigurationService private configurationService: IConfigurationService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IClipboardService private clipboardService: IClipboardService,
		@IEditorService private editorService: IEditorService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
		@IBulkEditService private readonly bulkEditService: IBulkEditService,
		@IProgressService private readonly progressService: IProgressService,
		@IHostService hostService: IHostService,
		@IFilesConfigurationService private readonly filesConfigurationService: IFilesConfigurationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService
	) {
		this.config = this.configurationService.getValue('explorer');

		this.model = new ExplorerModel(this.contextService, this.uriIdentityService, this.fileService, this.configurationService, this.filesConfigurationService);
		this.disposables.add(this.model);
		this.disposables.add(this.fileService.onDidRunOperation(e => this.onDidRunOperation(e)));

		this.onFileChangesScheduler = new RunOnceScheduler(async () => {
			const events = this.fileChangeEvents;
			this.fileChangeEvents = [];

			// Filter to the ones we care
			const types = [FileChangeType.DELETED];
			if (this.config.sortOrder === SortOrder.Modified) {
				types.push(FileChangeType.UPDATED);
			}

			let shouldRefresh = false;
			// For DELETED and UPDATED events go through the explorer model and check if any of the items got affected
			this.roots.forEach(r => {
				if (this.view && !shouldRefresh) {
					shouldRefresh = doesFileEventAffect(r, this.view, events, types);
				}
			});
			// For ADDED events we need to go through all the events and check if the explorer is already aware of some of them
			// Or if they affect not yet resolved parts of the explorer. If that is the case we will not refresh.
			events.forEach(e => {
				if (!shouldRefresh) {
					for (const resource of e.rawAdded) {
						const parent = this.model.findClosest(dirname(resource));
						// Parent of the added resource is resolved and the explorer model is not aware of the added resource - we need to refresh
						if (parent && !parent.getChild(basename(resource))) {
							shouldRefresh = true;
							break;
						}
					}
				}
			});

			if (shouldRefresh) {
				await this.refresh(false);
			}

		}, ExplorerService.EXPLORER_FILE_CHANGES_REACT_DELAY);

		this.disposables.add(this.fileService.onDidFilesChange(e => {
			this.fileChangeEvents.push(e);
			// Don't mess with the file tree while in the process of editing. #112293
			if (this.editable) {
				return;
			}
			if (!this.onFileChangesScheduler.isScheduled()) {
				this.onFileChangesScheduler.schedule();
			}
		}));
		this.disposables.add(this.configurationService.onDidChangeConfiguration(e => this.onConfigurationUpdated(e)));
		this.disposables.add(Event.any<{ scheme: string }>(this.fileService.onDidChangeFileSystemProviderRegistrations, this.fileService.onDidChangeFileSystemProviderCapabilities)(async e => {
			let affected = false;
			this.model.roots.forEach(r => {
				if (r.resource.scheme === e.scheme) {
					affected = true;
					r.forgetChildren();
				}
			});
			if (affected) {
				if (this.view) {
					await this.view.setTreeInput();
				}
			}
		}));
		this.disposables.add(this.model.onDidChangeRoots(() => {
			this.view?.setTreeInput();
		}));

		// Refresh explorer when window gets focus to compensate for missing file events #126817
		this.disposables.add(hostService.onDidChangeFocus(hasFocus => {
			if (hasFocus) {
				this.refresh(false);
			}
		}));
		this.revealExcludeMatcher = new ResourceGlobMatcher(
			(uri) => getRevealExcludes(configurationService.getValue<IFilesConfiguration>({ resource: uri })),
			(event) => event.affectsConfiguration('explorer.autoRevealExclude'),
			contextService, configurationService);
		this.disposables.add(this.revealExcludeMatcher);
	}

	get roots(): ExplorerItem[] {
		return this.model.roots;
	}

	get sortOrderConfiguration(): ISortOrderConfiguration {
		return {
			sortOrder: this.config.sortOrder,
			lexicographicOptions: this.config.sortOrderLexicographicOptions,
		};
	}

	registerView(contextProvider: IExplorerView): void {
		this.view = contextProvider;
	}

	getContext(respectMultiSelection: boolean, ignoreNestedChildren: boolean = false): ExplorerItem[] {
		if (!this.view) {
			return [];
		}

		const items = new Set<ExplorerItem>(this.view.getContext(respectMultiSelection));
		items.forEach(item => {
			try {
				if (respectMultiSelection && !ignoreNestedChildren && this.view?.isItemCollapsed(item) && item.nestedChildren) {
					for (const child of item.nestedChildren) {
						items.add(child);
					}
				}
			} catch {
				// We will error out trying to resolve collapsed nodes that have not yet been resolved.
				// So we catch and ignore them in the multiSelect context
				return;
			}
		});

		return [...items];
	}

	async applyBulkEdit(edit: ResourceFileEdit[], options: { undoLabel: string; progressLabel: string; confirmBeforeUndo?: boolean; progressLocation?: ProgressLocation.Explorer | ProgressLocation.Window }): Promise<void> {
		const cancellationTokenSource = new CancellationTokenSource();
		const promise = this.progressService.withProgress(<IProgressNotificationOptions | IProgressCompositeOptions>{
			location: options.progressLocation || ProgressLocation.Window,
			title: options.progressLabel,
			cancellable: edit.length > 1, // Only allow cancellation when there is more than one edit. Since cancelling will not actually stop the current edit that is in progress.
			delay: 500,
		}, async progress => {
			await this.bulkEditService.apply(edit, {
				undoRedoSource: UNDO_REDO_SOURCE,
				label: options.undoLabel,
				code: 'undoredo.explorerOperation',
				progress,
				token: cancellationTokenSource.token,
				confirmBeforeUndo: options.confirmBeforeUndo
			});
		}, () => cancellationTokenSource.cancel());
		await this.progressService.withProgress({ location: ProgressLocation.Explorer, delay: 500 }, () => promise);
		cancellationTokenSource.dispose();
	}

	hasViewFocus(): boolean {
		return !!this.view && this.view.hasFocus();
	}

	// IExplorerService methods

	findClosest(resource: URI): ExplorerItem | null {
		return this.model.findClosest(resource);
	}

	findClosestRoot(resource: URI): ExplorerItem | null {
		const parentRoots = this.model.roots.filter(r => this.uriIdentityService.extUri.isEqualOrParent(resource, r.resource))
			.sort((first, second) => second.resource.path.length - first.resource.path.length);
		return parentRoots.length ? parentRoots[0] : null;
	}

	async setEditable(stat: ExplorerItem, data: IEditableData | null): Promise<void> {
		if (!this.view) {
			return;
		}

		if (!data) {
			this.editable = undefined;
		} else {
			this.editable = { stat, data };
		}
		const isEditing = this.isEditable(stat);
		try {
			await this.view.setEditable(stat, isEditing);
		} catch {
			const parent = stat.parent;
			type ExplorerViewEditableErrorData = {
				parentIsDirectory: boolean | undefined;
				isDirectory: boolean | undefined;
				isReadonly: boolean | undefined;
				parentIsReadonly: boolean | undefined;
				parentIsExcluded: boolean | undefined;
				isExcluded: boolean | undefined;
				parentIsRoot: boolean | undefined;
				isRoot: boolean | undefined;
				parentHasNests: boolean | undefined;
				hasNests: boolean | undefined;
			};
			type ExplorerViewEditableErrorClassification = {
				owner: 'lramos15';
				comment: 'Helps gain a broard understanding of why users are unable to edit files in the explorer';
				parentIsDirectory: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the parent of the editable element is a directory' };
				isDirectory: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the editable element is a directory' };
				isReadonly: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the editable element is readonly' };
				parentIsReadonly: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the parent of the editable element is readonly' };
				parentIsExcluded: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the parent of the editable element is excluded from being shown in the explorer' };
				isExcluded: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the editable element is excluded from being shown in the explorer' };
				parentIsRoot: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the parent of the editable element is a root' };
				isRoot: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the editable element is a root' };
				parentHasNests: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the parent of the editable element has nested children' };
				hasNests: { classification: 'SystemMetaData'; purpose: 'PerformanceAndHealth'; isMeasurement: true; comment: 'Whether the editable element has nested children' };
			};
			const errorData = {
				parentIsDirectory: parent?.isDirectory,
				isDirectory: stat.isDirectory,
				isReadonly: !!stat.isReadonly,
				parentIsReadonly: !!parent?.isReadonly,
				parentIsExcluded: parent?.isExcluded,
				isExcluded: stat.isExcluded,
				parentIsRoot: parent?.isRoot,
				isRoot: stat.isRoot,
				parentHasNests: parent?.hasNests,
				hasNests: stat.hasNests,
			};
			this.telemetryService.publicLogError2<ExplorerViewEditableErrorData, ExplorerViewEditableErrorClassification>('explorerView.setEditableError', errorData);
			return;
		}


		if (!this.editable && this.fileChangeEvents.length && !this.onFileChangesScheduler.isScheduled()) {
			this.onFileChangesScheduler.schedule();
		}
	}

	async setToCopy(items: ExplorerItem[], cut: boolean): Promise<void> {
		const previouslyCutItems = this.cutItems;
		this.cutItems = cut ? items : undefined;
		await this.clipboardService.writeResources(items.map(s => s.resource));

		this.view?.itemsCopied(items, cut, previouslyCutItems);
	}

	isCut(item: ExplorerItem): boolean {
		return !!this.cutItems && this.cutItems.some(i => this.uriIdentityService.extUri.isEqual(i.resource, item.resource));
	}

	getEditable(): { stat: ExplorerItem; data: IEditableData } | undefined {
		return this.editable;
	}

	getEditableData(stat: ExplorerItem): IEditableData | undefined {
		return this.editable && this.editable.stat === stat ? this.editable.data : undefined;
	}

	isEditable(stat: ExplorerItem | undefined): boolean {
		return !!this.editable && (this.editable.stat === stat || !stat);
	}

	async select(resource: URI, reveal?: boolean | string): Promise<void> {
		if (!this.view) {
			return;
		}

		// If file or parent matches exclude patterns, do not reveal unless reveal argument is 'force'
		const ignoreRevealExcludes = reveal === 'force';

		const fileStat = this.findClosest(resource);
		if (fileStat) {
			if (!this.shouldAutoRevealItem(fileStat, ignoreRevealExcludes)) {
				return;
			}
			await this.view.selectResource(fileStat.resource, reveal);
			return Promise.resolve(undefined);
		}

		// Stat needs to be resolved first and then revealed
		const options: IResolveFileOptions = { resolveTo: [resource], resolveMetadata: this.config.sortOrder === SortOrder.Modified };
		const root = this.findClosestRoot(resource);
		if (!root) {
			return undefined;
		}

		try {
			const stat = await this.fileService.resolve(root.resource, options);

			// Convert to model
			const modelStat = ExplorerItem.create(this.fileService, this.configurationService, this.filesConfigurationService, stat, undefined, options.resolveTo);
			// Update Input with disk Stat
			ExplorerItem.mergeLocalWithDisk(modelStat, root);
			const item = root.find(resource);
			await this.view.refresh(true, root);

			// Once item is resolved, check again if folder should be expanded
			if (item && !this.shouldAutoRevealItem(item, ignoreRevealExcludes)) {
				return;
			}
			await this.view.selectResource(item ? item.resource : undefined, reveal);
		} catch (error) {
			root.error = error;
			await this.view.refresh(false, root);
		}
	}

	async refresh(reveal = true): Promise<void> {
		this.model.roots.forEach(r => r.forgetChildren());
		if (this.view) {
			await this.view.refresh(true);
			const resource = this.editorService.activeEditor?.resource;
			const autoReveal = this.configurationService.getValue<IFilesConfiguration>().explorer.autoReveal;

			if (reveal && resource && autoReveal) {
				// We did a top level refresh, reveal the active file #67118
				this.select(resource, autoReveal);
			}
		}
	}

	// File events

	private async onDidRunOperation(e: FileOperationEvent): Promise<void> {
		// When nesting, changes to one file in a folder may impact the rendered structure
		// of all the folder's immediate children, thus a recursive refresh is needed.
		// Ideally the tree would be able to recusively refresh just one level but that does not yet exist.
		const shouldDeepRefresh = this.config.fileNesting.enabled;

		// Add
		if (e.isOperation(FileOperation.CREATE) || e.isOperation(FileOperation.COPY)) {
			const addedElement = e.target;
			const parentResource = dirname(addedElement.resource)!;
			const parents = this.model.findAll(parentResource);

			if (parents.length) {

				// Add the new file to its parent (Model)
				await Promise.all(parents.map(async p => {
					// We have to check if the parent is resolved #29177
					const resolveMetadata = this.config.sortOrder === `modified`;
					if (!p.isDirectoryResolved) {
						const stat = await this.fileService.resolve(p.resource, { resolveMetadata });
						if (stat) {
							const modelStat = ExplorerItem.create(this.fileService, this.configurationService, this.filesConfigurationService, stat, p.parent);
							ExplorerItem.mergeLocalWithDisk(modelStat, p);
						}
					}

					const childElement = ExplorerItem.create(this.fileService, this.configurationService, this.filesConfigurationService, addedElement, p.parent);
					// Make sure to remove any previous version of the file if any
					p.removeChild(childElement);
					p.addChild(childElement);
					// Refresh the Parent (View)
					await this.view?.refresh(shouldDeepRefresh, p);
				}));
			}
		}

		// Move (including Rename)
		else if (e.isOperation(FileOperation.MOVE)) {
			const oldResource = e.resource;
			const newElement = e.target;
			const oldParentResource = dirname(oldResource);
			const newParentResource = dirname(newElement.resource);
			const modelElements = this.model.findAll(oldResource);
			const sameParentMove = modelElements.every(e => !e.nestedParent) && this.uriIdentityService.extUri.isEqual(oldParentResource, newParentResource);

			// Handle Rename
			if (sameParentMove) {
				await Promise.all(modelElements.map(async modelElement => {
					// Rename File (Model)
					modelElement.rename(newElement);
					await this.view?.refresh(shouldDeepRefresh, modelElement.parent);
				}));
			}

			// Handle Move
			else {
				const newParents = this.model.findAll(newParentResource);
				if (newParents.length && modelElements.length) {
					// Move in Model
					await Promise.all(modelElements.map(async (modelElement, index) => {
						const oldParent = modelElement.parent;
						const oldNestedParent = modelElement.nestedParent;
						modelElement.move(newParents[index]);
						if (oldNestedParent) {
							await this.view?.refresh(false, oldNestedParent);
						}
						await this.view?.refresh(false, oldParent);
						await this.view?.refresh(shouldDeepRefresh, newParents[index]);
					}));
				}
			}
		}

		// Delete
		else if (e.isOperation(FileOperation.DELETE)) {
			const modelElements = this.model.findAll(e.resource);
			await Promise.all(modelElements.map(async modelElement => {
				if (modelElement.parent) {
					// Remove Element from Parent (Model)
					const parent = modelElement.parent;
					parent.removeChild(modelElement);

					const oldNestedParent = modelElement.nestedParent;
					if (oldNestedParent) {
						oldNestedParent.removeChild(modelElement);
						await this.view?.refresh(false, oldNestedParent);
					}
					// Refresh Parent (View)
					await this.view?.refresh(shouldDeepRefresh, parent);
				}
			}));
		}
	}

	// Check if an item matches a explorer.autoRevealExclude pattern
	private shouldAutoRevealItem(item: ExplorerItem | undefined, ignore: boolean): boolean {
		if (item === undefined || ignore) {
			return true;
		}
		if (this.revealExcludeMatcher.matches(item.resource, name => !!(item.parent && item.parent.getChild(name)))) {
			return false;
		}
		const root = item.root;
		let currentItem = item.parent;
		while (currentItem !== root) {
			if (currentItem === undefined) {
				return true;
			}
			if (this.revealExcludeMatcher.matches(currentItem.resource)) {
				return false;
			}
			currentItem = currentItem.parent;
		}
		return true;
	}

	private async onConfigurationUpdated(event: IConfigurationChangeEvent): Promise<void> {
		if (!event.affectsConfiguration('explorer')) {
			return;
		}

		let shouldRefresh = false;

		if (event.affectsConfiguration('explorer.fileNesting')) {
			shouldRefresh = true;
		}

		const configuration = this.configurationService.getValue<IFilesConfiguration>();

		const configSortOrder = configuration?.explorer?.sortOrder || SortOrder.Default;
		if (this.config.sortOrder !== configSortOrder) {
			shouldRefresh = this.config.sortOrder !== undefined;
		}

		const configLexicographicOptions = configuration?.explorer?.sortOrderLexicographicOptions || LexicographicOptions.Default;
		if (this.config.sortOrderLexicographicOptions !== configLexicographicOptions) {
			shouldRefresh = shouldRefresh || this.config.sortOrderLexicographicOptions !== undefined;
		}

		this.config = configuration.explorer;

		if (shouldRefresh) {
			await this.refresh();
		}
	}

	dispose(): void {
		this.disposables.dispose();
	}
}

function doesFileEventAffect(item: ExplorerItem, view: IExplorerView, events: FileChangesEvent[], types: FileChangeType[]): boolean {
	for (const [_name, child] of item.children) {
		if (view.isItemVisible(child)) {
			if (events.some(e => e.contains(child.resource, ...types))) {
				return true;
			}
			if (child.isDirectory && child.isDirectoryResolved) {
				if (doesFileEventAffect(child, view, events, types)) {
					return true;
				}
			}
		}
	}

	return false;
}

function getRevealExcludes(configuration: IFilesConfiguration): IExpression {
	const revealExcludes = configuration && configuration.explorer && configuration.explorer.autoRevealExclude;

	if (!revealExcludes) {
		return {};
	}

	return revealExcludes;
}
