/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/connectionDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { IConnectionManagementService, INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { TreeCreationUtils } from 'sql/workbench/services/objectExplorer/browser/treeCreationUtils';
import { TreeUpdateUtils, IExpandableTree } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { TabbedPanel, PanelTabIdentifier } from 'sql/base/browser/ui/panel/panel';
import { RecentConnectionTreeController, RecentConnectionActionsProvider } from 'sql/workbench/services/connection/browser/recentConnectionTreeController';
import { SavedConnectionTreeController } from 'sql/workbench/services/connection/browser/savedConnectionTreeController';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { ClearRecentConnectionsAction } from 'sql/workbench/services/connection/browser/connectionActions';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { contrastBorder } from 'vs/platform/theme/common/colorRegistry';
import { Event, Emitter } from 'vs/base/common/event';
import { ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { localize } from 'vs/nls';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { IContextMenuService, IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import * as styler from 'vs/platform/theme/common/styler';
import * as DOM from 'vs/base/browser/dom';
import { ActionBar } from 'vs/base/browser/ui/actionbar/actionbar';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { entries } from 'sql/base/common/collections';
import { attachTabbedPanelStyler, attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

export interface OnShowUIResponse {
	selectedProviderDisplayName: string;
	container: HTMLElement;
}

export class ConnectionDialogWidget extends Modal {
	private _body: HTMLElement;
	private _recentConnection: HTMLElement;
	private _noRecentConnection: HTMLElement;
	private _savedConnection: HTMLElement;
	private _noSavedConnection: HTMLElement;
	private _connectionDetailTitle: HTMLElement;
	private _connectButton: Button;
	private _closeButton: Button;
	private _providerTypeSelectBox: SelectBox;
	private _newConnectionParams: INewConnectionParams;
	private _recentConnectionTree: ITree;
	private _savedConnectionTree: ITree;
	private _connectionUIContainer: HTMLElement;
	private _databaseDropdownExpanded: boolean;
	private _actionbar: ActionBar;
	private _providers: string[];

	private _panel: TabbedPanel;
	private _recentConnectionTabId: PanelTabIdentifier;

	private _onInitDialog = new Emitter<void>();
	public onInitDialog: Event<void> = this._onInitDialog.event;

	private _onCancel = new Emitter<void>();
	public onCancel: Event<void> = this._onCancel.event;

	private _onConnect = new Emitter<IConnectionProfile>();
	public onConnect: Event<IConnectionProfile> = this._onConnect.event;

	private _onShowUiComponent = new Emitter<OnShowUIResponse>();
	public onShowUiComponent: Event<OnShowUIResponse> = this._onShowUiComponent.event;

	private _onFillinConnectionInputs = new Emitter<IConnectionProfile>();

	public onFillinConnectionInputs: Event<IConnectionProfile> = this._onFillinConnectionInputs.event;
	private _onResetConnection = new Emitter<void>();
	public onResetConnection: Event<void> = this._onResetConnection.event;

	private _connecting = false;

	constructor(
		private providerDisplayNameOptions: string[],
		private selectedProviderType: string,
		private providerNameToDisplayNameMap: { [providerDisplayName: string]: string },
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IConnectionManagementService private _connectionManagementService: IConnectionManagementService,
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IContextMenuService private _contextMenuService: IContextMenuService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService
	) {
		super(
			localize('connection', "Connection"),
			TelemetryKeys.Connection,
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{ hasSpinner: true, spinnerTitle: localize('connecting', "Connecting"), hasErrors: true });
	}

	/**
	 * Update the available connection providers, this is called when new providers are registered
	 * So that the connection type dropdown always has up to date values
	 */
	public updateConnectionProviders(
		providerTypeDisplayNameOptions: string[],
		providerNameToDisplayNameMap: { [providerDisplayName: string]: string }) {
		this.providerDisplayNameOptions = providerTypeDisplayNameOptions;
		this.providerNameToDisplayNameMap = providerNameToDisplayNameMap;
		this.refresh();
	}

	public refresh(): void {
		let filteredProviderMap = this.providerNameToDisplayNameMap;
		if (this._newConnectionParams && this._newConnectionParams.providers) {
			const validProviderMap = entries(this.providerNameToDisplayNameMap).filter(x => this.includeProvider(x[0], this._newConnectionParams));
			if (validProviderMap && validProviderMap.length > 0) {
				let map: { [providerDisplayName: string]: string } = {};
				validProviderMap.forEach(v => {
					map[v[0]] = v[1];
				});
				filteredProviderMap = map;
			}
		}

		// Remove duplicate listings (CMS uses the same display name)
		let uniqueProvidersMap = this._connectionManagementService.getUniqueConnectionProvidersByNameMap(filteredProviderMap);
		this._providerTypeSelectBox.setOptions(Object.keys(uniqueProvidersMap).map(k => uniqueProvidersMap[k]));
	}

	private includeProvider(providerName: string, params?: INewConnectionParams): Boolean {
		return params === undefined || params.providers === undefined || params.providers.some(x => x === providerName);
	}

	protected renderBody(container: HTMLElement): void {
		this._body = DOM.append(container, DOM.$('.connection-dialog'));

		const connectTypeLabel = localize('connectType', "Connection type");
		this._providerTypeSelectBox = new SelectBox(this.providerDisplayNameOptions, this.selectedProviderType, this._contextViewService, undefined, { ariaLabel: connectTypeLabel });
		// Recent connection tab
		const recentConnectionTab = DOM.$('.connection-recent-tab');
		const recentConnectionContainer = DOM.append(recentConnectionTab, DOM.$('.connection-recent', { id: 'recentConnection' }));
		this._recentConnection = DOM.append(recentConnectionContainer, DOM.$('div'));
		this._recentConnection.style.height = '100%';
		this._noRecentConnection = DOM.append(recentConnectionContainer, DOM.$('div'));
		this.createRecentConnections();
		DOM.hide(this._recentConnection);

		// Saved connection tab
		const savedConnectionTab = DOM.$('.connection-saved-tab');
		const savedConnectionContainer = DOM.append(savedConnectionTab, DOM.$('.connection-saved'));
		this._savedConnection = DOM.append(savedConnectionContainer, DOM.$('div'));
		this._savedConnection.style.height = '100%';
		this._noSavedConnection = DOM.append(savedConnectionContainer, DOM.$('div'));
		this.createSavedConnections();
		DOM.hide(this._savedConnection);

		this._panel = new TabbedPanel(this._body);
		attachTabbedPanelStyler(this._panel, this._themeService);
		this._recentConnectionTabId = this._panel.pushTab({
			identifier: 'recent_connection',
			title: localize('recentConnectionTitle', "Recent Connections"),
			view: {
				render: c => {
					c.append(recentConnectionTab);
				},
				layout: () => { },
				focus: () => this._recentConnectionTree.domFocus()
			}
		});

		const savedConnectionTabId = this._panel.pushTab({
			identifier: 'saved_connection',
			title: localize('savedConnectionTitle', "Saved Connections"),
			view: {
				layout: () => { },
				render: c => {
					c.append(savedConnectionTab);
				},
				focus: () => this._savedConnectionTree.domFocus()
			}
		});

		this._panel.onTabChange(async c => {
			// convert to old VS Code tree interface with expandable methods
			const expandableTree: IExpandableTree = <IExpandableTree>this._savedConnectionTree;

			if (c === savedConnectionTabId && expandableTree.getContentHeight() === 0) {
				// Update saved connection tree
				await TreeUpdateUtils.structuralTreeUpdate(this._savedConnectionTree, 'saved', this._connectionManagementService, this._providers);

				if (expandableTree.getContentHeight() > 0) {
					DOM.hide(this._noSavedConnection);
					DOM.show(this._savedConnection);
				} else {
					DOM.show(this._noSavedConnection);
					DOM.hide(this._savedConnection);
				}
				this._savedConnectionTree.layout(DOM.getTotalHeight(this._savedConnectionTree.getHTMLElement()));
			}
		});

		this._connectionDetailTitle = DOM.append(this._body, DOM.$('.connection-details-title'));

		this._connectionDetailTitle.innerText = localize('connectionDetailsTitle', "Connection Details");

		const tableContainer = DOM.append(this._body, DOM.$('.connection-type'));
		const table = DOM.append(tableContainer, DOM.$('table.connection-table-content'));
		DialogHelper.appendInputSelectBox(
			DialogHelper.appendRow(table, connectTypeLabel, 'connection-label', 'connection-input'), this._providerTypeSelectBox);

		this._connectionUIContainer = DOM.$('.connection-provider-info', { id: 'connectionProviderInfo' });
		this._body.append(this._connectionUIContainer);

		this._register(this._themeService.onDidColorThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this._themeService.getColorTheme());
	}

	/**
	 * Render the connection flyout
	 */
	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		const connectLabel = localize('connectionDialog.connect', "Connect");
		const cancelLabel = localize('connectionDialog.cancel', "Cancel");
		this._connectButton = this.addFooterButton(connectLabel, () => this.connect());
		this._connectButton.enabled = false;
		this._closeButton = this.addFooterButton(cancelLabel, () => this.cancel());
		this.registerListeners();
		this.onProviderTypeSelected(this._providerTypeSelectBox.value);
	}

	// Update theming that is specific to connection flyout body
	private updateTheme(theme: IColorTheme): void {
		const borderColor = theme.getColor(contrastBorder);
		const border = borderColor ? borderColor.toString() : null;
		const backgroundColor = theme.getColor(SIDE_BAR_BACKGROUND);
		if (this._connectionDetailTitle) {
			this._connectionDetailTitle.style.borderWidth = border ? '1px 0px' : null;
			this._connectionDetailTitle.style.borderStyle = border ? 'solid none' : null;
			this._connectionDetailTitle.style.borderColor = border;
			this._connectionDetailTitle.style.backgroundColor = backgroundColor ? backgroundColor.toString() : null;
		}
	}

	private registerListeners(): void {
		// Theme styler
		this._register(styler.attachSelectBoxStyler(this._providerTypeSelectBox, this._themeService));
		this._register(attachButtonStyler(this._connectButton, this._themeService));
		this._register(attachButtonStyler(this._closeButton, this._themeService));

		this._register(this._providerTypeSelectBox.onDidSelect(selectedProviderType => {
			this.onProviderTypeSelected(selectedProviderType.selected);
		}));
	}

	private onProviderTypeSelected(selectedProviderDisplayName: string) {
		// Show connection form based on server type
		DOM.clearNode(this._connectionUIContainer);
		this._onShowUiComponent.fire({ selectedProviderDisplayName: selectedProviderDisplayName, container: this._connectionUIContainer });
		this.initDialog();
	}

	private connect(element?: IConnectionProfile): void {
		if (this._connectButton.enabled) {
			this._connecting = true;
			this._connectButton.enabled = false;
			this._providerTypeSelectBox.disable();
			this.spinner = true;
			this._onConnect.fire(element);
		}
	}

	/* Overwrite espace key behavior */
	protected onClose(e: StandardKeyboardEvent) {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected onAccept(e: StandardKeyboardEvent) {
		if (!e.target.classList.contains('monaco-tree')) {
			this.connect();
		}
	}

	private cancel() {
		const wasConnecting = this._connecting;
		this._onCancel.fire();
		if (!this._databaseDropdownExpanded && !wasConnecting) {
			this.close();
		}
	}

	public close() {
		this.resetConnection();
		this.hide();
	}

	private createRecentConnectionList(): void {
		const recentConnectionContainer = DOM.append(this._recentConnection, DOM.$('.connection-recent-content'));
		const container = DOM.append(recentConnectionContainer, DOM.$('.recent-titles-container'));
		const actionsContainer = DOM.append(container, DOM.$('.connection-history-actions'));
		this._actionbar = this._register(new ActionBar(actionsContainer, { animated: false }));
		const clearAction = this._instantiationService.createInstance(ClearRecentConnectionsAction, ClearRecentConnectionsAction.ID, ClearRecentConnectionsAction.LABEL);
		clearAction.useConfirmationMessage = true;
		clearAction.onRecentConnectionsRemoved(() => this.open(false));
		this._actionbar.push(clearAction, { icon: true, label: true });
		const divContainer = DOM.append(recentConnectionContainer, DOM.$('.server-explorer-viewlet'));
		const treeContainer = DOM.append(divContainer, DOM.$('.explorer-servers'));
		const leftClick = (element: any, eventish: ICancelableEvent, origin: string) => {
			// element will be a server group if the tree is clicked rather than a item
			if (element instanceof ConnectionProfile) {
				this.onConnectionClick({ payload: { origin: origin, originalEvent: eventish } }, element);
			}
		};
		const actionProvider = this._instantiationService.createInstance(RecentConnectionActionsProvider);
		const controller = new RecentConnectionTreeController(leftClick, actionProvider, this._connectionManagementService, this._contextMenuService);
		actionProvider.onRecentConnectionRemoved(() => {
			const recentConnections: ConnectionProfile[] = this._connectionManagementService.getRecentConnections();
			this.open(recentConnections.length > 0).catch(err => this.logService.error(`Unexpected error opening connection widget after a recent connection was removed from action provider: ${err}`));
			// We're just using the connections to determine if there are connections to show, dispose them right after to clean up their handlers
			recentConnections.forEach(conn => conn.dispose());
		});
		controller.onRecentConnectionRemoved(() => {
			const recentConnections: ConnectionProfile[] = this._connectionManagementService.getRecentConnections();
			this.open(recentConnections.length > 0).catch(err => this.logService.error(`Unexpected error opening connection widget after a recent connection was removed from controller : ${err}`));
			// We're just using the connections to determine if there are connections to show, dispose them right after to clean up their handlers
			recentConnections.forEach(conn => conn.dispose());
		});
		this._recentConnectionTree = TreeCreationUtils.createConnectionTree(treeContainer, this._instantiationService, controller);

		// Theme styler
		this._register(styler.attachListStyler(this._recentConnectionTree, this._themeService));
	}

	private createRecentConnections() {
		this.createRecentConnectionList();
		const noRecentConnectionContainer = DOM.append(this._noRecentConnection, DOM.$('.connection-recent-content'));
		const noRecentHistoryLabel = localize('noRecentConnections', "No recent connection");
		DOM.append(noRecentConnectionContainer, DOM.$('.no-recent-connections')).innerText = noRecentHistoryLabel;
	}

	private createSavedConnectionList(): void {
		const savedConnectioncontainer = DOM.append(this._savedConnection, DOM.$('.connection-saved-content'));
		const divContainer = DOM.append(savedConnectioncontainer, DOM.$('.server-explorer-viewlet'));
		const treeContainer = DOM.append(divContainer, DOM.$('.explorer-servers'));
		const leftClick = (element: any, eventish: ICancelableEvent, origin: string) => {
			// element will be a server group if the tree is clicked rather than a item
			if (element instanceof ConnectionProfile) {
				this.onConnectionClick({ payload: { origin: origin, originalEvent: eventish } }, element);
			}
		};

		const controller = new SavedConnectionTreeController(leftClick);
		this._savedConnectionTree = TreeCreationUtils.createConnectionTree(treeContainer, this._instantiationService, controller);

		// Theme styler
		this._register(styler.attachListStyler(this._savedConnectionTree, this._themeService));
	}

	private createSavedConnections() {
		this.createSavedConnectionList();
		const noSavedConnectionContainer = DOM.append(this._noSavedConnection, DOM.$('.connection-saved-content'));
		const noSavedConnectionLabel = localize('noSavedConnections', "No saved connection");
		DOM.append(noSavedConnectionContainer, DOM.$('.no-saved-connections')).innerText = noSavedConnectionLabel;
	}

	private onConnectionClick(event: any, element: IConnectionProfile) {
		const isMouseOrigin = event.payload && (event.payload.origin === 'mouse');
		const isDoubleClick = isMouseOrigin && event.payload.originalEvent && event.payload.originalEvent.detail === 2;
		if (isDoubleClick) {
			this.connect(element);
		} else {
			if (element) {
				this._onFillinConnectionInputs.fire(element);
			}
		}
	}

	/**
	 * Open the flyout dialog
	 * @param recentConnections Are there recent connections that should be shown
	 */
	public async open(recentConnections: boolean): Promise<void> {
		this._panel.showTab(this._recentConnectionTabId);

		this.show();
		if (recentConnections) {
			DOM.hide(this._noRecentConnection);
			DOM.show(this._recentConnection);
		} else {
			DOM.hide(this._recentConnection);
			DOM.show(this._noRecentConnection);
		}
		await TreeUpdateUtils.structuralTreeUpdate(this._recentConnectionTree, 'recent', this._connectionManagementService, this._providers);

		// reset saved connection tree
		await this._savedConnectionTree.setInput([]);

		// call layout with view height
		this.layout();
		this.initDialog();
	}

	protected layout(height?: number): void {
		// Height is the overall height. Since we're laying out a specific component, always get its actual height
		this._recentConnectionTree.layout(DOM.getTotalHeight(this._recentConnectionTree.getHTMLElement()));
	}

	/**
	 * Set the state of the connect button
	 * @param enabled The state to set the the button
	 */
	public set connectButtonState(enabled: boolean) {
		this._connectButton.enabled = enabled;
	}

	/**
	 * Get the connect button state
	 */
	public get connectButtonState(): boolean {
		return this._connectButton.enabled;
	}

	private initDialog(): void {
		super.setError('');
		this.spinner = false;
		this._onInitDialog.fire();
	}

	public resetConnection(): void {
		this.spinner = false;
		this._connectButton.enabled = true;
		this._providerTypeSelectBox.enable();
		this._onResetConnection.fire();
		this._connecting = false;
	}

	public get newConnectionParams(): INewConnectionParams {
		return this._newConnectionParams;
	}

	public set newConnectionParams(params: INewConnectionParams) {
		this._newConnectionParams = params;
		this._providers = params && params.providers;
		this.refresh();
	}

	public updateProvider(providerDisplayName: string) {
		this._providerTypeSelectBox.selectWithOptionName(providerDisplayName);

		this.onProviderTypeSelected(providerDisplayName);
	}

	public set databaseDropdownExpanded(val: boolean) {
		this._databaseDropdownExpanded = val;
	}

	public get databaseDropdownExpanded(): boolean {
		return this._databaseDropdownExpanded;
	}
}
