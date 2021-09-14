/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import { basename } from 'vs/base/common/resources';
import { IDisposable, dispose, Disposable, DisposableStore, combinedDisposable, MutableDisposable } from 'vs/base/common/lifecycle';
import { Event } from 'vs/base/common/event';
import { VIEW_PANE_ID, ISCMService, ISCMRepository, ISCMViewService } from 'vs/workbench/contrib/scm/common/scm';
import { IActivityService, NumberBadge } from 'vs/workbench/services/activity/common/activity';
import { IWorkbenchContribution } from 'vs/workbench/common/contributions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IStatusbarService, StatusbarAlignment as MainThreadStatusBarAlignment } from 'vs/workbench/services/statusbar/common/statusbar';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { EditorResourceAccessor } from 'vs/workbench/common/editor';
import { IUriIdentityService } from 'vs/workbench/services/uriIdentity/common/uriIdentity';
import { stripIcons } from 'vs/base/common/iconLabels';

function getCount(repository: ISCMRepository): number {
	if (typeof repository.provider.count === 'number') {
		return repository.provider.count;
	} else {
		return repository.provider.groups.elements.reduce<number>((r, g) => r + g.elements.length, 0);
	}
}

export class SCMStatusController implements IWorkbenchContribution {

	private statusBarDisposable: IDisposable = Disposable.None;
	private focusDisposable: IDisposable = Disposable.None;
	private focusedRepository: ISCMRepository | undefined = undefined;
	private readonly badgeDisposable = new MutableDisposable<IDisposable>();
	private disposables = new DisposableStore();
	private repositoryDisposables = new Set<IDisposable>();

	constructor(
		@ISCMService private readonly scmService: ISCMService,
		@ISCMViewService private readonly scmViewService: ISCMViewService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IContextKeyService readonly contextKeyService: IContextKeyService,
		@IActivityService private readonly activityService: IActivityService,
		@IEditorService private readonly editorService: IEditorService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService
	) {
		this.scmService.onDidAddRepository(this.onDidAddRepository, this, this.disposables);
		this.scmService.onDidRemoveRepository(this.onDidRemoveRepository, this, this.disposables);

		const onDidChangeSCMCountBadge = Event.filter(configurationService.onDidChangeConfiguration, e => e.affectsConfiguration('scm.countBadge'));
		onDidChangeSCMCountBadge(this.renderActivityCount, this, this.disposables);

		for (const repository of this.scmService.repositories) {
			this.onDidAddRepository(repository);
		}

		this.scmViewService.onDidFocusRepository(this.focusRepository, this, this.disposables);
		this.focusRepository(this.scmViewService.focusedRepository);

		editorService.onDidActiveEditorChange(this.tryFocusRepositoryBasedOnActiveEditor, this, this.disposables);
		this.renderActivityCount();
	}

	private tryFocusRepositoryBasedOnActiveEditor(): boolean {
		const resource = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor);

		if (!resource) {
			return false;
		}

		let bestRepository: ISCMRepository | null = null;
		let bestMatchLength = Number.POSITIVE_INFINITY;

		for (const repository of this.scmService.repositories) {
			const root = repository.provider.rootUri;

			if (!root) {
				continue;
			}

			const path = this.uriIdentityService.extUri.relativePath(root, resource);

			if (path && !/^\.\./.test(path) && path.length < bestMatchLength) {
				bestRepository = repository;
				bestMatchLength = path.length;
			}
		}

		if (!bestRepository) {
			return false;
		}

		this.focusRepository(bestRepository);
		return true;
	}

	private onDidAddRepository(repository: ISCMRepository): void {
		const onDidChange = Event.any(repository.provider.onDidChange, repository.provider.onDidChangeResources);
		const changeDisposable = onDidChange(() => this.renderActivityCount());

		const onDidRemove = Event.filter(this.scmService.onDidRemoveRepository, e => e === repository);
		const removeDisposable = onDidRemove(() => {
			disposable.dispose();
			this.repositoryDisposables.delete(disposable);
			this.renderActivityCount();
		});

		const disposable = combinedDisposable(changeDisposable, removeDisposable);
		this.repositoryDisposables.add(disposable);
	}

	private onDidRemoveRepository(repository: ISCMRepository): void {
		if (this.focusedRepository !== repository) {
			return;
		}

		this.focusRepository(this.scmService.repositories[0]);
	}

	private focusRepository(repository: ISCMRepository | undefined): void {
		if (this.focusedRepository === repository) {
			return;
		}

		this.focusDisposable.dispose();
		this.focusedRepository = repository;

		if (repository && repository.provider.onDidChangeStatusBarCommands) {
			this.focusDisposable = repository.provider.onDidChangeStatusBarCommands(() => this.renderStatusBar(repository));
		}

		this.renderStatusBar(repository);
		this.renderActivityCount();
	}

	private renderStatusBar(repository: ISCMRepository | undefined): void {
		this.statusBarDisposable.dispose();

		if (!repository) {
			return;
		}

		const commands = repository.provider.statusBarCommands || [];
		const label = repository.provider.rootUri
			? `${basename(repository.provider.rootUri)} (${repository.provider.label})`
			: repository.provider.label;

		const disposables = new DisposableStore();
		for (const command of commands) {
			const tooltip = `${label}${command.tooltip ? ` - ${command.tooltip}` : ''}`;

			let ariaLabel = stripIcons(command.title).trim();
			ariaLabel = ariaLabel ? `${ariaLabel}, ${label}` : label;

			disposables.add(this.statusbarService.addEntry({
				name: localize('status.scm', "Source Control"),
				text: command.title,
				ariaLabel: `${ariaLabel}${command.tooltip ? ` - ${command.tooltip}` : ''}`,
				tooltip,
				command: command.id ? command : undefined
			}, 'status.scm', MainThreadStatusBarAlignment.LEFT, 10000));
		}

		this.statusBarDisposable = disposables;
	}

	private renderActivityCount(): void {
		const countBadgeType = this.configurationService.getValue<'all' | 'focused' | 'off'>('scm.countBadge');

		let count = 0;

		if (countBadgeType === 'all') {
			count = this.scmService.repositories.reduce((r, repository) => r + getCount(repository), 0);
		} else if (countBadgeType === 'focused' && this.focusedRepository) {
			count = getCount(this.focusedRepository);
		}

		if (count > 0) {
			const badge = new NumberBadge(count, num => localize('scmPendingChangesBadge', '{0} pending changes', num));
			this.badgeDisposable.value = this.activityService.showViewActivity(VIEW_PANE_ID, { badge, clazz: 'scm-viewlet-label' });
		} else {
			this.badgeDisposable.value = undefined;
		}
	}

	dispose(): void {
		this.focusDisposable.dispose();
		this.statusBarDisposable.dispose();
		this.badgeDisposable.dispose();
		this.disposables = dispose(this.disposables);
		dispose(this.repositoryDisposables.values());
		this.repositoryDisposables.clear();
	}
}
