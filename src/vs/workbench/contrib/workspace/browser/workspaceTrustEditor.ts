/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, addStandardDisposableListener, append, clearNode, Dimension, EventHelper, EventType } from 'vs/base/browser/dom';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { ButtonBar } from 'vs/base/browser/ui/button/button';
import { IMessage, InputBox, MessageType } from 'vs/base/browser/ui/inputbox/inputBox';
import { DomScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ITableRenderer, ITableVirtualDelegate } from 'vs/base/browser/ui/table/table';
import { Action, IAction } from 'vs/base/common/actions';
import { CancellationToken } from 'vs/base/common/cancellation';
import { Codicon, registerCodicon } from 'vs/base/common/codicons';
import { debounce } from 'vs/base/common/decorators';
import { Emitter, Event } from 'vs/base/common/event';
import { KeyCode } from 'vs/base/common/keyCodes';
import { splitName } from 'vs/base/common/labels';
import { Disposable, DisposableStore } from 'vs/base/common/lifecycle';
import { parseLinkedText } from 'vs/base/common/linkedText';
import { Schemas } from 'vs/base/common/network';
import { ScrollbarVisibility } from 'vs/base/common/scrollable';
import { URI } from 'vs/base/common/uri';
import { localize } from 'vs/nls';
import { ConfigurationScope, Extensions, IConfigurationRegistry } from 'vs/platform/configuration/common/configurationRegistry';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IFileDialogService } from 'vs/platform/dialogs/common/dialogs';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ILabelService } from 'vs/platform/label/common/label';
import { WorkbenchTable } from 'vs/platform/list/browser/listService';
import { Link } from 'vs/platform/opener/browser/link';
import product from 'vs/platform/product/common/product';
import { Registry } from 'vs/platform/registry/common/platform';
import { isVirtualResource, isVirtualWorkspace } from 'vs/platform/remote/common/remoteHosts';
import { IStorageService } from 'vs/platform/storage/common/storage';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import { buttonBackground, buttonSecondaryBackground, editorErrorForeground } from 'vs/platform/theme/common/colorRegistry';
import { IWorkspaceContextService, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { attachButtonStyler, attachInputBoxStyler, attachStylerCallback } from 'vs/platform/theme/common/styler';
import { IThemeService, ThemeIcon } from 'vs/platform/theme/common/themeService';
import { IWorkspaceTrustManagementService } from 'vs/platform/workspace/common/workspaceTrust';
import { ISingleFolderWorkspaceIdentifier, toWorkspaceIdentifier } from 'vs/platform/workspaces/common/workspaces';
import { EditorPane } from 'vs/workbench/browser/parts/editor/editorPane';
import { IEditorOpenContext } from 'vs/workbench/common/editor';
import { ChoiceAction } from 'vs/workbench/common/notifications';
import { debugIconStartForeground } from 'vs/workbench/contrib/debug/browser/debugColors';
import { IExtensionsWorkbenchService, LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID } from 'vs/workbench/contrib/extensions/common/extensions';
import { settingsEditIcon, settingsRemoveIcon } from 'vs/workbench/contrib/preferences/browser/preferencesIcons';
import { IWorkbenchConfigurationService } from 'vs/workbench/services/configuration/common/configuration';
import { IExtensionManifestPropertiesService } from 'vs/workbench/services/extensions/common/extensionManifestPropertiesService';
import { IUriIdentityService } from 'vs/workbench/services/uriIdentity/common/uriIdentity';
import { WorkspaceTrustEditorInput } from 'vs/workbench/services/workspaces/browser/workspaceTrustEditorInput';
import { IEditorOptions } from 'vs/platform/editor/common/editor';
import { getExtensionDependencies } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { EnablementState, IWorkbenchExtensionEnablementService } from 'vs/workbench/services/extensionManagement/common/extensionManagement';
import { posix } from 'vs/base/common/path';

export const shieldIcon = registerCodicon('workspace-trust-icon', Codicon.shield);

const checkListIcon = registerCodicon('workspace-trusted-check-icon', Codicon.check);
const xListIcon = registerCodicon('workspace-trusted-x-icon', Codicon.x);
const folderPickerIcon = registerCodicon('folder-picker', Codicon.folder);

interface ITrustedUriItem {
	parentOfWorkspaceItem: boolean;
	uri: URI;
}

class WorkspaceTrustedUrisTable extends Disposable {
	private readonly _onDidAcceptEdit: Emitter<ITrustedUriItem> = this._register(new Emitter<ITrustedUriItem>());
	readonly onDidAcceptEdit: Event<ITrustedUriItem> = this._onDidAcceptEdit.event;

	private readonly _onDidRejectEdit: Emitter<ITrustedUriItem> = this._register(new Emitter<ITrustedUriItem>());
	readonly onDidRejectEdit: Event<ITrustedUriItem> = this._onDidRejectEdit.event;

	private _onEdit: Emitter<ITrustedUriItem> = this._register(new Emitter<ITrustedUriItem>());
	readonly onEdit: Event<ITrustedUriItem> = this._onEdit.event;

	private _onDelete: Emitter<ITrustedUriItem> = this._register(new Emitter<ITrustedUriItem>());
	readonly onDelete: Event<ITrustedUriItem> = this._onDelete.event;

	private readonly table: WorkbenchTable<ITrustedUriItem>;

	private readonly descriptionElement: HTMLElement;

	constructor(
		private readonly container: HTMLElement,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IWorkspaceTrustManagementService private readonly workspaceTrustManagementService: IWorkspaceTrustManagementService,
		@IUriIdentityService private readonly uriService: IUriIdentityService,
		@ILabelService private readonly labelService: ILabelService,
		@IThemeService private readonly themeService: IThemeService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService
	) {
		super();

		this.descriptionElement = container.appendChild($('.workspace-trusted-folders-description'));
		const tableElement = container.appendChild($('.trusted-uris-table'));
		const addButtonBarElement = container.appendChild($('.trusted-uris-button-bar'));

		this.table = this.instantiationService.createInstance(
			WorkbenchTable,
			'WorkspaceTrust',
			tableElement,
			new TrustedUriTableVirtualDelegate(),
			[
				{
					label: localize('hostColumnLabel', "Host"),
					tooltip: '',
					weight: 1,
					templateId: TrustedUriHostColumnRenderer.TEMPLATE_ID,
					project(row: ITrustedUriItem): ITrustedUriItem { return row; }
				},
				{
					label: localize('pathColumnLabel', "Path"),
					tooltip: '',
					weight: 8,
					templateId: TrustedUriPathColumnRenderer.TEMPLATE_ID,
					project(row: ITrustedUriItem): ITrustedUriItem { return row; }
				},
				{
					label: '',
					tooltip: '',
					weight: 1,
					minimumWidth: 75,
					maximumWidth: 75,
					templateId: TrustedUriActionsColumnRenderer.TEMPLATE_ID,
					project(row: ITrustedUriItem): ITrustedUriItem { return row; }
				},
			],
			[
				this.instantiationService.createInstance(TrustedUriHostColumnRenderer),
				this.instantiationService.createInstance(TrustedUriPathColumnRenderer, this),
				this.instantiationService.createInstance(TrustedUriActionsColumnRenderer, this, this.currentWorkspaceUri),
			],
			{
				horizontalScrolling: false,
				alwaysConsumeMouseWheel: false,
				openOnSingleClick: false,
				multipleSelectionSupport: false,
				accessibilityProvider: {
					getAriaLabel: (item: ITrustedUriItem) => {
						const hostLabel = getHostLabel(this.labelService, item);
						if (hostLabel === undefined || hostLabel.length === 0) {
							return localize('trustedFolderAriaLabel', "{0}, trusted", this.labelService.getUriLabel(item.uri));
						}

						return localize('trustedFolderWithHostAriaLabel', "{0} on {1}, trusted", this.labelService.getUriLabel(item.uri), hostLabel);
					},
					getWidgetAriaLabel: () => localize('trustedFoldersAndWorkspaces', "Trusted Folders & Workspaces")
				}
			}
		) as WorkbenchTable<ITrustedUriItem>;

		this._register(this.table.onDidOpen(item => {
			// default prevented when input box is double clicked #125052
			if (item && item.element && !item.browserEvent?.defaultPrevented) {
				this.edit(item.element, true);
			}
		}));

		const buttonBar = this._register(new ButtonBar(addButtonBarElement));
		const addButton = this._register(buttonBar.addButton({ title: localize('addButton', "Add Folder") }));
		addButton.label = localize('addButton', "Add Folder");

		this._register(attachButtonStyler(addButton, this.themeService));

		this._register(addButton.onDidClick(async () => {
			const uri = await this.fileDialogService.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: this.currentWorkspaceUri,
				openLabel: localize('trustUri', "Trust Folder"),
				title: localize('selectTrustedUri', "Select Folder To Trust")
			});

			if (uri) {
				this.workspaceTrustManagementService.setUrisTrust(uri, true);
			}
		}));

		this._register(this.workspaceTrustManagementService.onDidChangeTrustedFolders(() => {
			this.updateTable();
		}));
	}

	private getIndexOfTrustedUriEntry(item: ITrustedUriItem): number {
		const index = this.trustedUriEntries.indexOf(item);
		if (index === -1) {
			for (let i = 0; i < this.trustedUriEntries.length; i++) {
				if (this.trustedUriEntries[i].uri === item.uri) {
					return i;
				}
			}
		}

		return index;
	}

	private selectTrustedUriEntry(item: ITrustedUriItem, focus: boolean = true): void {
		const index = this.getIndexOfTrustedUriEntry(item);
		if (index !== -1) {
			if (focus) {
				this.table.domFocus();
				this.table.setFocus([index]);
			}
			this.table.setSelection([index]);
		}
	}

	private get currentWorkspaceUri(): URI {
		return this.workspaceService.getWorkspace().folders[0]?.uri || URI.file('/');
	}

	private get trustedUriEntries(): ITrustedUriItem[] {
		const currentWorkspace = this.workspaceService.getWorkspace();
		const currentWorkspaceUris = currentWorkspace.folders.map(folder => folder.uri);
		if (currentWorkspace.configuration) {
			currentWorkspaceUris.push(currentWorkspace.configuration);
		}

		const entries = this.workspaceTrustManagementService.getTrustedUris().map(uri => {

			let relatedToCurrentWorkspace = false;
			for (const workspaceUri of currentWorkspaceUris) {
				relatedToCurrentWorkspace = relatedToCurrentWorkspace || this.uriService.extUri.isEqualOrParent(workspaceUri, uri);
			}

			return {
				uri,
				parentOfWorkspaceItem: relatedToCurrentWorkspace
			};
		});

		// Sort entries
		const sortedEntries = entries.sort((a, b) => {
			if (a.uri.scheme !== b.uri.scheme) {
				if (a.uri.scheme === Schemas.file) {
					return -1;
				}

				if (b.uri.scheme === Schemas.file) {
					return 1;
				}
			}

			const aIsWorkspace = a.uri.path.endsWith('.code-workspace');
			const bIsWorkspace = b.uri.path.endsWith('.code-workspace');

			if (aIsWorkspace !== bIsWorkspace) {
				if (aIsWorkspace) {
					return 1;
				}

				if (bIsWorkspace) {
					return -1;
				}
			}

			return a.uri.fsPath.localeCompare(b.uri.fsPath);
		});

		return sortedEntries;
	}

	layout(): void {
		this.table.layout((this.trustedUriEntries.length * TrustedUriTableVirtualDelegate.ROW_HEIGHT) + TrustedUriTableVirtualDelegate.HEADER_ROW_HEIGHT, undefined);
	}

	updateTable(): void {
		const entries = this.trustedUriEntries;
		this.container.classList.toggle('empty', entries.length === 0);

		this.descriptionElement.innerText = entries.length ?
			localize('trustedFoldersDescription', "You trust the following folders, their subfolders, and workspace files.") :
			localize('noTrustedFoldersDescriptions', "You haven't trusted any folders or workspace files yet.");

		this.table.splice(0, Number.POSITIVE_INFINITY, this.trustedUriEntries);
		this.layout();
	}

	validateUri(path: string, item?: ITrustedUriItem): IMessage | null {
		if (!item) {
			return null;
		}

		if (item.uri.scheme === 'vscode-vfs') {
			const segments = path.split(posix.sep).filter(s => s.length);
			if (segments.length === 0 && path.startsWith(posix.sep)) {
				return {
					type: MessageType.WARNING,
					content: localize('trustAll', "You will trust all repositories on {0}.", getHostLabel(this.labelService, item))
				};
			}

			if (segments.length === 1) {
				return {
					type: MessageType.WARNING,
					content: localize('trustOrg', "You will trust all repositories and forks under '{0}'.", segments[0])
				};
			}

			if (segments.length > 2) {
				return {
					type: MessageType.ERROR,
					content: localize('invalidTrust', "'{0}' is not valid and has too many path segments.", path)
				};
			}
		}

		return null;
	}

	acceptEdit(item: ITrustedUriItem, uri: URI) {
		const trustedFolders = this.workspaceTrustManagementService.getTrustedUris();
		const index = trustedFolders.findIndex(u => this.uriService.extUri.isEqual(u, item.uri));

		if (index >= trustedFolders.length || index === -1) {
			trustedFolders.push(uri);
		} else {
			trustedFolders[index] = uri;
		}

		this.workspaceTrustManagementService.setTrustedUris(trustedFolders);
		this._onDidAcceptEdit.fire(item);
	}

	rejectEdit(item: ITrustedUriItem) {
		this._onDidRejectEdit.fire(item);
	}

	async delete(item: ITrustedUriItem) {
		await this.workspaceTrustManagementService.setUrisTrust([item.uri], false);
		this._onDelete.fire(item);
	}

	async edit(item: ITrustedUriItem, usePickerIfPossible?: boolean) {
		const canUseOpenDialog = item.uri.scheme === Schemas.file ||
			(
				item.uri.scheme === this.currentWorkspaceUri.scheme &&
				this.uriService.extUri.isEqualAuthority(this.currentWorkspaceUri.authority, item.uri.authority) &&
				!isVirtualResource(item.uri)
			);
		if (canUseOpenDialog && usePickerIfPossible) {
			const uri = await this.fileDialogService.showOpenDialog({
				canSelectFiles: false,
				canSelectFolders: true,
				canSelectMany: false,
				defaultUri: item.uri,
				openLabel: localize('trustUri', "Trust Folder"),

				title: localize('selectTrustedUri', "Select Folder To Trust")
			});

			if (uri) {
				this.acceptEdit(item, uri[0]);
			} else {
				this.rejectEdit(item);
			}
		} else {
			this.selectTrustedUriEntry(item);
			this._onEdit.fire(item);
		}
	}
}

class TrustedUriTableVirtualDelegate implements ITableVirtualDelegate<ITrustedUriItem> {
	static readonly HEADER_ROW_HEIGHT = 30;
	static readonly ROW_HEIGHT = 24;
	readonly headerRowHeight = TrustedUriTableVirtualDelegate.HEADER_ROW_HEIGHT;
	getHeight(item: ITrustedUriItem) {
		return TrustedUriTableVirtualDelegate.ROW_HEIGHT;
	}
}

interface IActionsColumnTemplateData {
	readonly actionBar: ActionBar;
}

class TrustedUriActionsColumnRenderer implements ITableRenderer<ITrustedUriItem, IActionsColumnTemplateData> {

	static readonly TEMPLATE_ID = 'actions';

	readonly templateId: string = TrustedUriActionsColumnRenderer.TEMPLATE_ID;

	constructor(
		private readonly table: WorkspaceTrustedUrisTable,
		private readonly currentWorkspaceUri: URI,
		@IUriIdentityService private readonly uriService: IUriIdentityService) { }

	renderTemplate(container: HTMLElement): IActionsColumnTemplateData {
		const element = container.appendChild($('.actions'));
		const actionBar = new ActionBar(element, { animated: false });
		return { actionBar };
	}

	renderElement(item: ITrustedUriItem, index: number, templateData: IActionsColumnTemplateData, height: number | undefined): void {
		templateData.actionBar.clear();

		const canUseOpenDialog = item.uri.scheme === Schemas.file ||
			(
				item.uri.scheme === this.currentWorkspaceUri.scheme &&
				this.uriService.extUri.isEqualAuthority(this.currentWorkspaceUri.authority, item.uri.authority) &&
				!isVirtualResource(item.uri)
			);

		const actions: IAction[] = [];
		if (canUseOpenDialog) {
			actions.push(this.createPickerAction(item));
		}
		actions.push(this.createEditAction(item));
		actions.push(this.createDeleteAction(item));
		templateData.actionBar.push(actions, { icon: true });
	}

	private createEditAction(item: ITrustedUriItem): IAction {
		return <IAction>{
			class: ThemeIcon.asClassName(settingsEditIcon),
			enabled: true,
			id: 'editTrustedUri',
			tooltip: localize('editTrustedUri', "Edit Path"),
			run: () => {
				this.table.edit(item, false);
			}
		};
	}

	private createPickerAction(item: ITrustedUriItem): IAction {
		return <IAction>{
			class: ThemeIcon.asClassName(folderPickerIcon),
			enabled: true,
			id: 'pickerTrustedUri',
			tooltip: localize('pickerTrustedUri', "Open File Picker"),
			run: () => {
				this.table.edit(item, true);
			}
		};
	}

	private createDeleteAction(item: ITrustedUriItem): IAction {
		return <IAction>{
			class: ThemeIcon.asClassName(settingsRemoveIcon),
			enabled: true,
			id: 'deleteTrustedUri',
			tooltip: localize('deleteTrustedUri', "Delete Path"),
			run: async () => {
				await this.table.delete(item);
			}
		};
	}

	disposeTemplate(templateData: IActionsColumnTemplateData): void {
		templateData.actionBar.dispose();
	}

}

interface ITrustedUriPathColumnTemplateData {
	element: HTMLElement;
	pathLabel: HTMLElement;
	pathInput: InputBox;
	renderDisposables: DisposableStore;
	disposables: DisposableStore;
}

class TrustedUriPathColumnRenderer implements ITableRenderer<ITrustedUriItem, ITrustedUriPathColumnTemplateData> {
	static readonly TEMPLATE_ID = 'path';

	readonly templateId: string = TrustedUriPathColumnRenderer.TEMPLATE_ID;
	private currentItem?: ITrustedUriItem;

	constructor(
		private readonly table: WorkspaceTrustedUrisTable,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IThemeService private readonly themeService: IThemeService,
	) {
	}

	renderTemplate(container: HTMLElement): ITrustedUriPathColumnTemplateData {
		const element = container.appendChild($('.path'));
		const pathLabel = element.appendChild($('div.path-label'));

		const pathInput = new InputBox(element, this.contextViewService, {
			validationOptions: {
				validation: value => this.table.validateUri(value, this.currentItem)
			}
		});

		const disposables = new DisposableStore();
		disposables.add(attachInputBoxStyler(pathInput, this.themeService));

		const renderDisposables = disposables.add(new DisposableStore());

		return {
			element,
			pathLabel,
			pathInput,
			disposables,
			renderDisposables
		};
	}

	renderElement(item: ITrustedUriItem, index: number, templateData: ITrustedUriPathColumnTemplateData, height: number | undefined): void {
		templateData.renderDisposables.clear();

		this.currentItem = item;
		templateData.renderDisposables.add(this.table.onEdit(async (e) => {
			if (item === e) {
				templateData.element.classList.add('input-mode');
				templateData.pathInput.focus();
				templateData.pathInput.select();
				templateData.element.parentElement!.style.paddingLeft = '0px';
			}
		}));

		// stop double click action from re-rendering the element on the table #125052
		templateData.renderDisposables.add(addDisposableListener(templateData.pathInput.element, EventType.DBLCLICK, e => {
			EventHelper.stop(e);
		}));


		const hideInputBox = () => {
			templateData.element.classList.remove('input-mode');
			templateData.element.parentElement!.style.paddingLeft = '5px';
		};

		const accept = () => {
			hideInputBox();
			const uri = item.uri.with({ path: templateData.pathInput.value });
			templateData.pathLabel.innerText = templateData.pathInput.value;

			if (uri) {
				this.table.acceptEdit(item, uri);
			}
		};

		const reject = () => {
			hideInputBox();
			templateData.pathInput.value = stringValue;
			this.table.rejectEdit(item);
		};

		templateData.renderDisposables.add(addStandardDisposableListener(templateData.pathInput.inputElement, EventType.KEY_DOWN, e => {
			let handled = false;
			if (e.equals(KeyCode.Enter)) {
				accept();
				handled = true;
			} else if (e.equals(KeyCode.Escape)) {
				reject();
				handled = true;
			}

			if (handled) {
				e.preventDefault();
				e.stopPropagation();
			}
		}));
		templateData.renderDisposables.add((addDisposableListener(templateData.pathInput.inputElement, EventType.BLUR, () => {
			reject();
		})));

		const stringValue = item.uri.scheme === Schemas.file ? URI.revive(item.uri).fsPath : item.uri.path;
		templateData.pathInput.value = stringValue;
		templateData.pathLabel.innerText = stringValue;
		templateData.element.classList.toggle('current-workspace-parent', item.parentOfWorkspaceItem);

		// templateData.pathLabel.style.display = '';
	}

	disposeTemplate(templateData: ITrustedUriPathColumnTemplateData): void {
		templateData.disposables.dispose();
		templateData.renderDisposables.dispose();
	}

}


interface ITrustedUriHostColumnTemplateData {
	element: HTMLElement;
	hostContainer: HTMLElement;
	buttonBarContainer: HTMLElement;
	disposables: DisposableStore;
	renderDisposables: DisposableStore;
}

function getHostLabel(labelService: ILabelService, item: ITrustedUriItem): string {
	return item.uri.authority ? labelService.getHostLabel(item.uri.scheme, item.uri.authority) : localize('localAuthority', "Local");
}

class TrustedUriHostColumnRenderer implements ITableRenderer<ITrustedUriItem, ITrustedUriHostColumnTemplateData> {
	static readonly TEMPLATE_ID = 'host';

	readonly templateId: string = TrustedUriHostColumnRenderer.TEMPLATE_ID;

	constructor(
		@ILabelService private readonly labelService: ILabelService,
	) { }

	renderTemplate(container: HTMLElement): ITrustedUriHostColumnTemplateData {
		const disposables = new DisposableStore();
		const renderDisposables = disposables.add(new DisposableStore());

		const element = container.appendChild($('.host'));
		const hostContainer = element.appendChild($('div.host-label'));
		const buttonBarContainer = element.appendChild($('div.button-bar'));

		return {
			element,
			hostContainer,
			buttonBarContainer,
			disposables,
			renderDisposables
		};
	}

	renderElement(item: ITrustedUriItem, index: number, templateData: ITrustedUriHostColumnTemplateData, height: number | undefined): void {
		templateData.renderDisposables.clear();
		templateData.renderDisposables.add({ dispose: () => { clearNode(templateData.buttonBarContainer); } });

		templateData.hostContainer.innerText = getHostLabel(this.labelService, item);
		templateData.element.classList.toggle('current-workspace-parent', item.parentOfWorkspaceItem);

		templateData.hostContainer.style.display = '';
		templateData.buttonBarContainer.style.display = 'none';
	}

	disposeTemplate(templateData: ITrustedUriHostColumnTemplateData): void {
		templateData.disposables.dispose();
	}

}

export class WorkspaceTrustEditor extends EditorPane {
	static readonly ID: string = 'workbench.editor.workspaceTrust';
	private rootElement!: HTMLElement;

	// Header Section
	private headerContainer!: HTMLElement;
	private headerTitleContainer!: HTMLElement;
	private headerTitleIcon!: HTMLElement;
	private headerTitleText!: HTMLElement;
	private headerDescription!: HTMLElement;

	private bodyScrollBar!: DomScrollableElement;

	// Affected Features Section
	private affectedFeaturesContainer!: HTMLElement;

	// Settings Section
	private configurationContainer!: HTMLElement;
	private workspaceTrustedUrisTable!: WorkspaceTrustedUrisTable;

	constructor(
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IExtensionsWorkbenchService private readonly extensionWorkbenchService: IExtensionsWorkbenchService,
		@IExtensionManifestPropertiesService private readonly extensionManifestPropertiesService: IExtensionManifestPropertiesService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IWorkspaceTrustManagementService private readonly workspaceTrustManagementService: IWorkspaceTrustManagementService,
		@IWorkbenchConfigurationService private readonly configurationService: IWorkbenchConfigurationService,
		@IWorkbenchExtensionEnablementService private readonly extensionEnablementService: IWorkbenchExtensionEnablementService
	) { super(WorkspaceTrustEditor.ID, telemetryService, themeService, storageService); }

	protected createEditor(parent: HTMLElement): void {
		this.rootElement = append(parent, $('.workspace-trust-editor', { tabindex: '0' }));
		this.rootElement.style.visibility = 'hidden';

		this.createHeaderElement(this.rootElement);

		const scrollableContent = $('.workspace-trust-editor-body');
		this.bodyScrollBar = this._register(new DomScrollableElement(scrollableContent, {
			horizontal: ScrollbarVisibility.Hidden,
			vertical: ScrollbarVisibility.Auto,
		}));

		append(this.rootElement, this.bodyScrollBar.getDomNode());

		this.createAffectedFeaturesElement(scrollableContent);
		this.createConfigurationElement(scrollableContent);

		this._register(attachStylerCallback(this.themeService, { debugIconStartForeground, editorErrorForeground, buttonBackground, buttonSecondaryBackground }, colors => {
			this.rootElement.style.setProperty('--workspace-trust-selected-color', colors.buttonBackground?.toString() || '');
			this.rootElement.style.setProperty('--workspace-trust-unselected-color', colors.buttonSecondaryBackground?.toString() || '');
			this.rootElement.style.setProperty('--workspace-trust-check-color', colors.debugIconStartForeground?.toString() || '');
			this.rootElement.style.setProperty('--workspace-trust-x-color', colors.editorErrorForeground?.toString() || '');
		}));
	}

	override focus() {
		this.rootElement.focus();
	}

	override async setInput(input: WorkspaceTrustEditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {

		await super.setInput(input, options, context, token);
		if (token.isCancellationRequested) { return; }

		await this.workspaceTrustManagementService.workspaceTrustInitialized;
		this.registerListeners();
		this.render();
	}

	private registerListeners(): void {
		this._register(this.extensionWorkbenchService.onChange(() => this.render()));
		this._register(this.configurationService.onDidChangeRestrictedSettings(() => this.render()));
		this._register(this.workspaceTrustManagementService.onDidChangeTrust(() => this.render()));
		this._register(this.workspaceTrustManagementService.onDidChangeTrustedFolders(() => this.render()));
	}

	private getHeaderContainerClass(trusted: boolean): string {
		if (trusted) {
			return 'workspace-trust-header workspace-trust-trusted';
		}

		return 'workspace-trust-header workspace-trust-untrusted';
	}

	private getHeaderTitleText(trusted: boolean): string {
		if (trusted) {
			if (this.workspaceTrustManagementService.isWorkspaceTrustForced()) {
				return localize('trustedUnsettableWindow', "This window is trusted");
			}

			switch (this.workspaceService.getWorkbenchState()) {
				case WorkbenchState.EMPTY:
					return localize('trustedHeaderWindow', "You trust this window");
				case WorkbenchState.FOLDER:
					return localize('trustedHeaderFolder', "You trust this folder");
				case WorkbenchState.WORKSPACE:
					return localize('trustedHeaderWorkspace', "You trust this workspace");
			}
		}

		return localize('untrustedHeader', "You are in Restricted Mode");
	}

	private getHeaderTitleIconClassNames(trusted: boolean): string[] {
		return shieldIcon.classNamesArray;
	}

	private getFeaturesHeaderText(trusted: boolean): [string, string] {
		let title: string = '';
		let subTitle: string = '';

		switch (this.workspaceService.getWorkbenchState()) {
			case WorkbenchState.EMPTY: {
				title = trusted ? localize('trustedWindow', "In a Trusted Window") : localize('untrustedWorkspace', "In Restricted Mode");
				subTitle = trusted ? localize('trustedWindowSubtitle', "You trust the authors of the files in the current window. All features are enabled:") :
					localize('untrustedWindowSubtitle', "You do not trust the authors of the files in the current window. The following features are disabled:");
				break;
			}
			case WorkbenchState.FOLDER: {
				title = trusted ? localize('trustedFolder', "In a Trusted Folder") : localize('untrustedWorkspace', "In Restricted Mode");
				subTitle = trusted ? localize('trustedFolderSubtitle', "You trust the authors of the files in the current folder. All features are enabled:") :
					localize('untrustedFolderSubtitle', "You do not trust the authors of the files in the current folder. The following features are disabled:");
				break;
			}
			case WorkbenchState.WORKSPACE: {
				title = trusted ? localize('trustedWorkspace', "In a Trusted Workspace") : localize('untrustedWorkspace', "In Restricted Mode");
				subTitle = trusted ? localize('trustedWorkspaceSubtitle', "You trust the authors of the files in the current workspace. All features are enabled:") :
					localize('untrustedWorkspaceSubtitle', "You do not trust the authors of the files in the current workspace. The following features are disabled:");
				break;
			}
		}

		return [title, subTitle];
	}

	private rendering = false;
	private rerenderDisposables: DisposableStore = this._register(new DisposableStore());
	@debounce(100)
	private async render() {
		if (this.rendering) {
			return;
		}

		this.rendering = true;
		this.rerenderDisposables.clear();

		const isWorkspaceTrusted = this.workspaceTrustManagementService.isWorkspaceTrusted();
		this.rootElement.classList.toggle('trusted', isWorkspaceTrusted);
		this.rootElement.classList.toggle('untrusted', !isWorkspaceTrusted);

		// Header Section
		this.headerTitleText.innerText = this.getHeaderTitleText(isWorkspaceTrusted);
		this.headerTitleIcon.className = 'workspace-trust-title-icon';
		this.headerTitleIcon.classList.add(...this.getHeaderTitleIconClassNames(isWorkspaceTrusted));
		this.headerDescription.innerText = '';

		const headerDescriptionText = append(this.headerDescription, $('div'));
		headerDescriptionText.innerText = isWorkspaceTrusted ?
			localize('trustedDescription', "All features are enabled because trust has been granted to the workspace.") :
			localize('untrustedDescription', "{0} is in a restricted mode intended for safe code browsing.", product.nameShort);

		const headerDescriptionActions = append(this.headerDescription, $('div'));
		const headerDescriptionActionsText = localize({ key: 'workspaceTrustEditorHeaderActions', comment: ['Please ensure the markdown link syntax is not broken up with whitespace [text block](link block)'] }, "[Configure your settings]({0}) or [learn more](https://aka.ms/vscode-workspace-trust).", `command:workbench.trust.configure`);
		for (const node of parseLinkedText(headerDescriptionActionsText).nodes) {
			if (typeof node === 'string') {
				append(headerDescriptionActions, document.createTextNode(node));
			} else {
				const link = this.instantiationService.createInstance(Link, node, {});
				append(headerDescriptionActions, link.el);
				this.rerenderDisposables.add(link);
			}
		}

		this.headerContainer.className = this.getHeaderContainerClass(isWorkspaceTrusted);
		this.rootElement.setAttribute('aria-label', `${localize('root element label', "Manage Workspace Trust")}:  ${this.headerContainer.innerText}`);

		// Settings
		const restrictedSettings = this.configurationService.restrictedSettings;
		const configurationRegistry = Registry.as<IConfigurationRegistry>(Extensions.Configuration);
		const settingsRequiringTrustedWorkspaceCount = restrictedSettings.default.filter(key => {
			const property = configurationRegistry.getConfigurationProperties()[key];

			// cannot be configured in workspace
			if (property.scope === ConfigurationScope.APPLICATION || property.scope === ConfigurationScope.MACHINE) {
				return false;
			}

			// If deprecated include only those configured in the workspace
			if (property.deprecationMessage || property.markdownDeprecationMessage) {
				if (restrictedSettings.workspace?.includes(key)) {
					return true;
				}
				if (restrictedSettings.workspaceFolder) {
					for (const workspaceFolderSettings of restrictedSettings.workspaceFolder.values()) {
						if (workspaceFolderSettings.includes(key)) {
							return true;
						}
					}
				}
				return false;
			}

			return true;
		}).length;

		// Features List
		this.renderAffectedFeatures(settingsRequiringTrustedWorkspaceCount, this.getExtensionCount());

		// Configuration Tree
		this.workspaceTrustedUrisTable.updateTable();

		this.bodyScrollBar.getDomNode().style.height = `calc(100% - ${this.headerContainer.clientHeight}px)`;
		this.bodyScrollBar.scanDomNode();
		this.rootElement.style.visibility = '';
		this.rendering = false;
	}

	private getExtensionCount(): number {
		const set = new Set<string>();

		const inVirtualWorkspace = isVirtualWorkspace(this.workspaceService.getWorkspace());
		const localExtensions = this.extensionWorkbenchService.local.filter(ext => ext.local).map(ext => ext.local!);

		for (const extension of localExtensions) {
			const enablementState = this.extensionEnablementService.getEnablementState(extension);
			if (enablementState !== EnablementState.EnabledGlobally && enablementState !== EnablementState.EnabledWorkspace &&
				enablementState !== EnablementState.DisabledByTrustRequirement && enablementState !== EnablementState.DisabledByExtensionDependency) {
				continue;
			}

			if (inVirtualWorkspace && this.extensionManifestPropertiesService.getExtensionVirtualWorkspaceSupportType(extension.manifest) === false) {
				continue;
			}

			if (this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(extension.manifest) !== true) {
				set.add(extension.identifier.id);
				continue;
			}

			const dependencies = getExtensionDependencies(localExtensions, extension);
			if (dependencies.some(ext => this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(ext.manifest) === false)) {
				set.add(extension.identifier.id);
			}
		}

		return set.size;
	}

	private createHeaderElement(parent: HTMLElement): void {
		this.headerContainer = append(parent, $('.workspace-trust-header'));
		this.headerTitleContainer = append(this.headerContainer, $('.workspace-trust-title'));
		this.headerTitleIcon = append(this.headerTitleContainer, $('.workspace-trust-title-icon'));
		this.headerTitleText = append(this.headerTitleContainer, $('.workspace-trust-title-text'));
		this.headerDescription = append(this.headerContainer, $('.workspace-trust-description'));
	}

	private createConfigurationElement(parent: HTMLElement): void {
		this.configurationContainer = append(parent, $('.workspace-trust-settings'));
		const configurationTitle = append(this.configurationContainer, $('.workspace-trusted-folders-title'));
		configurationTitle.innerText = localize('trustedFoldersAndWorkspaces', "Trusted Folders & Workspaces");

		this.workspaceTrustedUrisTable = this._register(this.instantiationService.createInstance(WorkspaceTrustedUrisTable, this.configurationContainer));
	}

	private createAffectedFeaturesElement(parent: HTMLElement): void {
		this.affectedFeaturesContainer = append(parent, $('.workspace-trust-features'));
	}

	private async renderAffectedFeatures(numSettings: number, numExtensions: number): Promise<void> {
		clearNode(this.affectedFeaturesContainer);

		// Trusted features
		const trustedContainer = append(this.affectedFeaturesContainer, $('.workspace-trust-limitations.trusted'));
		const [trustedTitle, trustedSubTitle] = this.getFeaturesHeaderText(true);

		this.renderLimitationsHeaderElement(trustedContainer, trustedTitle, trustedSubTitle);
		const trustedContainerItems = this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY ?
			[
				localize('trustedTasks', "Tasks are allowed to run"),
				localize('trustedDebugging', "Debugging is enabled"),
				localize('trustedExtensions', "All extensions are enabled")
			] :
			[
				localize('trustedTasks', "Tasks are allowed to run"),
				localize('trustedDebugging', "Debugging is enabled"),
				localize('trustedSettings', "All workspace settings are applied"),
				localize('trustedExtensions', "All extensions are enabled")
			];
		this.renderLimitationsListElement(trustedContainer, trustedContainerItems, checkListIcon.classNamesArray);

		// Restricted Mode features
		const untrustedContainer = append(this.affectedFeaturesContainer, $('.workspace-trust-limitations.untrusted'));
		const [untrustedTitle, untrustedSubTitle] = this.getFeaturesHeaderText(false);

		this.renderLimitationsHeaderElement(untrustedContainer, untrustedTitle, untrustedSubTitle);
		const untrustedContainerItems = this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY ?
			[
				localize('untrustedTasks', "Tasks are not allowed to run"),
				localize('untrustedDebugging', "Debugging is disabled"),
				localize({ key: 'untrustedExtensions', comment: ['Please ensure the markdown link syntax is not broken up with whitespace [text block](link block)'] }, "[{0} extensions]({1}) are disabled or have limited functionality", numExtensions, `command:${LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID}`)
			] :
			[
				localize('untrustedTasks', "Tasks are not allowed to run"),
				localize('untrustedDebugging', "Debugging is disabled"),
				numSettings ? localize({ key: 'untrustedSettings', comment: ['Please ensure the markdown link syntax is not broken up with whitespace [text block](link block)'] }, "[{0} workspace settings]({1}) are not applied", numSettings, 'command:settings.filterUntrusted') : localize('no untrustedSettings', "Workspace settings requiring trust are not applied"),
				localize({ key: 'untrustedExtensions', comment: ['Please ensure the markdown link syntax is not broken up with whitespace [text block](link block)'] }, "[{0} extensions]({1}) are disabled or have limited functionality", numExtensions, `command:${LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID}`)
			];
		this.renderLimitationsListElement(untrustedContainer, untrustedContainerItems, xListIcon.classNamesArray);

		if (this.workspaceTrustManagementService.isWorkspaceTrusted()) {
			if (this.workspaceTrustManagementService.canSetWorkspaceTrust()) {
				this.addDontTrustButtonToElement(untrustedContainer);
			} else {
				this.addTrustedTextToElement(untrustedContainer);
			}
		} else {
			if (this.workspaceTrustManagementService.canSetWorkspaceTrust()) {
				this.addTrustButtonToElement(trustedContainer);
			}
		}
	}

	private createButtonRow(parent: HTMLElement, actions: Action | Action[], enabled?: boolean): void {
		const buttonRow = append(parent, $('.workspace-trust-buttons-row'));
		const buttonContainer = append(buttonRow, $('.workspace-trust-buttons'));
		const buttonBar = this.rerenderDisposables.add(new ButtonBar(buttonContainer));

		if (actions instanceof Action) {
			actions = [actions];
		}

		for (const action of actions) {
			const button =
				action instanceof ChoiceAction && action.menu?.length ?
					buttonBar.addButtonWithDropdown({
						title: true,
						actions: action.menu ?? [],
						contextMenuProvider: this.contextMenuService
					}) :
					buttonBar.addButton();

			button.label = action.label;
			button.enabled = enabled !== undefined ? enabled : action.enabled;

			this.rerenderDisposables.add(button.onDidClick(e => {
				if (e) {
					EventHelper.stop(e, true);
				}

				action.run();
			}));

			this.rerenderDisposables.add(attachButtonStyler(button, this.themeService));
		}
	}

	private addTrustButtonToElement(parent: HTMLElement): void {
		const trustActions = [
			new Action('workspace.trust.button.action.grant', localize('trustButton', "Trust"), undefined, true, async () => {
				await this.workspaceTrustManagementService.setWorkspaceTrust(true);
			})
		];

		if (this.workspaceTrustManagementService.canSetParentFolderTrust()) {
			const workspaceIdentifier = toWorkspaceIdentifier(this.workspaceService.getWorkspace()) as ISingleFolderWorkspaceIdentifier;
			const { name } = splitName(splitName(workspaceIdentifier.uri.fsPath).parentPath);

			const trustMessageElement = append(parent, $('.trust-message-box'));
			trustMessageElement.innerText = localize('trustMessage', "Trust the authors of all files in the current folder or its parent '{0}'.", name);

			trustActions.push(new Action('workspace.trust.button.action.grantParent', localize('trustParentButton', "Trust Parent"), undefined, true, async () => {
				await this.workspaceTrustManagementService.setParentFolderTrust(true);
			}));
		}

		this.createButtonRow(parent, trustActions);
	}

	private addDontTrustButtonToElement(parent: HTMLElement): void {
		this.createButtonRow(parent, new Action('workspace.trust.button.action.deny', localize('dontTrustButton', "Don't Trust"), undefined, true, async () => {
			await this.workspaceTrustManagementService.setWorkspaceTrust(false);
		}));
	}

	private addTrustedTextToElement(parent: HTMLElement): void {
		if (this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY) {
			return;
		}

		const textElement = append(parent, $('.workspace-trust-untrusted-description'));
		if (!this.workspaceTrustManagementService.isWorkspaceTrustForced()) {
			textElement.innerText = this.workspaceService.getWorkbenchState() === WorkbenchState.WORKSPACE ? localize('untrustedWorkspaceReason', "This workspace is trusted via the bolded entries in the trusted folders below.") : localize('untrustedFolderReason', "This folder is trusted via the bolded entries in the the trusted folders below.");
		} else {
			textElement.innerText = localize('trustedForcedReason', "This window is trusted by nature of the workspace that is opened.");
		}
	}

	private renderLimitationsHeaderElement(parent: HTMLElement, headerText: string, subtitleText: string): void {
		const limitationsHeaderContainer = append(parent, $('.workspace-trust-limitations-header'));
		const titleElement = append(limitationsHeaderContainer, $('.workspace-trust-limitations-title'));
		const textElement = append(titleElement, $('.workspace-trust-limitations-title-text'));
		const subtitleElement = append(limitationsHeaderContainer, $('.workspace-trust-limitations-subtitle'));

		textElement.innerText = headerText;
		subtitleElement.innerText = subtitleText;
	}

	private renderLimitationsListElement(parent: HTMLElement, limitations: string[], iconClassNames: string[]): void {
		const listContainer = append(parent, $('.workspace-trust-limitations-list-container'));
		const limitationsList = append(listContainer, $('ul'));
		for (const limitation of limitations) {
			const limitationListItem = append(limitationsList, $('li'));
			const icon = append(limitationListItem, $('.list-item-icon'));
			const text = append(limitationListItem, $('.list-item-text'));

			icon.classList.add(...iconClassNames);

			const linkedText = parseLinkedText(limitation);
			for (const node of linkedText.nodes) {
				if (typeof node === 'string') {
					append(text, document.createTextNode(node));
				} else {
					const link = this.instantiationService.createInstance(Link, node, {});
					append(text, link.el);
					this.rerenderDisposables.add(link);
				}
			}
		}
	}

	private layoutParticipants: { layout: () => void; }[] = [];
	layout(dimension: Dimension): void {
		if (!this.isVisible()) {
			return;
		}

		this.workspaceTrustedUrisTable.layout();

		this.layoutParticipants.forEach(participant => {
			participant.layout();
		});

		this.bodyScrollBar.scanDomNode();
	}
}
