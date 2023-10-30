/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Registry } from 'vs/platform/registry/common/platform';
import { IViewsRegistry, Extensions, ITreeViewDescriptor, ITreeViewDataProvider, ITreeItem, TreeItemCollapsibleState, TreeViewItemHandleArg, ViewContainer } from 'vs/workbench/common/views';
import { localize } from 'vs/nls';
import { SyncDescriptor } from 'vs/platform/instantiation/common/descriptors';
import { TreeView, TreeViewPane } from 'vs/workbench/browser/parts/views/treeView';
import { IInstantiationService, ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { ALL_SYNC_RESOURCES, IUserDataSyncService, ISyncResourceHandle as IResourceHandle, SyncStatus, IUserDataSyncEnablementService, IUserDataAutoSyncService, UserDataSyncError, UserDataSyncErrorCode, getLastSyncResourceUri, SyncResource, ISyncUserDataProfile, USER_DATA_SYNC_LOG_ID } from 'vs/platform/userDataSync/common/userDataSync';
import { registerAction2, Action2, MenuId } from 'vs/platform/actions/common/actions';
import { ContextKeyExpr } from 'vs/platform/contextkey/common/contextkey';
import { URI, UriDto } from 'vs/base/common/uri';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { FolderThemeIcon } from 'vs/platform/theme/common/themeService';
import { fromNow } from 'vs/base/common/date';
import { IDialogService } from 'vs/platform/dialogs/common/dialogs';
import { Event } from 'vs/base/common/event';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { Codicon } from 'vs/base/common/codicons';
import { Action } from 'vs/base/common/actions';
import { IUserDataSyncWorkbenchService, CONTEXT_SYNC_STATE, getSyncAreaLabel, CONTEXT_ACCOUNT_STATE, AccountStatus, CONTEXT_ENABLE_ACTIVITY_VIEWS, SYNC_TITLE, SYNC_CONFLICTS_VIEW_ID, CONTEXT_ENABLE_SYNC_CONFLICTS_VIEW, CONTEXT_HAS_CONFLICTS } from 'vs/workbench/services/userDataSync/common/userDataSync';
import { IUserDataSyncMachinesService, IUserDataSyncMachine, isWebPlatform } from 'vs/platform/userDataSync/common/userDataSyncMachines';
import { IQuickInputService } from 'vs/platform/quickinput/common/quickInput';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { basename } from 'vs/base/common/resources';
import { API_OPEN_DIFF_EDITOR_COMMAND_ID, API_OPEN_EDITOR_COMMAND_ID } from 'vs/workbench/browser/parts/editor/editorCommands';
import { IFileService } from 'vs/platform/files/common/files';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { IUriIdentityService } from 'vs/platform/uriIdentity/common/uriIdentity';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IUserDataProfile, IUserDataProfilesService } from 'vs/platform/userDataProfile/common/userDataProfile';
import { UserDataSyncConflictsViewPane } from 'vs/workbench/contrib/userDataSync/browser/userDataSyncConflictsView';

export class UserDataSyncDataViews extends Disposable {

	constructor(
		container: ViewContainer,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IUserDataSyncEnablementService private readonly userDataSyncEnablementService: IUserDataSyncEnablementService,
		@IUserDataSyncMachinesService private readonly userDataSyncMachinesService: IUserDataSyncMachinesService,
		@IUserDataSyncService private readonly userDataSyncService: IUserDataSyncService,
	) {
		super();
		this.registerViews(container);
	}

	private registerViews(container: ViewContainer): void {
		this.registerConflictsView(container);

		this.registerActivityView(container, true);
		this.registerMachinesView(container);

		this.registerActivityView(container, false);
		this.registerTroubleShootView(container);
	}

	private registerConflictsView(container: ViewContainer): void {
		const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);
		const viewName = localize('conflicts', "Conflicts");
		viewsRegistry.registerViews([<ITreeViewDescriptor>{
			id: SYNC_CONFLICTS_VIEW_ID,
			name: viewName,
			ctorDescriptor: new SyncDescriptor(UserDataSyncConflictsViewPane),
			when: ContextKeyExpr.and(CONTEXT_ENABLE_SYNC_CONFLICTS_VIEW, CONTEXT_HAS_CONFLICTS),
			canToggleVisibility: false,
			canMoveView: false,
			treeView: this.instantiationService.createInstance(TreeView, SYNC_CONFLICTS_VIEW_ID, viewName),
			collapsed: false,
			order: 100,
		}], container);
	}

	private registerMachinesView(container: ViewContainer): void {
		const id = `workbench.views.sync.machines`;
		const name = localize('synced machines', "Synced Machines");
		const treeView = this.instantiationService.createInstance(TreeView, id, name);
		const dataProvider = this.instantiationService.createInstance(UserDataSyncMachinesViewDataProvider, treeView);
		treeView.showRefreshAction = true;
		treeView.canSelectMany = true;
		treeView.dataProvider = dataProvider;

		this._register(Event.any(this.userDataSyncMachinesService.onDidChange, this.userDataSyncService.onDidResetRemote)(() => treeView.refresh()));
		const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);
		viewsRegistry.registerViews([<ITreeViewDescriptor>{
			id,
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized), CONTEXT_ACCOUNT_STATE.isEqualTo(AccountStatus.Available), CONTEXT_ENABLE_ACTIVITY_VIEWS),
			canToggleVisibility: true,
			canMoveView: false,
			treeView,
			collapsed: false,
			order: 300,
		}], container);

		registerAction2(class extends Action2 {
			constructor() {
				super({
					id: `workbench.actions.sync.editMachineName`,
					title: localize('workbench.actions.sync.editMachineName', "Edit Name"),
					icon: Codicon.edit,
					menu: {
						id: MenuId.ViewItemContext,
						when: ContextKeyExpr.and(ContextKeyExpr.equals('view', id)),
						group: 'inline',
					},
				});
			}
			async run(accessor: ServicesAccessor, handle: TreeViewItemHandleArg): Promise<void> {
				const changed = await dataProvider.rename(handle.$treeItemHandle);
				if (changed) {
					await treeView.refresh();
				}
			}
		});

		registerAction2(class extends Action2 {
			constructor() {
				super({
					id: `workbench.actions.sync.turnOffSyncOnMachine`,
					title: localize('workbench.actions.sync.turnOffSyncOnMachine', "Turn off Settings Sync"),
					menu: {
						id: MenuId.ViewItemContext,
						when: ContextKeyExpr.and(ContextKeyExpr.equals('view', id), ContextKeyExpr.equals('viewItem', 'sync-machine')),
					},
				});
			}
			async run(accessor: ServicesAccessor, handle: TreeViewItemHandleArg, selected?: TreeViewItemHandleArg[]): Promise<void> {
				if (await dataProvider.disable((selected || [handle]).map(handle => handle.$treeItemHandle))) {
					await treeView.refresh();
				}
			}
		});

	}

	private registerActivityView(container: ViewContainer, remote: boolean): void {
		const id = `workbench.views.sync.${remote ? 'remote' : 'local'}Activity`;
		const name = remote ? localize('remote sync activity title', "Sync Activity (Remote)") : localize('local sync activity title', "Sync Activity (Local)");
		const treeView = this.instantiationService.createInstance(TreeView, id, name);
		treeView.showCollapseAllAction = true;
		treeView.showRefreshAction = true;
		treeView.dataProvider = remote ? this.instantiationService.createInstance(RemoteUserDataSyncActivityViewDataProvider)
			: this.instantiationService.createInstance(LocalUserDataSyncActivityViewDataProvider);

		this._register(Event.any(this.userDataSyncEnablementService.onDidChangeResourceEnablement,
			this.userDataSyncEnablementService.onDidChangeEnablement,
			this.userDataSyncService.onDidResetLocal,
			this.userDataSyncService.onDidResetRemote)(() => treeView.refresh()));
		const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);
		viewsRegistry.registerViews([<ITreeViewDescriptor>{
			id,
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			when: ContextKeyExpr.and(CONTEXT_SYNC_STATE.notEqualsTo(SyncStatus.Uninitialized), CONTEXT_ACCOUNT_STATE.isEqualTo(AccountStatus.Available), CONTEXT_ENABLE_ACTIVITY_VIEWS),
			canToggleVisibility: true,
			canMoveView: false,
			treeView,
			collapsed: false,
			order: remote ? 200 : 400,
			hideByDefault: !remote,
		}], container);

		this.registerDataViewActions(id);
	}

	private registerDataViewActions(viewId: string) {
		registerAction2(class extends Action2 {
			constructor() {
				super({
					id: `workbench.actions.sync.resolveResource`,
					title: localize('workbench.actions.sync.resolveResourceRef', "Show raw JSON sync data"),
					menu: {
						id: MenuId.ViewItemContext,
						when: ContextKeyExpr.and(ContextKeyExpr.equals('view', viewId), ContextKeyExpr.regex('viewItem', /sync-resource-.*/i))
					},
				});
			}
			async run(accessor: ServicesAccessor, handle: TreeViewItemHandleArg): Promise<void> {
				const { resource } = <{ resource: string }>JSON.parse(handle.$treeItemHandle);
				const editorService = accessor.get(IEditorService);
				await editorService.openEditor({ resource: URI.parse(resource), options: { pinned: true } });
			}
		});

		registerAction2(class extends Action2 {
			constructor() {
				super({
					id: `workbench.actions.sync.compareWithLocal`,
					title: localize('workbench.actions.sync.compareWithLocal', "Compare with Local"),
					menu: {
						id: MenuId.ViewItemContext,
						when: ContextKeyExpr.and(ContextKeyExpr.equals('view', viewId), ContextKeyExpr.regex('viewItem', /sync-associatedResource-.*/i))
					},
				});
			}
			async run(accessor: ServicesAccessor, handle: TreeViewItemHandleArg): Promise<void> {
				const commandService = accessor.get(ICommandService);
				const { resource, comparableResource } = <{ resource: string; comparableResource: string }>JSON.parse(handle.$treeItemHandle);
				const remoteResource = URI.parse(resource);
				const localResource = URI.parse(comparableResource);
				return commandService.executeCommand(API_OPEN_DIFF_EDITOR_COMMAND_ID,
					remoteResource,
					localResource,
					localize('remoteToLocalDiff', "{0} ↔ {1}", localize({ key: 'leftResourceName', comment: ['remote as in file in cloud'] }, "{0} (Remote)", basename(remoteResource)), localize({ key: 'rightResourceName', comment: ['local as in file in disk'] }, "{0} (Local)", basename(localResource))),
					undefined
				);
			}
		});

		registerAction2(class extends Action2 {
			constructor() {
				super({
					id: `workbench.actions.sync.replaceCurrent`,
					title: localize('workbench.actions.sync.replaceCurrent', "Restore"),
					icon: Codicon.discard,
					menu: {
						id: MenuId.ViewItemContext,
						when: ContextKeyExpr.and(ContextKeyExpr.equals('view', viewId), ContextKeyExpr.regex('viewItem', /sync-resource-.*/i)),
						group: 'inline',
					},
				});
			}
			async run(accessor: ServicesAccessor, handle: TreeViewItemHandleArg): Promise<void> {
				const dialogService = accessor.get(IDialogService);
				const userDataSyncService = accessor.get(IUserDataSyncService);
				const { syncResourceHandle, syncResource } = <{ syncResourceHandle: UriDto<ISyncResourceHandle>; syncResource: SyncResource }>JSON.parse(handle.$treeItemHandle);
				const result = await dialogService.confirm({
					message: localize({ key: 'confirm replace', comment: ['A confirmation message to replace current user data (settings, extensions, keybindings, snippets) with selected version'] }, "Would you like to replace your current {0} with selected?", getSyncAreaLabel(syncResource)),
					type: 'info',
					title: SYNC_TITLE
				});
				if (result.confirmed) {
					return userDataSyncService.replace({ created: syncResourceHandle.created, uri: URI.revive(syncResourceHandle.uri) });
				}
			}
		});

	}

	private registerTroubleShootView(container: ViewContainer): void {
		const id = `workbench.views.sync.troubleshoot`;
		const name = localize('troubleshoot', "Troubleshoot");
		const treeView = this.instantiationService.createInstance(TreeView, id, name);
		const dataProvider = this.instantiationService.createInstance(UserDataSyncTroubleshootViewDataProvider);
		treeView.showRefreshAction = true;
		treeView.dataProvider = dataProvider;

		const viewsRegistry = Registry.as<IViewsRegistry>(Extensions.ViewsRegistry);
		viewsRegistry.registerViews([<ITreeViewDescriptor>{
			id,
			name,
			ctorDescriptor: new SyncDescriptor(TreeViewPane),
			when: CONTEXT_ENABLE_ACTIVITY_VIEWS,
			canToggleVisibility: true,
			canMoveView: false,
			treeView,
			collapsed: false,
			order: 500,
			hideByDefault: true
		}], container);

	}

}

type Profile = IUserDataProfile | ISyncUserDataProfile;

interface ISyncResourceHandle extends IResourceHandle {
	profileId?: string;
	syncResource: SyncResource;
	previous?: IResourceHandle;
}

interface SyncResourceHandleTreeItem extends ITreeItem {
	syncResourceHandle: ISyncResourceHandle;
}

interface ProfileTreeItem extends ITreeItem {
	profile: Profile;
}

abstract class UserDataSyncActivityViewDataProvider<T = Profile> implements ITreeViewDataProvider {

	private readonly syncResourceHandlesByProfile = new Map<string, Promise<SyncResourceHandleTreeItem[]>>();

	constructor(
		@IUserDataSyncService protected readonly userDataSyncService: IUserDataSyncService,
		@IUserDataAutoSyncService protected readonly userDataAutoSyncService: IUserDataAutoSyncService,
		@IUserDataSyncWorkbenchService private readonly userDataSyncWorkbenchService: IUserDataSyncWorkbenchService,
		@INotificationService private readonly notificationService: INotificationService,
		@IUserDataProfilesService protected readonly userDataProfilesService: IUserDataProfilesService,
	) { }

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {
		try {
			if (!element) {
				return await this.getRoots();
			}
			if ((<ProfileTreeItem>element).profile || element.handle === this.userDataProfilesService.defaultProfile.id) {
				let promise = this.syncResourceHandlesByProfile.get(element.handle);
				if (!promise) {
					this.syncResourceHandlesByProfile.set(element.handle, promise = this.getSyncResourceHandles(<T>(<ProfileTreeItem>element).profile));
				}
				return await promise;
			}
			if ((<SyncResourceHandleTreeItem>element).syncResourceHandle) {
				return await this.getChildrenForSyncResourceTreeItem(<SyncResourceHandleTreeItem>element);
			}
			return [];
		} catch (error) {
			if (!(error instanceof UserDataSyncError)) {
				error = UserDataSyncError.toUserDataSyncError(error);
			}
			if (error instanceof UserDataSyncError && error.code === UserDataSyncErrorCode.IncompatibleRemoteContent) {
				this.notificationService.notify({
					severity: Severity.Error,
					message: error.message,
					actions: {
						primary: [
							new Action('reset', localize('reset', "Reset Synced Data"), undefined, true, () => this.userDataSyncWorkbenchService.resetSyncedData()),
						]
					}
				});
			} else {
				this.notificationService.error(error);
			}
			throw error;
		}
	}

	private async getRoots(): Promise<ITreeItem[]> {
		this.syncResourceHandlesByProfile.clear();

		const roots: ITreeItem[] = [];

		const profiles = await this.getProfiles();
		if (profiles.length) {
			const profileTreeItem = {
				handle: this.userDataProfilesService.defaultProfile.id,
				label: { label: this.userDataProfilesService.defaultProfile.name },
				collapsibleState: TreeItemCollapsibleState.Expanded,
			};
			roots.push(profileTreeItem);
		} else {
			const defaultSyncResourceHandles = await this.getSyncResourceHandles();
			roots.push(...defaultSyncResourceHandles);
		}

		for (const profile of profiles) {
			const profileTreeItem: ProfileTreeItem = {
				handle: profile.id,
				label: { label: profile.name },
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				profile,
			};
			roots.push(profileTreeItem);
		}

		return roots;
	}

	protected async getChildrenForSyncResourceTreeItem(element: SyncResourceHandleTreeItem): Promise<ITreeItem[]> {
		const syncResourceHandle = (<SyncResourceHandleTreeItem>element).syncResourceHandle;
		const associatedResources = await this.userDataSyncService.getAssociatedResources(syncResourceHandle);
		const previousAssociatedResources = syncResourceHandle.previous ? await this.userDataSyncService.getAssociatedResources(syncResourceHandle.previous) : [];
		return associatedResources.map(({ resource, comparableResource }) => {
			const handle = JSON.stringify({ resource: resource.toString(), comparableResource: comparableResource.toString() });
			const previousResource = previousAssociatedResources.find(previous => basename(previous.resource) === basename(resource))?.resource;
			return {
				handle,
				collapsibleState: TreeItemCollapsibleState.None,
				resourceUri: resource,
				command: previousResource ? {
					id: API_OPEN_DIFF_EDITOR_COMMAND_ID,
					title: '',
					arguments: [
						previousResource,
						resource,
						localize('sideBySideLabels', "{0} ↔ {1}", `${basename(resource)} (${fromNow(syncResourceHandle.previous!.created, true)})`, `${basename(resource)} (${fromNow(syncResourceHandle.created, true)})`),
						undefined
					]
				} : {
					id: API_OPEN_EDITOR_COMMAND_ID,
					title: '',
					arguments: [resource, undefined, undefined]
				},
				contextValue: `sync-associatedResource-${syncResourceHandle.syncResource}`
			};
		});
	}

	private async getSyncResourceHandles(profile?: T): Promise<SyncResourceHandleTreeItem[]> {
		const treeItems: SyncResourceHandleTreeItem[] = [];
		const result = await Promise.all(ALL_SYNC_RESOURCES.map(async syncResource => {
			const resourceHandles = await this.getResourceHandles(syncResource, profile);
			return resourceHandles.map((resourceHandle, index) => ({ ...resourceHandle, syncResource, previous: resourceHandles[index + 1] }));
		}));
		const syncResourceHandles = result.flat().sort((a, b) => b.created - a.created);
		for (const syncResourceHandle of syncResourceHandles) {
			const handle = JSON.stringify({ syncResourceHandle, syncResource: syncResourceHandle.syncResource });
			treeItems.push({
				handle,
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				label: { label: getSyncAreaLabel(syncResourceHandle.syncResource) },
				description: fromNow(syncResourceHandle.created, true),
				themeIcon: FolderThemeIcon,
				syncResourceHandle,
				contextValue: `sync-resource-${syncResourceHandle.syncResource}`
			});
		}
		return treeItems;
	}

	protected abstract getProfiles(): Promise<Profile[]>;
	protected abstract getResourceHandles(syncResource: SyncResource, profile?: T): Promise<IResourceHandle[]>;
}

class LocalUserDataSyncActivityViewDataProvider extends UserDataSyncActivityViewDataProvider<IUserDataProfile> {

	protected getResourceHandles(syncResource: SyncResource, profile: IUserDataProfile | undefined): Promise<IResourceHandle[]> {
		return this.userDataSyncService.getLocalSyncResourceHandles(syncResource, profile);
	}

	protected async getProfiles(): Promise<IUserDataProfile[]> {
		return this.userDataProfilesService.profiles.filter(p => !p.isDefault);
	}
}

class RemoteUserDataSyncActivityViewDataProvider extends UserDataSyncActivityViewDataProvider<ISyncUserDataProfile> {

	private machinesPromise: Promise<IUserDataSyncMachine[]> | undefined;

	constructor(
		@IUserDataSyncService userDataSyncService: IUserDataSyncService,
		@IUserDataAutoSyncService userDataAutoSyncService: IUserDataAutoSyncService,
		@IUserDataSyncMachinesService private readonly userDataSyncMachinesService: IUserDataSyncMachinesService,
		@IUserDataSyncWorkbenchService userDataSyncWorkbenchService: IUserDataSyncWorkbenchService,
		@INotificationService notificationService: INotificationService,
		@IUserDataProfilesService userDataProfilesService: IUserDataProfilesService,
	) {
		super(userDataSyncService, userDataAutoSyncService, userDataSyncWorkbenchService, notificationService, userDataProfilesService);
	}

	override async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {
		if (!element) {
			this.machinesPromise = undefined;
		}
		return super.getChildren(element);
	}

	private getMachines(): Promise<IUserDataSyncMachine[]> {
		if (this.machinesPromise === undefined) {
			this.machinesPromise = this.userDataSyncMachinesService.getMachines();
		}
		return this.machinesPromise;
	}

	protected getResourceHandles(syncResource: SyncResource, profile?: ISyncUserDataProfile): Promise<IResourceHandle[]> {
		return this.userDataSyncService.getRemoteSyncResourceHandles(syncResource, profile);
	}

	protected getProfiles(): Promise<ISyncUserDataProfile[]> {
		return this.userDataSyncService.getRemoteProfiles();
	}

	protected override async getChildrenForSyncResourceTreeItem(element: SyncResourceHandleTreeItem): Promise<ITreeItem[]> {
		const children = await super.getChildrenForSyncResourceTreeItem(element);
		if (children.length) {
			const machineId = await this.userDataSyncService.getMachineId(element.syncResourceHandle);
			if (machineId) {
				const machines = await this.getMachines();
				const machine = machines.find(({ id }) => id === machineId);
				children[0].description = machine?.isCurrent ? localize({ key: 'current', comment: ['Represents current machine'] }, "Current") : machine?.name;
			}
		}
		return children;
	}
}

class UserDataSyncMachinesViewDataProvider implements ITreeViewDataProvider {

	private machinesPromise: Promise<IUserDataSyncMachine[]> | undefined;

	constructor(
		private readonly treeView: TreeView,
		@IUserDataSyncMachinesService private readonly userDataSyncMachinesService: IUserDataSyncMachinesService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
		@INotificationService private readonly notificationService: INotificationService,
		@IDialogService private readonly dialogService: IDialogService,
		@IUserDataSyncWorkbenchService private readonly userDataSyncWorkbenchService: IUserDataSyncWorkbenchService,
	) {
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {
		if (!element) {
			this.machinesPromise = undefined;
		}
		try {
			let machines = await this.getMachines();
			machines = machines.filter(m => !m.disabled).sort((m1, m2) => m1.isCurrent ? -1 : 1);
			this.treeView.message = machines.length ? undefined : localize('no machines', "No Machines");
			return machines.map(({ id, name, isCurrent, platform }) => ({
				handle: id,
				collapsibleState: TreeItemCollapsibleState.None,
				label: { label: name },
				description: isCurrent ? localize({ key: 'current', comment: ['Current machine'] }, "Current") : undefined,
				themeIcon: platform && isWebPlatform(platform) ? Codicon.globe : Codicon.vm,
				contextValue: 'sync-machine'
			}));
		} catch (error) {
			this.notificationService.error(error);
			return [];
		}
	}

	private getMachines(): Promise<IUserDataSyncMachine[]> {
		if (this.machinesPromise === undefined) {
			this.machinesPromise = this.userDataSyncMachinesService.getMachines();
		}
		return this.machinesPromise;
	}

	async disable(machineIds: string[]): Promise<boolean> {
		const machines = await this.getMachines();
		const machinesToDisable = machines.filter(({ id }) => machineIds.includes(id));
		if (!machinesToDisable.length) {
			throw new Error(localize('not found', "machine not found with id: {0}", machineIds.join(',')));
		}

		const result = await this.dialogService.confirm({
			type: 'info',
			message: machinesToDisable.length > 1 ? localize('turn off sync on multiple machines', "Are you sure you want to turn off sync on selected machines?")
				: localize('turn off sync on machine', "Are you sure you want to turn off sync on {0}?", machinesToDisable[0].name),
			primaryButton: localize({ key: 'turn off', comment: ['&& denotes a mnemonic'] }, "&&Turn off"),
		});

		if (!result.confirmed) {
			return false;
		}

		if (machinesToDisable.some(machine => machine.isCurrent)) {
			await this.userDataSyncWorkbenchService.turnoff(false);
		}

		const otherMachinesToDisable: [string, boolean][] = machinesToDisable.filter(machine => !machine.isCurrent)
			.map(machine => ([machine.id, false]));
		if (otherMachinesToDisable.length) {
			await this.userDataSyncMachinesService.setEnablements(otherMachinesToDisable);
		}

		return true;
	}

	async rename(machineId: string): Promise<boolean> {
		const disposableStore = new DisposableStore();
		const inputBox = disposableStore.add(this.quickInputService.createInputBox());
		inputBox.placeholder = localize('placeholder', "Enter the name of the machine");
		inputBox.busy = true;
		inputBox.show();
		const machines = await this.getMachines();
		const machine = machines.find(({ id }) => id === machineId);
		if (!machine) {
			inputBox.hide();
			disposableStore.dispose();
			throw new Error(localize('not found', "machine not found with id: {0}", machineId));
		}
		inputBox.busy = false;
		inputBox.value = machine.name;
		const validateMachineName = (machineName: string): string | null => {
			machineName = machineName.trim();
			return machineName && !machines.some(m => m.id !== machineId && m.name === machineName) ? machineName : null;
		};
		disposableStore.add(inputBox.onDidChangeValue(() =>
			inputBox.validationMessage = validateMachineName(inputBox.value) ? '' : localize('valid message', "Machine name should be unique and not empty")));
		return new Promise<boolean>((c, e) => {
			disposableStore.add(inputBox.onDidAccept(async () => {
				const machineName = validateMachineName(inputBox.value);
				disposableStore.dispose();
				if (machineName && machineName !== machine.name) {
					try {
						await this.userDataSyncMachinesService.renameMachine(machineId, machineName);
						c(true);
					} catch (error) {
						e(error);
					}
				} else {
					c(false);
				}
			}));
		});
	}
}

class UserDataSyncTroubleshootViewDataProvider implements ITreeViewDataProvider {

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
	) {
	}

	async getChildren(element?: ITreeItem): Promise<ITreeItem[]> {
		if (!element) {
			return [{
				handle: 'SYNC_LOGS',
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				label: { label: localize('sync logs', "Logs") },
				themeIcon: Codicon.folder,
			}, {
				handle: 'LAST_SYNC_STATES',
				collapsibleState: TreeItemCollapsibleState.Collapsed,
				label: { label: localize('last sync states', "Last Synced Remotes") },
				themeIcon: Codicon.folder,
			}];
		}

		if (element.handle === 'LAST_SYNC_STATES') {
			return this.getLastSyncStates();
		}

		if (element.handle === 'SYNC_LOGS') {
			return this.getSyncLogs();
		}

		return [];
	}

	private async getLastSyncStates(): Promise<ITreeItem[]> {
		const result: ITreeItem[] = [];
		for (const syncResource of ALL_SYNC_RESOURCES) {
			const resource = getLastSyncResourceUri(undefined, syncResource, this.environmentService, this.uriIdentityService.extUri);
			if (await this.fileService.exists(resource)) {
				result.push({
					handle: resource.toString(),
					label: { label: getSyncAreaLabel(syncResource) },
					collapsibleState: TreeItemCollapsibleState.None,
					resourceUri: resource,
					command: { id: API_OPEN_EDITOR_COMMAND_ID, title: '', arguments: [resource, undefined, undefined] },
				});
			}
		}
		return result;
	}

	private async getSyncLogs(): Promise<ITreeItem[]> {
		const logsFolders: URI[] = [];
		const stat = await this.fileService.resolve(this.uriIdentityService.extUri.dirname(this.uriIdentityService.extUri.dirname(this.environmentService.logsHome)));
		if (stat.children) {
			logsFolders.push(...stat.children
				.filter(stat => stat.isDirectory && /^\d{8}T\d{6}$/.test(stat.name))
				.sort()
				.reverse()
				.map(d => d.resource));
		}

		const result: ITreeItem[] = [];
		for (const logFolder of logsFolders) {
			const folderStat = await this.fileService.resolve(logFolder);
			const childStat = folderStat.children?.find(stat => this.uriIdentityService.extUri.basename(stat.resource).startsWith(`${USER_DATA_SYNC_LOG_ID}.`));
			if (childStat) {
				const syncLogResource = childStat.resource;
				result.push({
					handle: syncLogResource.toString(),
					collapsibleState: TreeItemCollapsibleState.None,
					resourceUri: syncLogResource,
					label: { label: this.uriIdentityService.extUri.basename(logFolder) },
					description: this.uriIdentityService.extUri.isEqual(logFolder, this.environmentService.logsHome) ? localize({ key: 'current', comment: ['Represents current log file'] }, "Current") : undefined,
					command: { id: API_OPEN_EDITOR_COMMAND_ID, title: '', arguments: [syncLogResource, undefined, undefined] },
				});
			}
		}
		return result;
	}

}
