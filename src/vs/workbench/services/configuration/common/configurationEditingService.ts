/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as nls from 'vs/nls';
import { URI } from 'vs/base/common/uri';
import * as json from 'vs/base/common/json';
import { setProperty } from 'vs/base/common/jsonEdit';
import { Queue } from 'vs/base/common/async';
import { Edit, FormattingOptions } from 'vs/base/common/jsonFormatter';
import { Registry } from 'vs/platform/registry/common/platform';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { ITextFileService } from 'vs/workbench/services/textfile/common/textfiles';
import { IConfigurationService, IConfigurationOverrides, keyFromOverrideIdentifier } from 'vs/platform/configuration/common/configuration';
import { FOLDER_SETTINGS_PATH, WORKSPACE_STANDALONE_CONFIGURATIONS, TASKS_CONFIGURATION_KEY, LAUNCH_CONFIGURATION_KEY, USER_STANDALONE_CONFIGURATIONS, TASKS_DEFAULT, FOLDER_SCOPES } from 'vs/workbench/services/configuration/common/configuration';
import { IFileService, FileOperationError, FileOperationResult } from 'vs/platform/files/common/files';
import { IResolvedTextEditorModel, ITextModelService } from 'vs/editor/common/services/resolverService';
import { OVERRIDE_PROPERTY_PATTERN, IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from 'vs/platform/configuration/common/configurationRegistry';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { IOpenSettingsOptions, IPreferencesService } from 'vs/workbench/services/preferences/common/preferences';
import { withUndefinedAsNull, withNullAsUndefined } from 'vs/base/common/types';
import { IRemoteAgentService } from 'vs/workbench/services/remote/common/remoteAgentService';
import { IUriIdentityService } from 'vs/workbench/services/uriIdentity/common/uriIdentity';
import { IUserConfigurationFileService, UserConfigurationErrorCode } from 'vs/platform/configuration/common/userConfigurationFileService';
import { ITextModel } from 'vs/editor/common/model';
import { IReference } from 'vs/base/common/lifecycle';
import { Range } from 'vs/editor/common/core/range';
import { EditOperation } from 'vs/editor/common/core/editOperation';
import { Selection } from 'vs/editor/common/core/selection';

export const enum ConfigurationEditingErrorCode {

	/**
	 * Error when trying to write a configuration key that is not registered.
	 */
	ERROR_UNKNOWN_KEY,

	/**
	 * Error when trying to write an application setting into workspace settings.
	 */
	ERROR_INVALID_WORKSPACE_CONFIGURATION_APPLICATION,

	/**
	 * Error when trying to write a machne setting into workspace settings.
	 */
	ERROR_INVALID_WORKSPACE_CONFIGURATION_MACHINE,

	/**
	 * Error when trying to write an invalid folder configuration key to folder settings.
	 */
	ERROR_INVALID_FOLDER_CONFIGURATION,

	/**
	 * Error when trying to write to user target but not supported for provided key.
	 */
	ERROR_INVALID_USER_TARGET,

	/**
	 * Error when trying to write to user target but not supported for provided key.
	 */
	ERROR_INVALID_WORKSPACE_TARGET,

	/**
	 * Error when trying to write a configuration key to folder target
	 */
	ERROR_INVALID_FOLDER_TARGET,

	/**
	 * Error when trying to write to language specific setting but not supported for preovided key
	 */
	ERROR_INVALID_RESOURCE_LANGUAGE_CONFIGURATION,

	/**
	 * Error when trying to write to the workspace configuration without having a workspace opened.
	 */
	ERROR_NO_WORKSPACE_OPENED,

	/**
	 * Error when trying to write and save to the configuration file while it is dirty in the editor.
	 */
	ERROR_CONFIGURATION_FILE_DIRTY,

	/**
	 * Error when trying to write and save to the configuration file while it is not the latest in the disk.
	 */
	ERROR_CONFIGURATION_FILE_MODIFIED_SINCE,

	/**
	 * Error when trying to write to a configuration file that contains JSON errors.
	 */
	ERROR_INVALID_CONFIGURATION
}

export class ConfigurationEditingError extends Error {
	constructor(message: string, public code: ConfigurationEditingErrorCode) {
		super(message);
	}
}

export interface IConfigurationValue {
	key: string;
	value: any;
}

export interface IConfigurationEditingOptions {
	/**
	 * If `true`, do not notifies the error to user by showing the message box. Default is `false`.
	 */
	donotNotifyError?: boolean;
	/**
	 * Scope of configuration to be written into.
	 */
	scopes?: IConfigurationOverrides;
}

export const enum EditableConfigurationTarget {
	USER_LOCAL = 1,
	USER_REMOTE,
	WORKSPACE,
	WORKSPACE_FOLDER
}

interface IConfigurationEditOperation extends IConfigurationValue {
	target: EditableConfigurationTarget;
	jsonPath: json.JSONPath;
	resource?: URI;
	workspaceStandAloneConfigurationKey?: string;
}

interface ConfigurationEditingOptions extends IConfigurationEditingOptions {
	ignoreDirtyFile?: boolean;
}

export class ConfigurationEditingService {

	public _serviceBrand: undefined;

	private queue: Queue<void>;
	private remoteSettingsResource: URI | null = null;

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IFileService private readonly fileService: IFileService,
		@ITextModelService private readonly textModelResolverService: ITextModelService,
		@ITextFileService private readonly textFileService: ITextFileService,
		@INotificationService private readonly notificationService: INotificationService,
		@IPreferencesService private readonly preferencesService: IPreferencesService,
		@IEditorService private readonly editorService: IEditorService,
		@IRemoteAgentService remoteAgentService: IRemoteAgentService,
		@IUriIdentityService private readonly uriIdentityService: IUriIdentityService,
		@IUserConfigurationFileService private readonly userConfigurationFileService: IUserConfigurationFileService,
	) {
		this.queue = new Queue<void>();
		remoteAgentService.getEnvironment().then(environment => {
			if (environment) {
				this.remoteSettingsResource = environment.settingsPath;
			}
		});
	}

	writeConfiguration(target: EditableConfigurationTarget, value: IConfigurationValue, options: IConfigurationEditingOptions = {}): Promise<void> {
		const operation = this.getConfigurationEditOperation(target, value, options.scopes || {});
		return Promise.resolve(this.queue.queue(() => this.doWriteConfiguration(operation, options) // queue up writes to prevent race conditions
			.then(() => { },
				async error => {
					if (!options.donotNotifyError) {
						await this.onError(error, operation, options.scopes);
					}
					return Promise.reject(error);
				})));
	}

	private async doWriteConfiguration(operation: IConfigurationEditOperation, options: ConfigurationEditingOptions): Promise<void> {
		await this.validate(operation.target, operation, !options.ignoreDirtyFile, options.scopes || {});
		const resource: URI = operation.resource!;
		const reference = await this.resolveModelReference(resource);
		try {
			const formattingOptions = this.getFormattingOptions(reference.object.textEditorModel);
			if (this.uriIdentityService.extUri.isEqual(resource, this.environmentService.settingsResource)) {
				await this.userConfigurationFileService.updateSettings({ path: operation.jsonPath, value: operation.value }, formattingOptions);
			} else {
				await this.updateConfiguration(operation, reference.object.textEditorModel, formattingOptions);
			}
		} catch (error) {
			if ((<Error>error).message === UserConfigurationErrorCode.ERROR_INVALID_FILE) {
				throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_INVALID_CONFIGURATION, operation.target, operation);
			}
			if ((<Error>error).message === UserConfigurationErrorCode.ERROR_FILE_MODIFIED_SINCE || (<FileOperationError>error).fileOperationResult === FileOperationResult.FILE_MODIFIED_SINCE) {
				throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_CONFIGURATION_FILE_MODIFIED_SINCE, operation.target, operation);
			}
			throw error;
		} finally {
			reference.dispose();
		}
	}

	private async updateConfiguration(operation: IConfigurationEditOperation, model: ITextModel, formattingOptions: FormattingOptions): Promise<any> {
		if (this.hasParseErrors(model.getValue(), operation)) {
			throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_INVALID_CONFIGURATION, operation.target, operation);
		}

		const edit = this.getEdits(operation, model.getValue(), formattingOptions)[0];
		if (edit && this.applyEditsToBuffer(edit, model)) {
			await this.textFileService.save(model.uri);
		}
	}

	private applyEditsToBuffer(edit: Edit, model: ITextModel): boolean {
		const startPosition = model.getPositionAt(edit.offset);
		const endPosition = model.getPositionAt(edit.offset + edit.length);
		const range = new Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column);
		let currentText = model.getValueInRange(range);
		if (edit.content !== currentText) {
			const editOperation = currentText ? EditOperation.replace(range, edit.content) : EditOperation.insert(startPosition, edit.content);
			model.pushEditOperations([new Selection(startPosition.lineNumber, startPosition.column, startPosition.lineNumber, startPosition.column)], [editOperation], () => []);
			return true;
		}
		return false;
	}

	private getEdits({ value, jsonPath }: IConfigurationEditOperation, modelContent: string, formattingOptions: FormattingOptions): Edit[] {
		if (jsonPath.length) {
			return setProperty(modelContent, jsonPath, value, formattingOptions);
		}

		// Without jsonPath, the entire configuration file is being replaced, so we just use JSON.stringify
		const content = JSON.stringify(value, null, formattingOptions.insertSpaces && formattingOptions.tabSize ? ' '.repeat(formattingOptions.tabSize) : '\t');
		return [{
			content,
			length: modelContent.length,
			offset: 0
		}];
	}

	private getFormattingOptions(model: ITextModel): FormattingOptions {
		const { insertSpaces, tabSize } = model.getOptions();
		const eol = model.getEOL();
		return { insertSpaces, tabSize, eol };
	}

	private async onError(error: ConfigurationEditingError, operation: IConfigurationEditOperation, scopes: IConfigurationOverrides | undefined): Promise<void> {
		switch (error.code) {
			case ConfigurationEditingErrorCode.ERROR_INVALID_CONFIGURATION:
				this.onInvalidConfigurationError(error, operation);
				break;
			case ConfigurationEditingErrorCode.ERROR_CONFIGURATION_FILE_DIRTY:
				this.onConfigurationFileDirtyError(error, operation, scopes);
				break;
			case ConfigurationEditingErrorCode.ERROR_CONFIGURATION_FILE_MODIFIED_SINCE:
				return this.doWriteConfiguration(operation, { scopes });
			default:
				this.notificationService.error(error.message);
		}
	}

	private onInvalidConfigurationError(error: ConfigurationEditingError, operation: IConfigurationEditOperation,): void {
		const openStandAloneConfigurationActionLabel = operation.workspaceStandAloneConfigurationKey === TASKS_CONFIGURATION_KEY ? nls.localize('openTasksConfiguration', "Open Tasks Configuration")
			: operation.workspaceStandAloneConfigurationKey === LAUNCH_CONFIGURATION_KEY ? nls.localize('openLaunchConfiguration', "Open Launch Configuration")
				: null;
		if (openStandAloneConfigurationActionLabel) {
			this.notificationService.prompt(Severity.Error, error.message,
				[{
					label: openStandAloneConfigurationActionLabel,
					run: () => this.openFile(operation.resource!)
				}]
			);
		} else {
			this.notificationService.prompt(Severity.Error, error.message,
				[{
					label: nls.localize('open', "Open Settings"),
					run: () => this.openSettings(operation)
				}]
			);
		}
	}

	private onConfigurationFileDirtyError(error: ConfigurationEditingError, operation: IConfigurationEditOperation, scopes: IConfigurationOverrides | undefined): void {
		const openStandAloneConfigurationActionLabel = operation.workspaceStandAloneConfigurationKey === TASKS_CONFIGURATION_KEY ? nls.localize('openTasksConfiguration', "Open Tasks Configuration")
			: operation.workspaceStandAloneConfigurationKey === LAUNCH_CONFIGURATION_KEY ? nls.localize('openLaunchConfiguration', "Open Launch Configuration")
				: null;
		if (openStandAloneConfigurationActionLabel) {
			this.notificationService.prompt(Severity.Error, error.message,
				[{
					label: nls.localize('saveAndRetry', "Save and Retry"),
					run: () => {
						const key = operation.key ? `${operation.workspaceStandAloneConfigurationKey}.${operation.key}` : operation.workspaceStandAloneConfigurationKey!;
						this.writeConfiguration(operation.target, { key, value: operation.value }, <ConfigurationEditingOptions>{ ignoreDirtyFile: true, scopes });
					}
				},
				{
					label: openStandAloneConfigurationActionLabel,
					run: () => this.openFile(operation.resource!)
				}]
			);
		} else {
			this.notificationService.prompt(Severity.Error, error.message,
				[{
					label: nls.localize('saveAndRetry', "Save and Retry"),
					run: () => this.writeConfiguration(operation.target, { key: operation.key, value: operation.value }, <ConfigurationEditingOptions>{ ignoreDirtyFile: true, scopes })
				},
				{
					label: nls.localize('open', "Open Settings"),
					run: () => this.openSettings(operation)
				}]
			);
		}
	}

	private openSettings(operation: IConfigurationEditOperation): void {
		const options: IOpenSettingsOptions = { jsonEditor: true };
		switch (operation.target) {
			case EditableConfigurationTarget.USER_LOCAL:
				this.preferencesService.openUserSettings(options);
				break;
			case EditableConfigurationTarget.USER_REMOTE:
				this.preferencesService.openRemoteSettings(options);
				break;
			case EditableConfigurationTarget.WORKSPACE:
				this.preferencesService.openWorkspaceSettings(options);
				break;
			case EditableConfigurationTarget.WORKSPACE_FOLDER:
				if (operation.resource) {
					const workspaceFolder = this.contextService.getWorkspaceFolder(operation.resource);
					if (workspaceFolder) {
						this.preferencesService.openFolderSettings({ folderUri: workspaceFolder.uri, jsonEditor: true });
					}
				}
				break;
		}
	}

	private openFile(resource: URI): void {
		this.editorService.openEditor({ resource, options: { pinned: true } });
	}

	private toConfigurationEditingError(code: ConfigurationEditingErrorCode, target: EditableConfigurationTarget, operation: IConfigurationEditOperation): ConfigurationEditingError {
		const message = this.toErrorMessage(code, target, operation);
		return new ConfigurationEditingError(message, code);
	}

	private toErrorMessage(error: ConfigurationEditingErrorCode, target: EditableConfigurationTarget, operation: IConfigurationEditOperation): string {
		switch (error) {

			// API constraints
			case ConfigurationEditingErrorCode.ERROR_UNKNOWN_KEY: return nls.localize('errorUnknownKey', "Unable to write to {0} because {1} is not a registered configuration.", this.stringifyTarget(target), operation.key);
			case ConfigurationEditingErrorCode.ERROR_INVALID_WORKSPACE_CONFIGURATION_APPLICATION: return nls.localize('errorInvalidWorkspaceConfigurationApplication', "Unable to write {0} to Workspace Settings. This setting can be written only into User settings.", operation.key);
			case ConfigurationEditingErrorCode.ERROR_INVALID_WORKSPACE_CONFIGURATION_MACHINE: return nls.localize('errorInvalidWorkspaceConfigurationMachine', "Unable to write {0} to Workspace Settings. This setting can be written only into User settings.", operation.key);
			case ConfigurationEditingErrorCode.ERROR_INVALID_FOLDER_CONFIGURATION: return nls.localize('errorInvalidFolderConfiguration', "Unable to write to Folder Settings because {0} does not support the folder resource scope.", operation.key);
			case ConfigurationEditingErrorCode.ERROR_INVALID_USER_TARGET: return nls.localize('errorInvalidUserTarget', "Unable to write to User Settings because {0} does not support for global scope.", operation.key);
			case ConfigurationEditingErrorCode.ERROR_INVALID_WORKSPACE_TARGET: return nls.localize('errorInvalidWorkspaceTarget', "Unable to write to Workspace Settings because {0} does not support for workspace scope in a multi folder workspace.", operation.key);
			case ConfigurationEditingErrorCode.ERROR_INVALID_FOLDER_TARGET: return nls.localize('errorInvalidFolderTarget', "Unable to write to Folder Settings because no resource is provided.");
			case ConfigurationEditingErrorCode.ERROR_INVALID_RESOURCE_LANGUAGE_CONFIGURATION: return nls.localize('errorInvalidResourceLanguageConfiguraiton', "Unable to write to Language Settings because {0} is not a resource language setting.", operation.key);
			case ConfigurationEditingErrorCode.ERROR_NO_WORKSPACE_OPENED: return nls.localize('errorNoWorkspaceOpened', "Unable to write to {0} because no workspace is opened. Please open a workspace first and try again.", this.stringifyTarget(target));

			// User issues
			case ConfigurationEditingErrorCode.ERROR_INVALID_CONFIGURATION: {
				if (operation.workspaceStandAloneConfigurationKey === TASKS_CONFIGURATION_KEY) {
					return nls.localize('errorInvalidTaskConfiguration', "Unable to write into the tasks configuration file. Please open it to correct errors/warnings in it and try again.");
				}
				if (operation.workspaceStandAloneConfigurationKey === LAUNCH_CONFIGURATION_KEY) {
					return nls.localize('errorInvalidLaunchConfiguration', "Unable to write into the launch configuration file. Please open it to correct errors/warnings in it and try again.");
				}
				switch (target) {
					case EditableConfigurationTarget.USER_LOCAL:
						return nls.localize('errorInvalidConfiguration', "Unable to write into user settings. Please open the user settings to correct errors/warnings in it and try again.");
					case EditableConfigurationTarget.USER_REMOTE:
						return nls.localize('errorInvalidRemoteConfiguration', "Unable to write into remote user settings. Please open the remote user settings to correct errors/warnings in it and try again.");
					case EditableConfigurationTarget.WORKSPACE:
						return nls.localize('errorInvalidConfigurationWorkspace', "Unable to write into workspace settings. Please open the workspace settings to correct errors/warnings in the file and try again.");
					case EditableConfigurationTarget.WORKSPACE_FOLDER:
						let workspaceFolderName: string = '<<unknown>>';
						if (operation.resource) {
							const folder = this.contextService.getWorkspaceFolder(operation.resource);
							if (folder) {
								workspaceFolderName = folder.name;
							}
						}
						return nls.localize('errorInvalidConfigurationFolder', "Unable to write into folder settings. Please open the '{0}' folder settings to correct errors/warnings in it and try again.", workspaceFolderName);
					default:
						return '';
				}
			}
			case ConfigurationEditingErrorCode.ERROR_CONFIGURATION_FILE_DIRTY: {
				if (operation.workspaceStandAloneConfigurationKey === TASKS_CONFIGURATION_KEY) {
					return nls.localize('errorTasksConfigurationFileDirty', "Unable to write into tasks configuration file because the file is dirty. Please save it first and then try again.");
				}
				if (operation.workspaceStandAloneConfigurationKey === LAUNCH_CONFIGURATION_KEY) {
					return nls.localize('errorLaunchConfigurationFileDirty', "Unable to write into launch configuration file because the file is dirty. Please save it first and then try again.");
				}
				switch (target) {
					case EditableConfigurationTarget.USER_LOCAL:
						return nls.localize('errorConfigurationFileDirty', "Unable to write into user settings because the file is dirty. Please save the user settings file first and then try again.");
					case EditableConfigurationTarget.USER_REMOTE:
						return nls.localize('errorRemoteConfigurationFileDirty', "Unable to write into remote user settings because the file is dirty. Please save the remote user settings file first and then try again.");
					case EditableConfigurationTarget.WORKSPACE:
						return nls.localize('errorConfigurationFileDirtyWorkspace', "Unable to write into workspace settings because the file is dirty. Please save the workspace settings file first and then try again.");
					case EditableConfigurationTarget.WORKSPACE_FOLDER:
						let workspaceFolderName: string = '<<unknown>>';
						if (operation.resource) {
							const folder = this.contextService.getWorkspaceFolder(operation.resource);
							if (folder) {
								workspaceFolderName = folder.name;
							}
						}
						return nls.localize('errorConfigurationFileDirtyFolder', "Unable to write into folder settings because the file is dirty. Please save the '{0}' folder settings file first and then try again.", workspaceFolderName);
					default:
						return '';
				}
			}
			case ConfigurationEditingErrorCode.ERROR_CONFIGURATION_FILE_MODIFIED_SINCE:
				if (operation.workspaceStandAloneConfigurationKey === TASKS_CONFIGURATION_KEY) {
					return nls.localize('errorTasksConfigurationFileModifiedSince', "Unable to write into tasks configuration file because the content of the file is newer.");
				}
				if (operation.workspaceStandAloneConfigurationKey === LAUNCH_CONFIGURATION_KEY) {
					return nls.localize('errorLaunchConfigurationFileModifiedSince', "Unable to write into launch configuration file because the content of the file is newer.");
				}
				switch (target) {
					case EditableConfigurationTarget.USER_LOCAL:
						return nls.localize('errorConfigurationFileModifiedSince', "Unable to write into user settings because the content of the file is newer.");
					case EditableConfigurationTarget.USER_REMOTE:
						return nls.localize('errorRemoteConfigurationFileModifiedSince', "Unable to write into remote user settings because the content of the file is newer.");
					case EditableConfigurationTarget.WORKSPACE:
						return nls.localize('errorConfigurationFileModifiedSinceWorkspace', "Unable to write into workspace settings because the content of the file is newer.");
					case EditableConfigurationTarget.WORKSPACE_FOLDER:
						return nls.localize('errorConfigurationFileModifiedSinceFolder', "Unable to write into folder settings because the content of the file is newer.");
				}
		}
	}

	private stringifyTarget(target: EditableConfigurationTarget): string {
		switch (target) {
			case EditableConfigurationTarget.USER_LOCAL:
				return nls.localize('userTarget', "User Settings");
			case EditableConfigurationTarget.USER_REMOTE:
				return nls.localize('remoteUserTarget', "Remote User Settings");
			case EditableConfigurationTarget.WORKSPACE:
				return nls.localize('workspaceTarget', "Workspace Settings");
			case EditableConfigurationTarget.WORKSPACE_FOLDER:
				return nls.localize('folderTarget', "Folder Settings");
			default:
				return '';
		}
	}

	private defaultResourceValue(resource: URI): string {
		const basename: string = this.uriIdentityService.extUri.basename(resource);
		const configurationValue: string = basename.substr(0, basename.length - this.uriIdentityService.extUri.extname(resource).length);
		switch (configurationValue) {
			case TASKS_CONFIGURATION_KEY: return TASKS_DEFAULT;
			default: return '{}';
		}
	}

	private async resolveModelReference(resource: URI): Promise<IReference<IResolvedTextEditorModel>> {
		const exists = await this.fileService.exists(resource);
		if (!exists) {
			await this.textFileService.write(resource, this.defaultResourceValue(resource), { encoding: 'utf8' });
		}
		return this.textModelResolverService.createModelReference(resource);
	}

	private hasParseErrors(content: string, operation: IConfigurationEditOperation): boolean {
		// If we write to a workspace standalone file and replace the entire contents (no key provided)
		// we can return here because any parse errors can safely be ignored since all contents are replaced
		if (operation.workspaceStandAloneConfigurationKey && !operation.key) {
			return false;
		}
		const parseErrors: json.ParseError[] = [];
		json.parse(content, parseErrors, { allowTrailingComma: true, allowEmptyContent: true });
		return parseErrors.length > 0;
	}

	private async validate(target: EditableConfigurationTarget, operation: IConfigurationEditOperation, checkDirty: boolean, overrides: IConfigurationOverrides): Promise<void> {

		const configurationProperties = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).getConfigurationProperties();
		const configurationScope = configurationProperties[operation.key]?.scope;

		// Any key must be a known setting from the registry (unless this is a standalone config)
		if (!operation.workspaceStandAloneConfigurationKey) {
			const validKeys = this.configurationService.keys().default;
			if (validKeys.indexOf(operation.key) < 0 && !OVERRIDE_PROPERTY_PATTERN.test(operation.key)) {
				throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_UNKNOWN_KEY, target, operation);
			}
		}

		if (operation.workspaceStandAloneConfigurationKey) {
			// Global launches are not supported
			if ((operation.workspaceStandAloneConfigurationKey !== TASKS_CONFIGURATION_KEY) && (target === EditableConfigurationTarget.USER_LOCAL || target === EditableConfigurationTarget.USER_REMOTE)) {
				throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_INVALID_USER_TARGET, target, operation);
			}
		}

		// Target cannot be workspace or folder if no workspace opened
		if ((target === EditableConfigurationTarget.WORKSPACE || target === EditableConfigurationTarget.WORKSPACE_FOLDER) && this.contextService.getWorkbenchState() === WorkbenchState.EMPTY) {
			throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_NO_WORKSPACE_OPENED, target, operation);
		}

		if (target === EditableConfigurationTarget.WORKSPACE) {
			if (!operation.workspaceStandAloneConfigurationKey && !OVERRIDE_PROPERTY_PATTERN.test(operation.key)) {
				if (configurationScope === ConfigurationScope.APPLICATION) {
					throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_INVALID_WORKSPACE_CONFIGURATION_APPLICATION, target, operation);
				}
				if (configurationScope === ConfigurationScope.MACHINE) {
					throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_INVALID_WORKSPACE_CONFIGURATION_MACHINE, target, operation);
				}
			}
		}

		if (target === EditableConfigurationTarget.WORKSPACE_FOLDER) {
			if (!operation.resource) {
				throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_INVALID_FOLDER_TARGET, target, operation);
			}

			if (!operation.workspaceStandAloneConfigurationKey && !OVERRIDE_PROPERTY_PATTERN.test(operation.key)) {
				if (configurationScope && !FOLDER_SCOPES.includes(configurationScope)) {
					throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_INVALID_FOLDER_CONFIGURATION, target, operation);
				}
			}
		}

		if (overrides.overrideIdentifier) {
			const configurationProperties = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).getConfigurationProperties();
			if (configurationProperties[operation.key].scope !== ConfigurationScope.LANGUAGE_OVERRIDABLE) {
				throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_INVALID_RESOURCE_LANGUAGE_CONFIGURATION, target, operation);
			}
		}

		if (!operation.resource) {
			throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_INVALID_FOLDER_TARGET, target, operation);
		}

		if (checkDirty && this.textFileService.isDirty(operation.resource)) {
			throw this.toConfigurationEditingError(ConfigurationEditingErrorCode.ERROR_CONFIGURATION_FILE_DIRTY, target, operation);
		}

	}

	private getConfigurationEditOperation(target: EditableConfigurationTarget, config: IConfigurationValue, overrides: IConfigurationOverrides): IConfigurationEditOperation {

		// Check for standalone workspace configurations
		if (config.key) {
			const standaloneConfigurationMap = target === EditableConfigurationTarget.USER_LOCAL ? USER_STANDALONE_CONFIGURATIONS : WORKSPACE_STANDALONE_CONFIGURATIONS;
			const standaloneConfigurationKeys = Object.keys(standaloneConfigurationMap);
			for (const key of standaloneConfigurationKeys) {
				const resource = this.getConfigurationFileResource(target, standaloneConfigurationMap[key], overrides.resource);

				// Check for prefix
				if (config.key === key) {
					const jsonPath = this.isWorkspaceConfigurationResource(resource) ? [key] : [];
					return { key: jsonPath[jsonPath.length - 1], jsonPath, value: config.value, resource: withNullAsUndefined(resource), workspaceStandAloneConfigurationKey: key, target };
				}

				// Check for prefix.<setting>
				const keyPrefix = `${key}.`;
				if (config.key.indexOf(keyPrefix) === 0) {
					const jsonPath = this.isWorkspaceConfigurationResource(resource) ? [key, config.key.substr(keyPrefix.length)] : [config.key.substr(keyPrefix.length)];
					return { key: jsonPath[jsonPath.length - 1], jsonPath, value: config.value, resource: withNullAsUndefined(resource), workspaceStandAloneConfigurationKey: key, target };
				}
			}
		}

		let key = config.key;
		let jsonPath = overrides.overrideIdentifier ? [keyFromOverrideIdentifier(overrides.overrideIdentifier), key] : [key];
		if (target === EditableConfigurationTarget.USER_LOCAL || target === EditableConfigurationTarget.USER_REMOTE) {
			return { key, jsonPath, value: config.value, resource: withNullAsUndefined(this.getConfigurationFileResource(target, '', null)), target };
		}

		const resource = this.getConfigurationFileResource(target, FOLDER_SETTINGS_PATH, overrides.resource);
		if (this.isWorkspaceConfigurationResource(resource)) {
			jsonPath = ['settings', ...jsonPath];
		}
		return { key, jsonPath, value: config.value, resource: withNullAsUndefined(resource), target };
	}

	private isWorkspaceConfigurationResource(resource: URI | null): boolean {
		const workspace = this.contextService.getWorkspace();
		return !!(workspace.configuration && resource && workspace.configuration.fsPath === resource.fsPath);
	}

	private getConfigurationFileResource(target: EditableConfigurationTarget, relativePath: string, resource: URI | null | undefined): URI | null {
		if (target === EditableConfigurationTarget.USER_LOCAL) {
			if (relativePath) {
				return this.uriIdentityService.extUri.joinPath(this.uriIdentityService.extUri.dirname(this.environmentService.settingsResource), relativePath);
			} else {
				return this.environmentService.settingsResource;
			}
		}
		if (target === EditableConfigurationTarget.USER_REMOTE) {
			return this.remoteSettingsResource;
		}
		const workbenchState = this.contextService.getWorkbenchState();
		if (workbenchState !== WorkbenchState.EMPTY) {

			const workspace = this.contextService.getWorkspace();

			if (target === EditableConfigurationTarget.WORKSPACE) {
				if (workbenchState === WorkbenchState.WORKSPACE) {
					return withUndefinedAsNull(workspace.configuration);
				}
				if (workbenchState === WorkbenchState.FOLDER) {
					return workspace.folders[0].toResource(relativePath);
				}
			}

			if (target === EditableConfigurationTarget.WORKSPACE_FOLDER) {
				if (resource) {
					const folder = this.contextService.getWorkspaceFolder(resource);
					if (folder) {
						return folder.toResource(relativePath);
					}
				}
			}
		}
		return null;
	}
}
