/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Lazy } from 'vs/base/common/lazy';
import { Disposable } from 'vs/base/common/lifecycle';
import * as path from 'vs/base/common/path';
import * as process from 'vs/base/common/process';
import { URI } from 'vs/base/common/uri';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IExtHostDocumentsAndEditors } from 'vs/workbench/api/common/extHostDocumentsAndEditors';
import { IExtHostEditorTabs } from 'vs/workbench/api/common/extHostEditorTabs';
import { IExtHostExtensionService } from 'vs/workbench/api/common/extHostExtensionService';
import { CustomEditorTabInput, NotebookDiffEditorTabInput, NotebookEditorTabInput, TextDiffTabInput, TextTabInput } from 'vs/workbench/api/common/extHostTypes';
import { IExtHostWorkspace } from 'vs/workbench/api/common/extHostWorkspace';
import { IConfigurationResolverService } from 'vs/workbench/services/configurationResolver/common/configurationResolver';
import { AbstractVariableResolverService } from 'vs/workbench/services/configurationResolver/common/variableResolver';
import * as vscode from 'vscode';
import { ExtHostConfigProvider, IExtHostConfiguration } from './extHostConfiguration';

export interface IExtHostVariableResolverProvider {
	readonly _serviceBrand: undefined;
	getResolver(): Promise<IConfigurationResolverService>;
}

export const IExtHostVariableResolverProvider = createDecorator<IExtHostVariableResolverProvider>('IExtHostVariableResolverProvider');

interface DynamicContext {
	folders: vscode.WorkspaceFolder[];
}

class ExtHostVariableResolverService extends AbstractVariableResolverService {

	constructor(
		extensionService: IExtHostExtensionService,
		workspaceService: IExtHostWorkspace,
		editorService: IExtHostDocumentsAndEditors,
		editorTabs: IExtHostEditorTabs,
		configProvider: ExtHostConfigProvider,
		context: DynamicContext,
		homeDir: string | undefined,
	) {
		function getActiveUri(): URI | undefined {
			if (editorService) {
				const activeEditor = editorService.activeEditor();
				if (activeEditor) {
					return activeEditor.document.uri;
				}
				const activeTab = editorTabs.tabGroups.all.find(group => group.isActive)?.activeTab;
				if (activeTab !== undefined) {
					// Resolve a resource from the tab
					if (activeTab.input instanceof TextDiffTabInput || activeTab.input instanceof NotebookDiffEditorTabInput) {
						return activeTab.input.modified;
					} else if (activeTab.input instanceof TextTabInput || activeTab.input instanceof NotebookEditorTabInput || activeTab.input instanceof CustomEditorTabInput) {
						return activeTab.input.uri;
					}
				}
			}
			return undefined;
		}

		super({
			getFolderUri: (folderName: string): URI | undefined => {
				const found = context.folders.filter(f => f.name === folderName);
				if (found && found.length > 0) {
					return found[0].uri;
				}
				return undefined;
			},
			getWorkspaceFolderCount: (): number => {
				return context.folders.length;
			},
			getConfigurationValue: (folderUri: URI | undefined, section: string): string | undefined => {
				return configProvider.getConfiguration(undefined, folderUri).get<string>(section);
			},
			getAppRoot: (): string | undefined => {
				return process.cwd();
			},
			getExecPath: (): string | undefined => {
				return process.env['VSCODE_EXEC_PATH'];
			},
			getFilePath: (): string | undefined => {
				const activeUri = getActiveUri();
				if (activeUri) {
					return path.normalize(activeUri.fsPath);
				}
				return undefined;
			},
			getWorkspaceFolderPathForFile: (): string | undefined => {
				if (workspaceService) {
					const activeUri = getActiveUri();
					if (activeUri) {
						const ws = workspaceService.getWorkspaceFolder(activeUri);
						if (ws) {
							return path.normalize(ws.uri.fsPath);
						}
					}
				}
				return undefined;
			},
			getSelectedText: (): string | undefined => {
				if (editorService) {
					const activeEditor = editorService.activeEditor();
					if (activeEditor && !activeEditor.selection.isEmpty) {
						return activeEditor.document.getText(activeEditor.selection);
					}
				}
				return undefined;
			},
			getLineNumber: (): string | undefined => {
				if (editorService) {
					const activeEditor = editorService.activeEditor();
					if (activeEditor) {
						return String(activeEditor.selection.end.line + 1);
					}
				}
				return undefined;
			},
			getExtension: (id) => {
				return extensionService.getExtension(id);
			},
		}, undefined, homeDir ? Promise.resolve(homeDir) : undefined, Promise.resolve(process.env));
	}
}

export class ExtHostVariableResolverProviderService extends Disposable implements IExtHostVariableResolverProvider {
	declare readonly _serviceBrand: undefined;

	private _resolver = new Lazy(async () => {
		const configProvider = await this.configurationService.getConfigProvider();
		const folders = await this.workspaceService.getWorkspaceFolders2() || [];

		const dynamic: DynamicContext = { folders };
		this._register(this.workspaceService.onDidChangeWorkspace(async e => {
			dynamic.folders = await this.workspaceService.getWorkspaceFolders2() || [];
		}));

		return new ExtHostVariableResolverService(
			this.extensionService,
			this.workspaceService,
			this.editorService,
			this.editorTabs,
			configProvider,
			dynamic,
			this.homeDir(),
		);
	});

	constructor(
		@IExtHostExtensionService private readonly extensionService: IExtHostExtensionService,
		@IExtHostWorkspace private readonly workspaceService: IExtHostWorkspace,
		@IExtHostDocumentsAndEditors private readonly editorService: IExtHostDocumentsAndEditors,
		@IExtHostConfiguration private readonly configurationService: IExtHostConfiguration,
		@IExtHostEditorTabs private readonly editorTabs: IExtHostEditorTabs,
	) {
		super();
	}

	public getResolver(): Promise<IConfigurationResolverService> {
		return this._resolver.getValue();
	}

	protected homeDir(): string | undefined {
		return undefined;
	}
}
