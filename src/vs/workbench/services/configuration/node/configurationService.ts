/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from 'vs/base/common/uri';
import * as assert from 'vs/base/common/assert';
import { Event, Emitter } from 'vs/base/common/event';
import { ResourceMap } from 'vs/base/common/map';
import { equals, deepClone } from 'vs/base/common/objects';
import { Disposable } from 'vs/base/common/lifecycle';
import { Queue, Barrier } from 'vs/base/common/async';
import { writeFile } from 'vs/base/node/pfs';
import { IJSONContributionRegistry, Extensions as JSONExtensions } from 'vs/platform/jsonschemas/common/jsonContributionRegistry';
import { IWorkspaceContextService, Workspace, WorkbenchState, IWorkspaceFolder, toWorkspaceFolders, IWorkspaceFoldersChangeEvent, WorkspaceFolder } from 'vs/platform/workspace/common/workspace';
import { isLinux } from 'vs/base/common/platform';
import { IFileService } from 'vs/platform/files/common/files';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { ConfigurationChangeEvent, ConfigurationModel, DefaultConfigurationModel } from 'vs/platform/configuration/common/configurationModels';
import { IConfigurationChangeEvent, ConfigurationTarget, IConfigurationOverrides, keyFromOverrideIdentifier, isConfigurationOverrides, IConfigurationData, IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { Configuration, WorkspaceConfigurationChangeEvent, AllKeysConfigurationChangeEvent } from 'vs/workbench/services/configuration/common/configurationModels';
import { FOLDER_CONFIG_FOLDER_NAME, defaultSettingsSchemaId, userSettingsSchemaId, workspaceSettingsSchemaId, folderSettingsSchemaId } from 'vs/workbench/services/configuration/common/configuration';
import { Registry } from 'vs/platform/registry/common/platform';
import { IConfigurationNode, IConfigurationRegistry, Extensions, IConfigurationPropertySchema, allSettings, windowSettings, resourceSettings, applicationSettings } from 'vs/platform/configuration/common/configurationRegistry';
import { IWorkspaceIdentifier, isWorkspaceIdentifier, IStoredWorkspaceFolder, isStoredWorkspaceFolder, IWorkspaceFolderCreationData, ISingleFolderWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier, IWorkspaceInitializationPayload, isSingleFolderWorkspaceInitializationPayload, ISingleFolderWorkspaceInitializationPayload, IEmptyWorkspaceInitializationPayload, useSlashForPath, getStoredWorkspaceFolder } from 'vs/platform/workspaces/common/workspaces';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { ICommandService } from 'vs/platform/commands/common/commands';
import product from 'vs/platform/product/node/product';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ConfigurationEditingService } from 'vs/workbench/services/configuration/common/configurationEditingService';
import { WorkspaceConfiguration, FolderConfiguration, RemoteUserConfiguration, LocalUserConfiguration } from 'vs/workbench/services/configuration/node/configuration';
import { JSONEditingService } from 'vs/workbench/services/configuration/common/jsonEditingService';
import { IJSONSchema, IJSONSchemaMap } from 'vs/base/common/jsonSchema';
import { localize } from 'vs/nls';
import { isEqual, dirname } from 'vs/base/common/resources';
import { mark } from 'vs/base/common/performance';
import { Schemas } from 'vs/base/common/network';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { IWindowConfiguration } from 'vs/platform/windows/common/windows';

export class WorkspaceService extends Disposable implements IConfigurationService, IWorkspaceContextService {

	public _serviceBrand: any;

	private workspace: Workspace;
	private completeWorkspaceBarrier: Barrier;
	private _configuration: Configuration;
	private defaultConfiguration: DefaultConfigurationModel;
	private localUserConfiguration: LocalUserConfiguration;
	private remoteUserConfiguration: RemoteUserConfiguration | null = null;
	private workspaceConfiguration: WorkspaceConfiguration;
	private cachedFolderConfigs: ResourceMap<FolderConfiguration>;

	private workspaceEditingQueue: Queue<void>;

	protected readonly _onDidChangeConfiguration: Emitter<IConfigurationChangeEvent> = this._register(new Emitter<IConfigurationChangeEvent>());
	public readonly onDidChangeConfiguration: Event<IConfigurationChangeEvent> = this._onDidChangeConfiguration.event;

	protected readonly _onDidChangeWorkspaceFolders: Emitter<IWorkspaceFoldersChangeEvent> = this._register(new Emitter<IWorkspaceFoldersChangeEvent>());
	public readonly onDidChangeWorkspaceFolders: Event<IWorkspaceFoldersChangeEvent> = this._onDidChangeWorkspaceFolders.event;

	protected readonly _onDidChangeWorkspaceName: Emitter<void> = this._register(new Emitter<void>());
	public readonly onDidChangeWorkspaceName: Event<void> = this._onDidChangeWorkspaceName.event;

	protected readonly _onDidChangeWorkbenchState: Emitter<WorkbenchState> = this._register(new Emitter<WorkbenchState>());
	public readonly onDidChangeWorkbenchState: Event<WorkbenchState> = this._onDidChangeWorkbenchState.event;

	private fileService: IFileService;
	private configurationEditingService: ConfigurationEditingService;
	private jsonEditingService: JSONEditingService;

	constructor(configuration: IWindowConfiguration, private environmentService: IEnvironmentService, private remoteAgentService: IRemoteAgentService, private workspaceSettingsRootFolder: string = FOLDER_CONFIG_FOLDER_NAME) {
		super();

		this.completeWorkspaceBarrier = new Barrier();
		this.defaultConfiguration = new DefaultConfigurationModel();
		this.localUserConfiguration = this._register(new LocalUserConfiguration(environmentService));
		this._register(this.localUserConfiguration.onDidChangeConfiguration(userConfiguration => this.onLocalUserConfigurationChanged(userConfiguration)));
		if (configuration.remoteAuthority) {
			this.remoteUserConfiguration = this._register(new RemoteUserConfiguration(configuration.remoteAuthority, environmentService));
			this._register(this.remoteUserConfiguration.onDidChangeConfiguration(userConfiguration => this.onRemoteUserConfigurationChanged(userConfiguration)));
		}
		this.workspaceConfiguration = this._register(new WorkspaceConfiguration(environmentService));
		this._register(this.workspaceConfiguration.onDidUpdateConfiguration(() => this.onWorkspaceConfigurationChanged()));

		this._register(Registry.as<IConfigurationRegistry>(Extensions.Configuration).onDidSchemaChange(e => this.registerConfigurationSchemas()));
		this._register(Registry.as<IConfigurationRegistry>(Extensions.Configuration).onDidUpdateConfiguration(configurationProperties => this.onDefaultConfigurationChanged(configurationProperties)));

		this.workspaceEditingQueue = new Queue<void>();
	}

	// Workspace Context Service Impl

	public getCompleteWorkspace(): Promise<Workspace> {
		return this.completeWorkspaceBarrier.wait().then(() => this.getWorkspace());
	}

	public getWorkspace(): Workspace {
		return this.workspace;
	}

	public getWorkbenchState(): WorkbenchState {
		// Workspace has configuration file
		if (this.workspace.configuration) {
			return WorkbenchState.WORKSPACE;
		}

		// Folder has single root
		if (this.workspace.folders.length === 1) {
			return WorkbenchState.FOLDER;
		}

		// Empty
		return WorkbenchState.EMPTY;
	}

	public getWorkspaceFolder(resource: URI): IWorkspaceFolder | null {
		return this.workspace.getFolder(resource);
	}

	public addFolders(foldersToAdd: IWorkspaceFolderCreationData[], index?: number): Promise<void> {
		return this.updateFolders(foldersToAdd, [], index);
	}

	public removeFolders(foldersToRemove: URI[]): Promise<void> {
		return this.updateFolders([], foldersToRemove);
	}

	public updateFolders(foldersToAdd: IWorkspaceFolderCreationData[], foldersToRemove: URI[], index?: number): Promise<void> {
		assert.ok(this.jsonEditingService, 'Workbench is not initialized yet');
		return Promise.resolve(this.workspaceEditingQueue.queue(() => this.doUpdateFolders(foldersToAdd, foldersToRemove, index)));
	}

	public isInsideWorkspace(resource: URI): boolean {
		return !!this.getWorkspaceFolder(resource);
	}

	public isCurrentWorkspace(workspaceIdentifier: ISingleFolderWorkspaceIdentifier | IWorkspaceIdentifier): boolean {
		switch (this.getWorkbenchState()) {
			case WorkbenchState.FOLDER:
				return isSingleFolderWorkspaceIdentifier(workspaceIdentifier) && isEqual(workspaceIdentifier, this.workspace.folders[0].uri);
			case WorkbenchState.WORKSPACE:
				return isWorkspaceIdentifier(workspaceIdentifier) && this.workspace.id === workspaceIdentifier.id;
		}
		return false;
	}

	private doUpdateFolders(foldersToAdd: IWorkspaceFolderCreationData[], foldersToRemove: URI[], index?: number): Promise<void> {
		if (this.getWorkbenchState() !== WorkbenchState.WORKSPACE) {
			return Promise.resolve(undefined); // we need a workspace to begin with
		}

		if (foldersToAdd.length + foldersToRemove.length === 0) {
			return Promise.resolve(undefined); // nothing to do
		}

		let foldersHaveChanged = false;

		// Remove first (if any)
		let currentWorkspaceFolders = this.getWorkspace().folders;
		let newStoredFolders: IStoredWorkspaceFolder[] = currentWorkspaceFolders.map(f => f.raw).filter((folder, index): folder is IStoredWorkspaceFolder => {
			if (!isStoredWorkspaceFolder(folder)) {
				return true; // keep entries which are unrelated
			}

			return !this.contains(foldersToRemove, currentWorkspaceFolders[index].uri); // keep entries which are unrelated
		});

		const slashForPath = useSlashForPath(newStoredFolders);

		foldersHaveChanged = currentWorkspaceFolders.length !== newStoredFolders.length;

		// Add afterwards (if any)
		if (foldersToAdd.length) {

			// Recompute current workspace folders if we have folders to add
			const workspaceConfigFolder = dirname(this.getWorkspace().configuration!);
			currentWorkspaceFolders = toWorkspaceFolders(newStoredFolders, workspaceConfigFolder);
			const currentWorkspaceFolderUris = currentWorkspaceFolders.map(folder => folder.uri);

			const storedFoldersToAdd: IStoredWorkspaceFolder[] = [];

			foldersToAdd.forEach(folderToAdd => {
				const folderURI = folderToAdd.uri;
				if (this.contains(currentWorkspaceFolderUris, folderURI)) {
					return; // already existing
				}
				storedFoldersToAdd.push(getStoredWorkspaceFolder(folderURI, folderToAdd.name, workspaceConfigFolder, slashForPath));
			});

			// Apply to array of newStoredFolders
			if (storedFoldersToAdd.length > 0) {
				foldersHaveChanged = true;

				if (typeof index === 'number' && index >= 0 && index < newStoredFolders.length) {
					newStoredFolders = newStoredFolders.slice(0);
					newStoredFolders.splice(index, 0, ...storedFoldersToAdd);
				} else {
					newStoredFolders = [...newStoredFolders, ...storedFoldersToAdd];
				}
			}
		}

		// Set folders if we recorded a change
		if (foldersHaveChanged) {
			return this.setFolders(newStoredFolders);
		}

		return Promise.resolve(undefined);
	}

	private setFolders(folders: IStoredWorkspaceFolder[]): Promise<void> {
		return this.workspaceConfiguration.setFolders(folders, this.jsonEditingService)
			.then(() => this.onWorkspaceConfigurationChanged());
	}

	private contains(resources: URI[], toCheck: URI): boolean {
		return resources.some(resource => {
			if (isLinux) {
				return resource.toString() === toCheck.toString();
			}

			return resource.toString().toLowerCase() === toCheck.toString().toLowerCase();
		});
	}

	// Workspace Configuration Service Impl

	getConfigurationData(): IConfigurationData {
		const configurationData = this._configuration.toData();
		configurationData.isComplete = this.cachedFolderConfigs.values().every(c => c.loaded);
		return configurationData;
	}

	getValue<T>(): T;
	getValue<T>(section: string): T;
	getValue<T>(overrides: IConfigurationOverrides): T;
	getValue<T>(section: string, overrides: IConfigurationOverrides): T;
	getValue(arg1?: any, arg2?: any): any {
		const section = typeof arg1 === 'string' ? arg1 : undefined;
		const overrides = isConfigurationOverrides(arg1) ? arg1 : isConfigurationOverrides(arg2) ? arg2 : undefined;
		return this._configuration.getValue(section, overrides);
	}

	updateValue(key: string, value: any): Promise<void>;
	updateValue(key: string, value: any, overrides: IConfigurationOverrides): Promise<void>;
	updateValue(key: string, value: any, target: ConfigurationTarget): Promise<void>;
	updateValue(key: string, value: any, overrides: IConfigurationOverrides, target: ConfigurationTarget): Promise<void>;
	updateValue(key: string, value: any, overrides: IConfigurationOverrides, target: ConfigurationTarget, donotNotifyError: boolean): Promise<void>;
	updateValue(key: string, value: any, arg3?: any, arg4?: any, donotNotifyError?: any): Promise<void> {
		assert.ok(this.configurationEditingService, 'Workbench is not initialized yet');
		const overrides = isConfigurationOverrides(arg3) ? arg3 : undefined;
		const target = this.deriveConfigurationTarget(key, value, overrides, overrides ? arg4 : arg3);
		return target ? this.writeConfigurationValue(key, value, target, overrides, donotNotifyError)
			: Promise.resolve();
	}

	reloadConfiguration(folder?: IWorkspaceFolder, key?: string): Promise<void> {
		if (folder) {
			return this.reloadWorkspaceFolderConfiguration(folder, key);
		}
		return this.reloadUserConfiguration()
			.then(({ local, remote }) => this.reloadWorkspaceConfiguration()
				.then(() => this.loadConfiguration(local, remote)));
	}

	inspect<T>(key: string, overrides?: IConfigurationOverrides): {
		default: T,
		user: T,
		workspace?: T,
		workspaceFolder?: T,
		memory?: T,
		value: T
	} {
		return this._configuration.inspect<T>(key, overrides);
	}

	keys(): {
		default: string[];
		user: string[];
		workspace: string[];
		workspaceFolder: string[];
	} {
		return this._configuration.keys();
	}

	initialize(arg: IWorkspaceInitializationPayload, postInitialisationTask: () => void = () => null): Promise<any> {
		mark('willInitWorkspaceService');
		return this.createWorkspace(arg)
			.then(workspace => this.updateWorkspaceAndInitializeConfiguration(workspace, postInitialisationTask)).then(() => {
				mark('didInitWorkspaceService');
			});
	}

	acquireFileService(fileService: IFileService): void {
		this.fileService = fileService;
		const changedWorkspaceFolders: IWorkspaceFolder[] = [];
		this.localUserConfiguration.adopt(fileService);
		Promise.all([this.workspaceConfiguration.adopt(fileService), ...this.cachedFolderConfigs.values()
			.map(folderConfiguration => folderConfiguration.adopt(fileService)
				.then(result => {
					if (result) {
						changedWorkspaceFolders.push(folderConfiguration.workspaceFolder);
					}
					return result;
				}))])
			.then(([workspaceChanged]) => {
				if (workspaceChanged) {
					this.onWorkspaceConfigurationChanged();
				}
				for (const workspaceFolder of changedWorkspaceFolders) {
					this.onWorkspaceFolderConfigurationChanged(workspaceFolder);
				}
				this.releaseWorkspaceBarrier();
			});
		if (this.remoteUserConfiguration) {
			this.remoteAgentService.getEnvironment()
				.then(environment => this.remoteUserConfiguration!.adopt(environment ? environment.appSettingsPath : null, fileService)
					.then(changedModel => {
						if (changedModel) {
							this.onRemoteUserConfigurationChanged(changedModel);
						}
					}));
		}
	}

	acquireInstantiationService(instantiationService: IInstantiationService): void {
		this.configurationEditingService = instantiationService.createInstance(ConfigurationEditingService);
		this.jsonEditingService = instantiationService.createInstance(JSONEditingService);
	}

	private createWorkspace(arg: IWorkspaceInitializationPayload): Promise<Workspace> {
		if (isWorkspaceIdentifier(arg)) {
			return this.createMultiFolderWorkspace(arg);
		}

		if (isSingleFolderWorkspaceInitializationPayload(arg)) {
			return this.createSingleFolderWorkspace(arg);
		}

		return this.createEmptyWorkspace(arg);
	}

	private createMultiFolderWorkspace(workspaceIdentifier: IWorkspaceIdentifier): Promise<Workspace> {
		return this.workspaceConfiguration.load({ id: workspaceIdentifier.id, configPath: workspaceIdentifier.configPath })
			.then(() => {
				const workspaceConfigPath = workspaceIdentifier.configPath;
				const workspaceFolders = toWorkspaceFolders(this.workspaceConfiguration.getFolders(), dirname(workspaceConfigPath));
				const workspaceId = workspaceIdentifier.id;
				const workspace = new Workspace(workspaceId, workspaceFolders, workspaceConfigPath);
				if (workspace.configuration!.scheme === Schemas.file) {
					this.releaseWorkspaceBarrier(); // Release barrier as workspace is complete because it is from disk.
				}
				return workspace;
			});
	}

	private createSingleFolderWorkspace(singleFolder: ISingleFolderWorkspaceInitializationPayload): Promise<Workspace> {
		const folder = singleFolder.folder;

		let configuredFolders: IStoredWorkspaceFolder[];
		if (folder.scheme === 'file') {
			configuredFolders = [{ path: folder.fsPath }];
		} else {
			configuredFolders = [{ uri: folder.toString() }];
		}

		const workspace = new Workspace(singleFolder.id, toWorkspaceFolders(configuredFolders));
		this.releaseWorkspaceBarrier(); // Release barrier as workspace is complete because it is single folder.
		return Promise.resolve(workspace);
	}

	private createEmptyWorkspace(emptyWorkspace: IEmptyWorkspaceInitializationPayload): Promise<Workspace> {
		const workspace = new Workspace(emptyWorkspace.id);
		this.releaseWorkspaceBarrier(); // Release barrier as workspace is complete because it is an empty workspace.
		return Promise.resolve(workspace);
	}

	private releaseWorkspaceBarrier(): void {
		if (!this.completeWorkspaceBarrier.isOpen()) {
			this.completeWorkspaceBarrier.open();
		}
	}

	private updateWorkspaceAndInitializeConfiguration(workspace: Workspace, postInitialisationTask: () => void): Promise<void> {
		const hasWorkspaceBefore = !!this.workspace;
		let previousState: WorkbenchState;
		let previousWorkspacePath: string | undefined;
		let previousFolders: WorkspaceFolder[];

		if (hasWorkspaceBefore) {
			previousState = this.getWorkbenchState();
			previousWorkspacePath = this.workspace.configuration ? this.workspace.configuration.fsPath : undefined;
			previousFolders = this.workspace.folders;
			this.workspace.update(workspace);
		} else {
			this.workspace = workspace;
		}

		return this.initializeConfiguration().then(() => {

			postInitialisationTask(); // Post initialisation task should be run before triggering events.

			// Trigger changes after configuration initialization so that configuration is up to date.
			if (hasWorkspaceBefore) {
				const newState = this.getWorkbenchState();
				if (previousState && newState !== previousState) {
					this._onDidChangeWorkbenchState.fire(newState);
				}

				const newWorkspacePath = this.workspace.configuration ? this.workspace.configuration.fsPath : undefined;
				if (previousWorkspacePath && newWorkspacePath !== previousWorkspacePath || newState !== previousState) {
					this._onDidChangeWorkspaceName.fire();
				}

				const folderChanges = this.compareFolders(previousFolders, this.workspace.folders);
				if (folderChanges && (folderChanges.added.length || folderChanges.removed.length || folderChanges.changed.length)) {
					this._onDidChangeWorkspaceFolders.fire(folderChanges);
				}
			}
		});
	}

	private compareFolders(currentFolders: IWorkspaceFolder[], newFolders: IWorkspaceFolder[]): IWorkspaceFoldersChangeEvent {
		const result = { added: [], removed: [], changed: [] } as IWorkspaceFoldersChangeEvent;
		result.added = newFolders.filter(newFolder => !currentFolders.some(currentFolder => newFolder.uri.toString() === currentFolder.uri.toString()));
		for (let currentIndex = 0; currentIndex < currentFolders.length; currentIndex++) {
			let currentFolder = currentFolders[currentIndex];
			let newIndex = 0;
			for (newIndex = 0; newIndex < newFolders.length && currentFolder.uri.toString() !== newFolders[newIndex].uri.toString(); newIndex++) { }
			if (newIndex < newFolders.length) {
				if (currentIndex !== newIndex || currentFolder.name !== newFolders[newIndex].name) {
					result.changed.push(currentFolder);
				}
			} else {
				result.removed.push(currentFolder);
			}
		}
		return result;
	}

	private initializeConfiguration(): Promise<void> {
		this.registerConfigurationSchemas();
		return this.initializeUserConfiguration()
			.then(({ local, remote }) => this.loadConfiguration(local, remote));
	}

	private initializeUserConfiguration(): Promise<{ local: ConfigurationModel, remote: ConfigurationModel }> {
		return Promise.all([this.localUserConfiguration.initialize(), this.remoteUserConfiguration ? this.remoteUserConfiguration.initialize() : Promise.resolve(new ConfigurationModel())])
			.then(([local, remote]) => ({ local, remote }));
	}

	private reloadUserConfiguration(key?: string): Promise<{ local: ConfigurationModel, remote: ConfigurationModel }> {
		return Promise.all([this.localUserConfiguration.reload(), this.remoteUserConfiguration ? this.remoteUserConfiguration.reload() : Promise.resolve(new ConfigurationModel())])
			.then(([local, remote]) => ({ local, remote }));
	}

	private reloadWorkspaceConfiguration(key?: string): Promise<void> {
		const workbenchState = this.getWorkbenchState();
		if (workbenchState === WorkbenchState.FOLDER) {
			return this.onWorkspaceFolderConfigurationChanged(this.workspace.folders[0], key);
		}
		if (workbenchState === WorkbenchState.WORKSPACE) {
			return this.workspaceConfiguration.reload().then(() => this.onWorkspaceConfigurationChanged());
		}
		return Promise.resolve(undefined);
	}

	private reloadWorkspaceFolderConfiguration(folder: IWorkspaceFolder, key?: string): Promise<void> {
		return this.onWorkspaceFolderConfigurationChanged(folder, key);
	}

	private loadConfiguration(userConfigurationModel: ConfigurationModel, remoteUserConfigurationModel: ConfigurationModel): Promise<void> {
		// reset caches
		this.cachedFolderConfigs = new ResourceMap<FolderConfiguration>();

		const folders = this.workspace.folders;
		return this.loadFolderConfigurations(folders)
			.then((folderConfigurations) => {

				let workspaceConfiguration = this.getWorkspaceConfigurationModel(folderConfigurations);
				const folderConfigurationModels = new ResourceMap<ConfigurationModel>();
				folderConfigurations.forEach((folderConfiguration, index) => folderConfigurationModels.set(folders[index].uri, folderConfiguration));

				const currentConfiguration = this._configuration;
				this._configuration = new Configuration(this.defaultConfiguration, userConfigurationModel, remoteUserConfigurationModel, workspaceConfiguration, folderConfigurationModels, new ConfigurationModel(), new ResourceMap<ConfigurationModel>(), this.workspace);

				if (currentConfiguration) {
					const changedKeys = this._configuration.compare(currentConfiguration);
					this.triggerConfigurationChange(new ConfigurationChangeEvent().change(changedKeys), ConfigurationTarget.WORKSPACE);
				} else {
					this._onDidChangeConfiguration.fire(new AllKeysConfigurationChangeEvent(this._configuration, ConfigurationTarget.WORKSPACE, this.getTargetConfiguration(ConfigurationTarget.WORKSPACE)));
				}
			});
	}

	private getWorkspaceConfigurationModel(folderConfigurations: ConfigurationModel[]): ConfigurationModel {
		switch (this.getWorkbenchState()) {
			case WorkbenchState.FOLDER:
				return folderConfigurations[0];
			case WorkbenchState.WORKSPACE:
				return this.workspaceConfiguration.getConfiguration();
			default:
				return new ConfigurationModel();
		}
	}

	private onDefaultConfigurationChanged(keys: string[]): void {
		this.defaultConfiguration = new DefaultConfigurationModel();
		this.registerConfigurationSchemas();
		if (this.workspace && this._configuration) {
			this._configuration.updateDefaultConfiguration(this.defaultConfiguration);
			if (this.getWorkbenchState() === WorkbenchState.FOLDER) {
				this._configuration.updateWorkspaceConfiguration(this.cachedFolderConfigs.get(this.workspace.folders[0].uri)!.reprocess());
			} else {
				this._configuration.updateWorkspaceConfiguration(this.workspaceConfiguration.reprocessWorkspaceSettings());
				this.workspace.folders.forEach(folder => this._configuration.updateFolderConfiguration(folder.uri, this.cachedFolderConfigs.get(folder.uri)!.reprocess()));
			}
			this.triggerConfigurationChange(new ConfigurationChangeEvent().change(keys), ConfigurationTarget.DEFAULT);
		}
	}

	private registerConfigurationSchemas(): void {
		if (this.workspace) {
			const jsonRegistry = Registry.as<IJSONContributionRegistry>(JSONExtensions.JSONContribution);
			const convertToNotSuggestedProperties = (properties: IJSONSchemaMap, errorMessage: string): IJSONSchemaMap => {
				return Object.keys(properties).reduce((result: IJSONSchemaMap, property) => {
					result[property] = deepClone(properties[property]);
					result[property].deprecationMessage = errorMessage;
					return result;
				}, {});
			};

			const allSettingsSchema: IJSONSchema = { properties: allSettings.properties, patternProperties: allSettings.patternProperties, additionalProperties: false, errorMessage: 'Unknown configuration setting' };
			const unsupportedApplicationSettings = convertToNotSuggestedProperties(applicationSettings.properties, localize('unsupportedApplicationSetting', "This setting can be applied only in User Settings"));
			const workspaceSettingsSchema: IJSONSchema = { properties: { ...unsupportedApplicationSettings, ...windowSettings.properties, ...resourceSettings.properties }, patternProperties: allSettings.patternProperties, additionalProperties: false, errorMessage: 'Unknown configuration setting' };

			jsonRegistry.registerSchema(defaultSettingsSchemaId, allSettingsSchema);
			jsonRegistry.registerSchema(userSettingsSchemaId, allSettingsSchema);

			if (WorkbenchState.WORKSPACE === this.getWorkbenchState()) {
				const unsupportedWindowSettings = convertToNotSuggestedProperties(windowSettings.properties, localize('unsupportedWindowSetting', "This setting cannot be applied now. It will be applied when you open this folder directly."));
				const folderSettingsSchema: IJSONSchema = { properties: { ...unsupportedApplicationSettings, ...unsupportedWindowSettings, ...resourceSettings.properties }, patternProperties: allSettings.patternProperties, additionalProperties: false, errorMessage: 'Unknown configuration setting' };
				jsonRegistry.registerSchema(workspaceSettingsSchemaId, workspaceSettingsSchema);
				jsonRegistry.registerSchema(folderSettingsSchemaId, folderSettingsSchema);
			} else {
				jsonRegistry.registerSchema(workspaceSettingsSchemaId, workspaceSettingsSchema);
				jsonRegistry.registerSchema(folderSettingsSchemaId, workspaceSettingsSchema);
			}
		}
	}

	private onLocalUserConfigurationChanged(userConfiguration: ConfigurationModel): void {
		const keys = this._configuration.compareAndUpdateLocalUserConfiguration(userConfiguration);
		this.triggerConfigurationChange(keys, ConfigurationTarget.USER);
	}

	private onRemoteUserConfigurationChanged(userConfiguration: ConfigurationModel): void {
		const keys = this._configuration.compareAndUpdateRemoteUserConfiguration(userConfiguration);
		this.triggerConfigurationChange(keys, ConfigurationTarget.USER);
	}

	private onWorkspaceConfigurationChanged(): Promise<void> {
		if (this.workspace && this.workspace.configuration && this._configuration) {
			const workspaceConfigurationChangeEvent = this._configuration.compareAndUpdateWorkspaceConfiguration(this.workspaceConfiguration.getConfiguration());
			let configuredFolders = toWorkspaceFolders(this.workspaceConfiguration.getFolders(), dirname(this.workspace.configuration));
			const changes = this.compareFolders(this.workspace.folders, configuredFolders);
			if (changes.added.length || changes.removed.length || changes.changed.length) {
				this.workspace.folders = configuredFolders;
				return this.onFoldersChanged()
					.then(foldersConfigurationChangeEvent => {
						this.triggerConfigurationChange(foldersConfigurationChangeEvent.change(workspaceConfigurationChangeEvent), ConfigurationTarget.WORKSPACE_FOLDER);
						this._onDidChangeWorkspaceFolders.fire(changes);
					});
			} else {
				this.triggerConfigurationChange(workspaceConfigurationChangeEvent, ConfigurationTarget.WORKSPACE);
			}
		}
		return Promise.resolve(undefined);
	}

	private onWorkspaceFolderConfigurationChanged(folder: IWorkspaceFolder, key?: string): Promise<void> {
		return this.loadFolderConfigurations([folder])
			.then(([folderConfiguration]) => {
				const folderChangedKeys = this._configuration.compareAndUpdateFolderConfiguration(folder.uri, folderConfiguration);
				if (this.getWorkbenchState() === WorkbenchState.FOLDER) {
					const workspaceChangedKeys = this._configuration.compareAndUpdateWorkspaceConfiguration(folderConfiguration);
					this.triggerConfigurationChange(workspaceChangedKeys, ConfigurationTarget.WORKSPACE);
				} else {
					this.triggerConfigurationChange(folderChangedKeys, ConfigurationTarget.WORKSPACE_FOLDER);
				}
			});
	}

	private onFoldersChanged(): Promise<ConfigurationChangeEvent> {
		let changeEvent = new ConfigurationChangeEvent();

		// Remove the configurations of deleted folders
		for (const key of this.cachedFolderConfigs.keys()) {
			if (!this.workspace.folders.filter(folder => folder.uri.toString() === key.toString())[0]) {
				const folderConfiguration = this.cachedFolderConfigs.get(key);
				folderConfiguration!.dispose();
				this.cachedFolderConfigs.delete(key);
				changeEvent = changeEvent.change(this._configuration.compareAndDeleteFolderConfiguration(key));
			}
		}

		const toInitialize = this.workspace.folders.filter(folder => !this.cachedFolderConfigs.has(folder.uri));
		if (toInitialize.length) {
			return this.loadFolderConfigurations(toInitialize)
				.then(folderConfigurations => {
					folderConfigurations.forEach((folderConfiguration, index) => {
						changeEvent = changeEvent.change(this._configuration.compareAndUpdateFolderConfiguration(toInitialize[index].uri, folderConfiguration));
					});
					return changeEvent;
				});
		}
		return Promise.resolve(changeEvent);
	}

	private loadFolderConfigurations(folders: IWorkspaceFolder[]): Promise<ConfigurationModel[]> {
		return Promise.all([...folders.map(folder => {
			let folderConfiguration = this.cachedFolderConfigs.get(folder.uri);
			if (!folderConfiguration) {
				folderConfiguration = new FolderConfiguration(folder, this.workspaceSettingsRootFolder, this.getWorkbenchState(), this.environmentService, this.fileService);
				this._register(folderConfiguration.onDidChange(() => this.onWorkspaceFolderConfigurationChanged(folder)));
				this.cachedFolderConfigs.set(folder.uri, this._register(folderConfiguration));
			}
			return folderConfiguration.loadConfiguration();
		})]);
	}

	private writeConfigurationValue(key: string, value: any, target: ConfigurationTarget, overrides: IConfigurationOverrides | undefined, donotNotifyError: boolean): Promise<void> {
		if (target === ConfigurationTarget.DEFAULT) {
			return Promise.reject(new Error('Invalid configuration target'));
		}

		if (target === ConfigurationTarget.MEMORY) {
			this._configuration.updateValue(key, value, overrides);
			this.triggerConfigurationChange(new ConfigurationChangeEvent().change(overrides && overrides.overrideIdentifier ? [keyFromOverrideIdentifier(overrides.overrideIdentifier)] : [key], overrides && overrides.resource || undefined), target);
			return Promise.resolve(undefined);
		}

		return this.configurationEditingService.writeConfiguration(target, { key, value }, { scopes: overrides, donotNotifyError })
			.then(() => {
				switch (target) {
					case ConfigurationTarget.USER:
						return this.reloadUserConfiguration()
							.then(({ local, remote }) => {
								this.onLocalUserConfigurationChanged(local);
								if (this.remoteUserConfiguration) {
									this.onRemoteUserConfigurationChanged(remote);
								}
							});
					case ConfigurationTarget.WORKSPACE:
						return this.reloadWorkspaceConfiguration();
					case ConfigurationTarget.WORKSPACE_FOLDER:
						const workspaceFolder = overrides && overrides.resource ? this.workspace.getFolder(overrides.resource) : null;
						if (workspaceFolder) {
							return this.reloadWorkspaceFolderConfiguration(workspaceFolder, key);
						}
				}
				return Promise.resolve();
			});
	}

	private deriveConfigurationTarget(key: string, value: any, overrides: IConfigurationOverrides | undefined, target: ConfigurationTarget): ConfigurationTarget | undefined {
		if (target) {
			return target;
		}

		if (value === undefined) {
			// Ignore. But expected is to remove the value from all targets
			return undefined;
		}

		const inspect = this.inspect(key, overrides);
		if (equals(value, inspect.value)) {
			// No change. So ignore.
			return undefined;
		}

		if (inspect.workspaceFolder !== undefined) {
			return ConfigurationTarget.WORKSPACE_FOLDER;
		}

		if (inspect.workspace !== undefined) {
			return ConfigurationTarget.WORKSPACE;
		}

		return ConfigurationTarget.USER;
	}

	private triggerConfigurationChange(configurationEvent: ConfigurationChangeEvent, target: ConfigurationTarget): void {
		if (configurationEvent.affectedKeys.length) {
			configurationEvent.telemetryData(target, this.getTargetConfiguration(target));
			this._onDidChangeConfiguration.fire(new WorkspaceConfigurationChangeEvent(configurationEvent, this.workspace));
		}
	}

	private getTargetConfiguration(target: ConfigurationTarget): any {
		switch (target) {
			case ConfigurationTarget.DEFAULT:
				return this._configuration.defaults.contents;
			case ConfigurationTarget.USER:
				return this._configuration.userConfiguration.contents;
			case ConfigurationTarget.WORKSPACE:
				return this._configuration.workspaceConfiguration.contents;
		}
		return {};
	}
}

interface IExportedConfigurationNode {
	name: string;
	description: string;
	default: any;
	type?: string | string[];
	enum?: any[];
	enumDescriptions?: string[];
}

interface IConfigurationExport {
	settings: IExportedConfigurationNode[];
	buildTime: number;
	commit?: string;
	buildNumber?: number;
}

export class DefaultConfigurationExportHelper {

	constructor(
		@IEnvironmentService environmentService: IEnvironmentService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@ICommandService private readonly commandService: ICommandService) {
		if (environmentService.args['export-default-configuration']) {
			this.writeConfigModelAndQuit(environmentService.args['export-default-configuration']);
		}
	}

	private writeConfigModelAndQuit(targetPath: string): Promise<void> {
		return Promise.resolve(this.extensionService.whenInstalledExtensionsRegistered())
			.then(() => this.writeConfigModel(targetPath))
			.then(() => this.commandService.executeCommand('workbench.action.quit'))
			.then(() => { });
	}

	private writeConfigModel(targetPath: string): Promise<void> {
		const config = this.getConfigModel();

		const resultString = JSON.stringify(config, undefined, '  ');
		return writeFile(targetPath, resultString);
	}

	private getConfigModel(): IConfigurationExport {
		const configRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
		const configurations = configRegistry.getConfigurations().slice();
		const settings: IExportedConfigurationNode[] = [];

		const processProperty = (name: string, prop: IConfigurationPropertySchema) => {
			const propDetails: IExportedConfigurationNode = {
				name,
				description: prop.description || prop.markdownDescription || '',
				default: prop.default,
				type: prop.type
			};

			if (prop.enum) {
				propDetails.enum = prop.enum;
			}

			if (prop.enumDescriptions || prop.markdownEnumDescriptions) {
				propDetails.enumDescriptions = prop.enumDescriptions || prop.markdownEnumDescriptions;
			}

			settings.push(propDetails);
		};

		const processConfig = (config: IConfigurationNode) => {
			if (config.properties) {
				for (let name in config.properties) {
					processProperty(name, config.properties[name]);
				}
			}

			if (config.allOf) {
				config.allOf.forEach(processConfig);
			}
		};

		configurations.forEach(processConfig);

		const excludedProps = configRegistry.getExcludedConfigurationProperties();
		for (let name in excludedProps) {
			processProperty(name, excludedProps[name]);
		}

		const result: IConfigurationExport = {
			settings: settings.sort((a, b) => a.name.localeCompare(b.name)),
			buildTime: Date.now(),
			commit: product.commit,
			buildNumber: product.settingsSearchBuildId
		};

		return result;
	}
}
