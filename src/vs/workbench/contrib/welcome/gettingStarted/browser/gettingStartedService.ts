/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator, optional, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { Emitter, Event } from 'vs/base/common/event';
import { IStorageService, StorageScope, StorageTarget } from 'vs/platform/storage/common/storage';
import { Memento } from 'vs/workbench/common/memento';
import { Action2, registerAction2 } from 'vs/platform/actions/common/actions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ContextKeyExpr, ContextKeyExpression, IContextKeyService, RawContextKey } from 'vs/platform/contextkey/common/contextkey';
import { Disposable } from 'vs/base/common/lifecycle';
import { IUserDataAutoSyncEnablementService } from 'vs/platform/userDataSync/common/userDataSync';
import { IExtensionDescription, IStartEntry } from 'vs/platform/extensions/common/extensions';
import { URI } from 'vs/base/common/uri';
import { joinPath } from 'vs/base/common/resources';
import { FileAccess } from 'vs/base/common/network';
import { DefaultIconPath, IExtensionManagementService } from 'vs/platform/extensionManagement/common/extensionManagement';
import { IProductService } from 'vs/platform/product/common/productService';
import { ThemeIcon } from 'vs/platform/theme/common/themeService';
import { BuiltinGettingStartedCategory, BuiltinGettingStartedStep, BuiltinGettingStartedStartEntry, startEntries, walkthroughs } from 'vs/workbench/contrib/welcome/gettingStarted/common/gettingStartedContent';
import { ITASExperimentService } from 'vs/workbench/services/experiment/common/experimentService';
import { assertIsDefined } from 'vs/base/common/types';
import { IHostService } from 'vs/workbench/services/host/browser/host';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ILink, LinkedText, parseLinkedText } from 'vs/base/common/linkedText';
import { walkthroughsExtensionPoint } from 'vs/workbench/contrib/welcome/gettingStarted/browser/gettingStartedExtensionPoint';
import { registerSingleton } from 'vs/platform/instantiation/common/extensions';
import { dirname } from 'vs/base/common/path';
import { coalesce, flatten } from 'vs/base/common/arrays';
import { IViewsService } from 'vs/workbench/common/views';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { isLinux, isMacintosh, isWindows, OperatingSystem as OS } from 'vs/base/common/platform';
import { localize } from 'vs/nls';

export const WorkspacePlatform = new RawContextKey<'mac' | 'linux' | 'windows' | undefined>('workspacePlatform', undefined, localize('workspacePlatform', "The platform of the current workspace, which in remote contexts may be different from the platform of the UI"));

export const IGettingStartedService = createDecorator<IGettingStartedService>('gettingStartedService');

export const enum GettingStartedCategory {
	Beginner = 'Beginner',
	Intermediate = 'Intermediate',
	Advanced = 'Advanced'
}

type LegacyButtonConfig =
	| { title: string, command?: never, link: string }
	| { title: string, command: string, link?: never, sideBySide?: boolean };

export interface IGettingStartedStep {
	id: string
	title: string
	description: LinkedText[]
	category: GettingStartedCategory | string
	when: ContextKeyExpression
	order: number
	/** @deprecated */
	doneOn?: { commandExecuted: string, eventFired?: never } | { eventFired: string, commandExecuted?: never }
	completionEvents: string[]
	media:
	| { type: 'image', path: { hc: URI, light: URI, dark: URI }, altText: string }
	| { type: 'markdown', path: URI, base: URI, root: URI }
}

export interface IGettingStartedWalkthroughDescriptor {
	id: GettingStartedCategory | string
	title: string
	description: string
	order: number
	next?: string
	icon:
	| { type: 'icon', icon: ThemeIcon }
	| { type: 'image', path: string }
	when: ContextKeyExpression
	content:
	| { type: 'steps' }
}

export interface IGettingStartedStartEntryDescriptor {
	id: GettingStartedCategory | string
	title: string
	description: string
	order: number
	icon:
	| { type: 'icon', icon: ThemeIcon }
	| { type: 'image', path: string }
	when: ContextKeyExpression
	content:
	| { type: 'startEntry', command: string }
}

export interface IGettingStartedCategory {
	id: GettingStartedCategory | string
	title: string
	description: string
	order: number
	next?: string
	icon:
	| { type: 'icon', icon: ThemeIcon }
	| { type: 'image', path: string }
	when: ContextKeyExpression
	content:
	| { type: 'steps', steps: IGettingStartedStep[] }
	| { type: 'startEntry', command: string }
}

type StepProgress = { done?: boolean; };
export interface IGettingStartedStepWithProgress extends IGettingStartedStep, Required<StepProgress> { }

export interface IGettingStartedCategoryWithProgress extends Omit<IGettingStartedCategory, 'content'> {
	content:
	| {
		type: 'steps',
		steps: IGettingStartedStepWithProgress[],
		done: boolean;
		stepsComplete: number
		stepsTotal: number
	}
	| { type: 'startEntry', command: string }
}

export interface IGettingStartedService {
	_serviceBrand: undefined,

	readonly onDidAddCategory: Event<void>
	readonly onDidRemoveCategory: Event<void>

	readonly onDidChangeStep: Event<IGettingStartedStepWithProgress>
	readonly onDidChangeCategory: Event<IGettingStartedCategoryWithProgress>

	readonly onDidProgressStep: Event<IGettingStartedStepWithProgress>

	getCategories(): IGettingStartedCategoryWithProgress[]

	registerWalkthrough(categoryDescriptor: IGettingStartedWalkthroughDescriptor, steps: IGettingStartedStep[]): void;

	progressByEvent(eventName: string): void;
	progressStep(id: string): void;
	deprogressStep(id: string): void;

	installedExtensionsRegistered: Promise<void>;
}

export class GettingStartedService extends Disposable implements IGettingStartedService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidAddCategory = new Emitter<void>();
	onDidAddCategory: Event<void> = this._onDidAddCategory.event;

	private readonly _onDidRemoveCategory = new Emitter<void>();
	onDidRemoveCategory: Event<void> = this._onDidRemoveCategory.event;

	private readonly _onDidChangeCategory = new Emitter<IGettingStartedCategoryWithProgress>();
	onDidChangeCategory: Event<IGettingStartedCategoryWithProgress> = this._onDidChangeCategory.event;

	private readonly _onDidChangeStep = new Emitter<IGettingStartedStepWithProgress>();
	onDidChangeStep: Event<IGettingStartedStepWithProgress> = this._onDidChangeStep.event;

	private readonly _onDidProgressStep = new Emitter<IGettingStartedStepWithProgress>();
	onDidProgressStep: Event<IGettingStartedStepWithProgress> = this._onDidProgressStep.event;

	private memento: Memento;
	private stepProgress: Record<string, StepProgress>;

	private sessionEvents = new Set<string>();
	private completionListeners = new Map<string, Set<string>>();

	private gettingStartedContributions = new Map<string, IGettingStartedCategory>();
	private steps = new Map<string, IGettingStartedStep>();

	private tasExperimentService?: ITASExperimentService;
	private sessionInstalledExtensions = new Set<string>();

	private categoryVisibilityContextKeys = new Set<string>();
	private stepCompletionContextKeyExpressions = new Set<ContextKeyExpression>();
	private stepCompletionContextKeys = new Set<string>();

	private triggerInstalledExtensionsRegistered!: () => void;
	installedExtensionsRegistered: Promise<void>;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ICommandService private readonly commandService: ICommandService,
		@IContextKeyService private readonly contextService: IContextKeyService,
		@IUserDataAutoSyncEnablementService  readonly userDataAutoSyncEnablementService: IUserDataAutoSyncEnablementService,
		@IProductService private readonly productService: IProductService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IHostService private readonly hostService: IHostService,
		@IViewsService private readonly viewsService: IViewsService,
		@IRemoteAgentService private readonly remoteAgentService: IRemoteAgentService,
		@optional(ITASExperimentService) tasExperimentService: ITASExperimentService,
	) {
		super();

		this.tasExperimentService = tasExperimentService;

		this.memento = new Memento('gettingStartedService', this.storageService);
		this.stepProgress = this.memento.getMemento(StorageScope.GLOBAL, StorageTarget.USER);

		walkthroughsExtensionPoint.setHandler((_, { added, removed }) => {
			added.forEach(e => this.registerExtensionContributions(e.description));
			removed.forEach(e => this.unregisterExtensionContributions(e.description));
		});

		this._register(this.commandService.onDidExecuteCommand(command => this.progressByEvent(`onCommand:${command.commandId}`)));

		this.extensionManagementService.getInstalled().then(installed => {
			installed.forEach(ext => this.progressByEvent(`extensionInstalled:${ext.identifier.id.toLowerCase()}`));
		});

		this._register(this.extensionManagementService.onDidInstallExtension(async e => {
			if (await this.hostService.hadLastFocus()) {
				this.sessionInstalledExtensions.add(e.identifier.id.toLowerCase());
			}
			this.progressByEvent(`extensionInstalled:${e.identifier.id.toLowerCase()}`);
		}));

		this._register(this.contextService.onDidChangeContext(event => {
			if (event.affectsSome(this.categoryVisibilityContextKeys)) { this._onDidAddCategory.fire(); }
			if (event.affectsSome(this.stepCompletionContextKeys)) {
				this.stepCompletionContextKeyExpressions.forEach(expression => {
					if (event.affectsSome(new Set(expression.keys())) && this.contextService.contextMatchesRules(expression)) {
						this.progressByEvent(`onContext:` + expression.serialize());
					}
				});
			}
		}));

		this._register(this.viewsService.onDidChangeViewVisibility(e => {
			if (e.visible) { this.progressByEvent('onView:' + e.id); }
		}));

		this._register(this.configurationService.onDidChangeConfiguration(e => {
			e.affectedKeys.forEach(key => { this.progressByEvent('onSettingChanged:' + key); });
		}));

		this.remoteAgentService.getEnvironment().then(env => {
			const remoteOS = env?.os;

			const remotePlatform =
				remoteOS === OS.Macintosh ? 'mac'
					: remoteOS === OS.Windows ? 'windows'
						: remoteOS === OS.Linux ? 'linux'
							: undefined;

			if (remotePlatform) {
				WorkspacePlatform.bindTo(this.contextService).set(remotePlatform);
			} else if (isMacintosh) {
				WorkspacePlatform.bindTo(this.contextService).set('mac');
			} else if (isLinux) {
				WorkspacePlatform.bindTo(this.contextService).set('linux');
			} else if (isWindows) {
				WorkspacePlatform.bindTo(this.contextService).set('windows');
			} else {
				WorkspacePlatform.bindTo(this.contextService).set(undefined);
			}
		});

		if (userDataAutoSyncEnablementService.isEnabled()) { this.progressByEvent('onEvent:sync-enabled'); }
		this._register(userDataAutoSyncEnablementService.onDidChangeEnablement(() => {
			if (userDataAutoSyncEnablementService.isEnabled()) { this.progressByEvent('onEvent:sync-enabled'); }
		}));

		this.installedExtensionsRegistered = new Promise(r => this.triggerInstalledExtensionsRegistered = r);

		startEntries.forEach(async (entry, index) => {
			this.getCategoryOverrides(entry);
			this.registerStartEntry({
				...entry,
				icon: { type: 'icon', icon: entry.icon },
				order: index,
				when: ContextKeyExpr.deserialize(entry.when) ?? ContextKeyExpr.true()
			});
		});

		walkthroughs.forEach(async (category, index) => {
			this.getCategoryOverrides(category);
			this.registerWalkthrough({
				...category,
				icon: { type: 'icon', icon: category.icon },
				order: index,
				when: ContextKeyExpr.deserialize(category.when) ?? ContextKeyExpr.true()
			},
				category.content.steps.map((step, index) => {
					this.getStepOverrides(step, category.id);
					return ({
						...step,
						completionEvents: step.completionEvents ?? [],
						description: parseDescription(step.description),
						category: category.id,
						order: index,
						when: ContextKeyExpr.deserialize(step.when) ?? ContextKeyExpr.true(),
						media: step.media.type === 'image'
							? {
								type: 'image',
								altText: step.media.altText,
								path: convertInternalMediaPathsToBrowserURIs(step.media.path)
							}
							: {
								type: 'markdown',
								path: convertInternalMediaPathToFileURI(step.media.path).with({ query: JSON.stringify({ moduleId: 'vs/workbench/contrib/welcome/gettingStarted/common/media/' + step.media.path }) }),
								base: FileAccess.asFileUri('vs/workbench/contrib/welcome/gettingStarted/common/media/', require),
								root: FileAccess.asFileUri('vs/workbench/contrib/welcome/gettingStarted/common/media/', require),
							},
					});
				}));
		});
	}

	private async getCategoryOverrides(category: BuiltinGettingStartedCategory | BuiltinGettingStartedStartEntry) {
		if (!this.tasExperimentService) { return; }

		const [title, description] = await Promise.all([
			this.tasExperimentService.getTreatment<string>(`gettingStarted.overrideCategory.${category.id}.title`),
			this.tasExperimentService.getTreatment<string>(`gettingStarted.overrideCategory.${category.id}.description`),
		]);

		if (!(title || description)) { return; }

		const existing = assertIsDefined(this.gettingStartedContributions.get(category.id));
		existing.title = title ?? existing.title;
		existing.description = description ?? existing.description;
		this._onDidChangeCategory.fire(this.getCategoryProgress(existing));
	}

	private async getStepOverrides(step: BuiltinGettingStartedStep, categoryId: string) {
		if (!this.tasExperimentService) { return; }

		const [title, description, media] = await Promise.all([
			this.tasExperimentService.getTreatment<string>(`gettingStarted.overrideStep.${step.id}.title`),
			this.tasExperimentService.getTreatment<string>(`gettingStarted.overrideStep.${step.id}.description`),
			this.tasExperimentService.getTreatment<string>(`gettingStarted.overrideStep.${step.id}.media`),
		]);

		if (!(title || description || media)) { return; }

		const existingCategory = assertIsDefined(this.gettingStartedContributions.get(categoryId));
		if (existingCategory.content.type === 'startEntry') { throw Error('Unexpected content type'); }
		const existingStep = assertIsDefined(existingCategory.content.steps.find(_step => _step.id === step.id));

		existingStep.title = title ?? existingStep.title;
		existingStep.description = description ? parseDescription(description) : existingStep.description;
		existingStep.media.path = media ? convertInternalMediaPathsToBrowserURIs(media) : existingStep.media.path;
		this._onDidChangeStep.fire(this.getStepProgress(existingStep));
	}

	private async registerExtensionContributions(extension: IExtensionDescription) {
		const convertExtensionPathToFileURI = (path: string) => path.startsWith('https://')
			? URI.parse(path, true)
			: FileAccess.asFileUri(joinPath(extension.extensionLocation, path));

		const convertExtensionRelativePathsToBrowserURIs = (path: string | { hc: string, dark: string, light: string }): { hc: URI, dark: URI, light: URI } => {
			const convertPath = (path: string) => path.startsWith('https://')
				? URI.parse(path, true)
				: FileAccess.asBrowserUri(joinPath(extension.extensionLocation, path));

			if (typeof path === 'string') {
				const converted = convertPath(path);
				return { hc: converted, dark: converted, light: converted };
			} else {
				return {
					hc: convertPath(path.hc),
					light: convertPath(path.light),
					dark: convertPath(path.dark)
				};
			}
		};

		if (!(extension.contributes?.walkthroughs?.length)) {
			return;
		}

		if (this.configurationService.getValue<boolean>('workbench.welcomePage.experimental.startEntryContributions') && this.productService.quality !== 'stable') {
			extension.contributes.startEntries?.forEach(entry => {
				const entryID = extension.identifier.value + '#startEntry#' + idForStartEntry(entry);
				this.registerStartEntry({
					content: {
						type: 'startEntry',
						command: entry.command,
					},
					description: entry.description,
					title: entry.title,
					id: entryID,
					order: 0,
					when: ContextKeyExpr.deserialize(entry.when) ?? ContextKeyExpr.true(),
					icon: {
						type: 'image',
						path: extension.icon
							? FileAccess.asBrowserUri(joinPath(extension.extensionLocation, extension.icon)).toString(true)
							: DefaultIconPath
					}
				});
			});
		}


		let sectionToOpen: string | undefined;
		let sectionToOpenIndex = Math.min(); // '+Infinity';
		await Promise.all(extension.contributes?.walkthroughs?.map(async (walkthrough, index) => {
			const categoryID = extension.identifier.value + '#' + walkthrough.id;

			const override = await Promise.race([
				this.tasExperimentService?.getTreatment<string>(`gettingStarted.overrideCategory.${categoryID}.when`),
				new Promise<string | undefined>(resolve => setTimeout(() => resolve(walkthrough.when), 5000))
			]);

			if (
				this.sessionInstalledExtensions.has(extension.identifier.value.toLowerCase())
				&& this.contextService.contextMatchesRules(ContextKeyExpr.deserialize(override ?? walkthrough.when) ?? ContextKeyExpr.true())
			) {
				this.sessionInstalledExtensions.delete(extension.identifier.value.toLowerCase());
				if (index < sectionToOpenIndex) {
					sectionToOpen = categoryID;
					sectionToOpenIndex = index;
				}
			}

			const walkthoughDescriptior = {
				content: { type: 'steps' },
				description: walkthrough.description,
				title: walkthrough.title,
				id: categoryID,
				order: Math.min(),
				icon: {
					type: 'image',
					path: extension.icon
						? FileAccess.asBrowserUri(joinPath(extension.extensionLocation, extension.icon)).toString(true)
						: DefaultIconPath
				},
				when: ContextKeyExpr.deserialize(override ?? walkthrough.when) ?? ContextKeyExpr.true(),
			} as const;

			const steps = (walkthrough.steps ?? (walkthrough as any).tasks).map((step, index) => {
				const description = parseDescription(step.description || '');
				const buttonDescription = (step as any as { button: LegacyButtonConfig }).button;
				if (buttonDescription) {
					description.push({ nodes: [{ href: buttonDescription.link ?? `command:${buttonDescription.command}`, label: buttonDescription.title }] });
				}
				const fullyQualifiedID = extension.identifier.value + '#' + walkthrough.id + '#' + step.id;

				let media: IGettingStartedStep['media'];

				if (step.media.image) {
					const altText = (step.media as any).altText;
					if (altText === undefined) {
						console.error('Getting Started: item', fullyQualifiedID, 'is missing altText for its media element.');
					}
					media = { type: 'image', altText, path: convertExtensionRelativePathsToBrowserURIs(step.media.image) };
				}
				else if (step.media.markdown) {
					media = {
						type: 'markdown',
						path: convertExtensionPathToFileURI(step.media.markdown),
						base: convertExtensionPathToFileURI(dirname(step.media.markdown)),
						root: FileAccess.asFileUri(extension.extensionLocation),
					};
				}

				// Legacy media config
				else {
					const legacyMedia = step.media as unknown as { path: string, altText: string };
					if (typeof legacyMedia.path === 'string' && legacyMedia.path.endsWith('.md')) {
						media = {
							type: 'markdown',
							path: convertExtensionPathToFileURI(legacyMedia.path),
							base: convertExtensionPathToFileURI(dirname(legacyMedia.path)),
							root: FileAccess.asFileUri(extension.extensionLocation),
						};
					}
					else {
						const altText = legacyMedia.altText;
						if (altText === undefined) {
							console.error('Getting Started: item', fullyQualifiedID, 'is missing altText for its media element.');
						}
						media = { type: 'image', altText, path: convertExtensionRelativePathsToBrowserURIs(legacyMedia.path) };
					}
				}

				return ({
					description, media,
					completionEvents: step.completionEvents?.filter(x => typeof x === 'string') ?? [],
					id: fullyQualifiedID,
					title: step.title,
					when: ContextKeyExpr.deserialize(step.when) ?? ContextKeyExpr.true(),
					category: categoryID,
					order: index,
				});
			});

			this.registerWalkthrough(walkthoughDescriptior, steps);
		}));

		this.triggerInstalledExtensionsRegistered();

		if (sectionToOpen && this.configurationService.getValue<string>('workbench.welcomePage.walkthroughs.openOnInstall')) {
			this.commandService.executeCommand('workbench.action.openWalkthrough', sectionToOpen);
		}
	}

	private unregisterExtensionContributions(extension: IExtensionDescription) {
		if (!(extension.contributes?.walkthroughs?.length)) {
			return;
		}

		extension.contributes?.startEntries?.forEach(section => {
			const categoryID = extension.identifier.value + '#startEntry#' + idForStartEntry(section);
			this.gettingStartedContributions.delete(categoryID);
			this._onDidRemoveCategory.fire();
		});

		extension.contributes?.walkthroughs?.forEach(section => {
			const categoryID = extension.identifier.value + '#walkthrough#' + section.id;
			section.steps.forEach(step => {
				const fullyQualifiedID = extension.identifier.value + '#' + section.id + '#' + step.id;
				this.steps.delete(fullyQualifiedID);
			});
			this.gettingStartedContributions.delete(categoryID);
			this._onDidRemoveCategory.fire();
		});
	}

	private registerDoneListeners(step: IGettingStartedStep) {
		if (step.doneOn) {
			if (step.doneOn.commandExecuted) { step.completionEvents.push(`onCommand:${step.doneOn.commandExecuted}`); }
			if (step.doneOn.eventFired) { step.completionEvents.push(`onEvent:${step.doneOn.eventFired}`); }
		}

		if (!step.completionEvents.length) {
			step.completionEvents = coalesce(flatten(
				step.description
					.filter(linkedText => linkedText.nodes.length === 1) // only buttons
					.map(linkedText =>
						linkedText.nodes
							.filter(((node): node is ILink => typeof node !== 'string'))
							.map(({ href }) => {
								if (href.startsWith('command:')) {
									return 'onCommand:' + href.slice('command:'.length, href.includes('?') ? href.indexOf('?') : undefined);
								}
								if (href.startsWith('https://') || href.startsWith('http://')) {
									return 'onLink:' + href;
								}
								return undefined;
							}))));
		}

		if (!step.completionEvents.length) {
			step.completionEvents.push('stepSelected');
		}

		for (let event of step.completionEvents) {
			const [_, eventType, argument] = /^([^:]*):?(.*)$/.exec(event) ?? [];

			if (!eventType) {
				console.error(`Unknown completionEvent ${event} when registering step ${step.id}`);
				continue;
			}

			switch (eventType) {
				case 'onLink': case 'onEvent': case 'onView': case 'onSettingChanged':
					break;
				case 'onContext': {
					const expression = ContextKeyExpr.deserialize(argument);
					if (expression) {
						this.stepCompletionContextKeyExpressions.add(expression);
						expression.keys().forEach(key => this.stepCompletionContextKeys.add(key));
						event = eventType + ':' + expression.serialize();
					} else {
						console.error('Unable to parse context key expression:', expression, 'in getting started step', step.id);
					}
					break;
				}
				case 'stepSelected':
					event = eventType + ':' + step.id;
					break;
				case 'onCommand':
					event = eventType + ':' + argument.replace(/^toSide:/, '');
					break;
				case 'extensionInstalled':
					event = eventType + ':' + argument.toLowerCase();
					break;
				default:
					console.error(`Unknown completionEvent ${event} when registering step ${step.id}`);
					continue;
			}

			this.registerCompletionListener(event, step);
			if (this.sessionEvents.has(event)) {
				this.progressStep(step.id);
			}
		}
	}

	private registerCompletionListener(event: string, step: IGettingStartedStep) {
		if (!this.completionListeners.has(event)) {
			this.completionListeners.set(event, new Set());
		}
		this.completionListeners.get(event)?.add(step.id);
	}

	getCategories(): IGettingStartedCategoryWithProgress[] {
		const registeredCategories = [...this.gettingStartedContributions.values()];
		const categoriesWithCompletion = registeredCategories
			.sort((a, b) => a.order - b.order)
			.filter(category => this.contextService.contextMatchesRules(category.when))
			.map(category => {
				if (category.content.type === 'steps') {
					return {
						...category,
						content: {
							type: 'steps' as const,
							steps: category.content.steps.filter(step => this.contextService.contextMatchesRules(step.when))
						}
					};
				}
				return category;
			})
			.filter(category => category.content.type !== 'steps' || category.content.steps.length)
			.map(category => this.getCategoryProgress(category));
		return categoriesWithCompletion;
	}

	private getCategoryProgress(category: IGettingStartedCategory): IGettingStartedCategoryWithProgress {
		if (category.content.type === 'startEntry') {
			return { ...category, content: category.content };
		}

		const stepsWithProgress = category.content.steps.map(step => this.getStepProgress(step));
		const stepsComplete = stepsWithProgress.filter(step => step.done);

		return {
			...category,
			content: {
				type: 'steps',
				steps: stepsWithProgress,
				stepsComplete: stepsComplete.length,
				stepsTotal: stepsWithProgress.length,
				done: stepsComplete.length === stepsWithProgress.length,
			}
		};
	}

	private getStepProgress(step: IGettingStartedStep): IGettingStartedStepWithProgress {
		return {
			...step,
			done: false,
			...this.stepProgress[step.id]
		};
	}

	progressStep(id: string) {
		const oldProgress = this.stepProgress[id];
		if (!oldProgress || oldProgress.done !== true) {
			this.stepProgress[id] = { done: true };
			this.memento.saveMemento();
			const step = this.getStep(id);
			this._onDidProgressStep.fire(this.getStepProgress(step));
		}
	}

	deprogressStep(id: string) {
		delete this.stepProgress[id];
		this.memento.saveMemento();
		const step = this.getStep(id);
		this._onDidProgressStep.fire(this.getStepProgress(step));
	}

	progressByEvent(event: string): void {
		if (this.sessionEvents.has(event)) { return; }

		this.sessionEvents.add(event);
		this.completionListeners.get(event)?.forEach(id => this.progressStep(id));
	}

	private registerStartEntry(categoryDescriptor: IGettingStartedStartEntryDescriptor): void {
		const oldCategory = this.gettingStartedContributions.get(categoryDescriptor.id);
		if (oldCategory) {
			console.error(`Skipping attempt to overwrite getting started category. (${categoryDescriptor})`);
			return;
		}

		const category: IGettingStartedCategory = { ...categoryDescriptor };

		this.gettingStartedContributions.set(categoryDescriptor.id, category);
		this._onDidAddCategory.fire();
	}

	registerWalkthrough(categoryDescriptor: IGettingStartedWalkthroughDescriptor, steps: IGettingStartedStep[]): void {
		const oldCategory = this.gettingStartedContributions.get(categoryDescriptor.id);
		if (oldCategory) {
			console.error(`Skipping attempt to overwrite getting started category. (${categoryDescriptor.id})`);
			return;
		}

		const category: IGettingStartedCategory = { ...categoryDescriptor, content: { type: 'steps', steps } };
		this.gettingStartedContributions.set(categoryDescriptor.id, category);
		steps.forEach(step => {
			if (this.steps.has(step.id)) { throw Error('Attempting to register step with id ' + step.id + ' twice. Second is dropped.'); }
			this.steps.set(step.id, step);
			this.registerDoneListeners(step);
			step.when.keys().forEach(key => this.categoryVisibilityContextKeys.add(key));
		});

		if (this.contextService.contextMatchesRules(category.when)) {
			this._onDidAddCategory.fire();
		}

		this.tasExperimentService?.getTreatment<string>(`gettingStarted.overrideCategory.${categoryDescriptor.id.replace('#', '.')}.when`).then(override => {
			if (override) {
				const old = category.when;
				const gnu = ContextKeyExpr.deserialize(override) ?? old;
				this.categoryVisibilityContextKeys.add(override);
				category.when = gnu;

				if (this.contextService.contextMatchesRules(old) && !this.contextService.contextMatchesRules(gnu)) {
					this._onDidRemoveCategory.fire();
				} else if (!this.contextService.contextMatchesRules(old) && this.contextService.contextMatchesRules(gnu)) {
					this._onDidAddCategory.fire();
				}
			}
		});
		category.when.keys().forEach(key => this.categoryVisibilityContextKeys.add(key));
	}

	private getStep(id: string): IGettingStartedStep {
		const step = this.steps.get(id);
		if (!step) { throw Error('Attempting to access step which does not exist in registry ' + id); }
		return step;
	}
}

const idForStartEntry = (entry: IStartEntry): string => `${entry.title}#${entry.command}`;

const parseDescription = (desc: string): LinkedText[] => desc.split('\n').filter(x => x).map(text => parseLinkedText(text));


const convertInternalMediaPathToFileURI = (path: string) => path.startsWith('https://')
	? URI.parse(path, true)
	: FileAccess.asFileUri('vs/workbench/contrib/welcome/gettingStarted/common/media/' + path, require);

const convertInternalMediaPathsToBrowserURIs = (path: string | { hc: string, dark: string, light: string }): { hc: URI, dark: URI, light: URI } => {
	const convertInternalMediaPathToBrowserURI = (path: string) => path.startsWith('https://')
		? URI.parse(path, true)
		: FileAccess.asBrowserUri('vs/workbench/contrib/welcome/gettingStarted/common/media/' + path, require);
	if (typeof path === 'string') {
		const converted = convertInternalMediaPathToBrowserURI(path);
		return { hc: converted, dark: converted, light: converted };
	} else {
		return {
			hc: convertInternalMediaPathToBrowserURI(path.hc),
			light: convertInternalMediaPathToBrowserURI(path.light),
			dark: convertInternalMediaPathToBrowserURI(path.dark)
		};
	}
};

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'resetGettingStartedProgress',
			category: 'Getting Started',
			title: 'Reset Progress',
			f1: true
		});
	}

	run(accessor: ServicesAccessor) {
		const gettingStartedService = accessor.get(IGettingStartedService);
		const memento = new Memento('gettingStartedService', accessor.get(IStorageService));
		const record = memento.getMemento(StorageScope.GLOBAL, StorageTarget.USER);
		for (const key in record) {
			if (Object.prototype.hasOwnProperty.call(record, key)) {
				try {
					gettingStartedService.deprogressStep(key);
				} catch (e) {
					console.error(e);
				}
			}
		}
		memento.saveMemento();
	}
});

registerSingleton(IGettingStartedService, GettingStartedService);
