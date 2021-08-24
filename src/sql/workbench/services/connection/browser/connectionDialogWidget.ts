/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/connectionDialog';
import { Button } from 'sql/base/browser/ui/button/button';
import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { HideReason, Modal } from 'sql/workbench/browser/modal/modal';
import { IConnectionManagementService, INewConnectionParams } from 'sql/platform/connection/common/connectionManagement';
import * as DialogHelper from 'sql/workbench/browser/modal/dialogHelper';
import { TreeCreationUtils } from 'sql/workbench/services/objectExplorer/browser/treeCreationUtils';
import { TabbedPanel, PanelTabIdentifier } from 'sql/base/browser/ui/panel/panel';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { contrastBorder } from 'vs/platform/theme/common/colorRegistry';
import { Event, Emitter } from 'vs/base/common/event';
import { StandardKeyboardEvent } from 'vs/base/browser/keyboardEvent';
import { localize } from 'vs/nls';
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

import { IConnectionProfile } from 'azdata';
import { TreeUpdateUtils } from 'sql/workbench/services/objectExplorer/browser/treeUpdateUtils';
import { ConnectionProfile } from 'sql/platform/connection/common/connectionProfile';
import { ICancelableEvent } from 'vs/base/parts/tree/browser/treeDefaults';
import { RecentConnectionActionsProvider, RecentConnectionTreeController } from 'sql/workbench/services/connection/browser/recentConnectionTreeController';
import { ClearRecentConnectionsAction } from 'sql/workbench/services/connection/browser/connectionActions';
import { ITree } from 'vs/base/parts/tree/browser/tree';
import { AsyncServerTree } from 'sql/workbench/services/objectExplorer/browser/asyncServerTree';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { ConnectionBrowseTab } from 'sql/workbench/services/connection/browser/connectionBrowseTab';

export interface OnShowUIResponse {
	selectedProviderDisplayName: string;
	container: HTMLElement;
}

/**
 * Defines where the connection information is coming from
 */
export type ConnectionSource = 'manual' | 'recent' | 'savedconnections' | 'azure';

export class ConnectionDialogWidget extends Modal {
	private _body: HTMLElement;
	private _recentConnection: HTMLElement;
	private _noRecentConnection: HTMLElement;
	private _recentConnectionActionBarContainer: HTMLElement;
	private _connectionTypeContainer: HTMLElement;
	private _connectionDetailTitle: HTMLElement;
	private _connectButton: Button;
	private _closeButton: Button;
	private _providerTypeSelectBox: SelectBox;
	private _newConnectionParams: INewConnectionParams;
	private _recentConnectionTree: AsyncServerTree | ITree;
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

	private browsePanel: ConnectionBrowseTab;

	private _connecting = false;

	private _connectionSource: ConnectionSource = 'manual';

	constructor(
		private providerDisplayNameOptions: string[],
		private selectedProviderType: string,
		private providerNameToDisplayNameMap: { [providerDisplayName: string]: string },
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConnectionManagementService private readonly connectionManagementService: IConnectionManagementService,
		@IContextMenuService private readonly contextMenuService: IContextMenuService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IThemeService themeService: IThemeService,
		@ILayoutService layoutService: ILayoutService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IConfigurationService private _configurationService: IConfigurationService
	) {
		super(
			localize('connection', "Connection"),
			TelemetryKeys.ModalDialogName.Connection,
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

	public getDisplayNameFromProviderName(providerName: string): string {
		return this.providerNameToDisplayNameMap[providerName];
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
		let uniqueProvidersMap = this.connectionManagementService.getUniqueConnectionProvidersByNameMap(filteredProviderMap);
		this._providerTypeSelectBox.setOptions(Object.keys(uniqueProvidersMap).map(k => uniqueProvidersMap[k]));
	}

	private includeProvider(providerName: string, params?: INewConnectionParams): Boolean {
		return params === undefined || params.providers === undefined || params.providers.some(x => x === providerName);
	}

	protected renderBody(container: HTMLElement): void {
		this._body = DOM.append(container, DOM.$('.connection-dialog'));

		const connectTypeLabel = localize('connectType', "Connection type");
		this._providerTypeSelectBox = new SelectBox(this.providerDisplayNameOptions, this.selectedProviderType, this.contextViewService, undefined, { ariaLabel: connectTypeLabel });
		// Recent connection tab
		const recentConnectionTab = DOM.$('.connection-recent-tab');
		const recentConnectionContainer = DOM.append(recentConnectionTab, DOM.$('.connection-recent', { id: 'recentConnection' }));
		this._recentConnection = DOM.append(recentConnectionContainer, DOM.$('div'));
		this._recentConnection.style.height = '100%';
		this._noRecentConnection = DOM.append(recentConnectionContainer, DOM.$('div'));
		this.createRecentConnections();
		DOM.hide(this._recentConnection);

		this._panel = new TabbedPanel(this._body);
		this._panel.element.style.margin = '0px 10px';
		attachTabbedPanelStyler(this._panel, this._themeService);
		this._recentConnectionTabId = this._panel.pushTab({
			identifier: 'recent_connection',
			title: localize('recentConnectionTitle', "Recent"),
			view: {
				render: c => {
					c.append(recentConnectionTab);
				},
				layout: (dimension: DOM.Dimension) => {
					this._recentConnectionTree.layout(dimension.height - DOM.getTotalHeight(this._recentConnectionActionBarContainer));
				}
			}
		});

		this.browsePanel = new ConnectionBrowseTab(this.instantiationService);

		this._register(this.browsePanel.view.onSelectedConnectionChanged(e => {
			this._connectionSource = e.source;
			this.onConnectionClick(e.connectionProfile, e.connect);
		}));

		this._panel.pushTab(this.browsePanel);

		this._connectionDetailTitle = DOM.append(this._body, DOM.$('.connection-details-title'));

		this._connectionDetailTitle.innerText = localize('connectionDetailsTitle', "Connection Details");

		this._connectionTypeContainer = DOM.append(this._body, DOM.$('.connection-type'));
		const table = DOM.append(this._connectionTypeContainer, DOM.$('table.connection-table-content'));
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
	public override render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		const connectLabel = localize('connectionDialog.connect', "Connect");
		const cancelLabel = localize('connectionDialog.cancel', "Cancel");
		this._connectButton = this.addFooterButton(connectLabel, () => this.connect());
		this._connectButton.enabled = false;
		this._closeButton = this.addFooterButton(cancelLabel, () => this.cancel(), 'right', true);
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
		this._register(styler.attachButtonStyler(this._connectButton, this._themeService));
		this._register(styler.attachButtonStyler(this._closeButton, this._themeService));

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
		this.logService.debug('ConnectionDialogWidget: Connect button is clicked');
		if (this._connectButton.enabled) {
			this._telemetryService.createActionEvent(TelemetryKeys.TelemetryView.ConnectionDialog, TelemetryKeys.TelemetryAction.ConnectToServer).withAdditionalProperties(
				{ [TelemetryKeys.TelemetryPropertyName.ConnectionSource]: this._connectionSource }
			).send();
			this._connecting = true;
			this._connectButton.enabled = false;
			this._providerTypeSelectBox.disable();
			this.spinner = true;
			this._onConnect.fire(element);
			this.logService.debug('ConnectionDialogWidget: onConnect event is fired');
		}
	}

	/* Overwrite espace key behavior */
	protected override onClose(e: StandardKeyboardEvent) {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected override onAccept(e: StandardKeyboardEvent) {
		if (!e.target.classList.contains('monaco-tree')) {
			this.connect();
		}
	}

	private cancel() {
		const wasConnecting = this._connecting;
		this._onCancel.fire();
		if (!this._databaseDropdownExpanded && !wasConnecting) {
			this.close('cancel');
		}
	}

	public close(hideReason: HideReason = 'close') {
		this.resetConnection();
		this.hide(hideReason);
	}

	private createRecentConnectionList(): void {
		const recentConnectionContainer = DOM.append(this._recentConnection, DOM.$('.connection-recent-content'));
		this._recentConnectionActionBarContainer = DOM.append(recentConnectionContainer, DOM.$('.recent-titles-container'));
		const actionsContainer = DOM.append(this._recentConnectionActionBarContainer, DOM.$('.connection-history-actions'));
		this._actionbar = this._register(new ActionBar(actionsContainer, { animated: false }));
		const clearAction = this.instantiationService.createInstance(ClearRecentConnectionsAction, ClearRecentConnectionsAction.ID, ClearRecentConnectionsAction.LABEL);
		clearAction.useConfirmationMessage = true;
		clearAction.onRecentConnectionsRemoved(() => this.open(false));
		this._actionbar.push(clearAction, { icon: true, label: true });
		const divContainer = DOM.append(recentConnectionContainer, DOM.$('.server-explorer-viewlet'));
		const treeContainer = DOM.append(divContainer, DOM.$('.explorer-servers'));
		const leftClick = (element: any, eventish: ICancelableEvent, origin: string) => {
			// element will be a server group if the blank area of the tree is clicked, we should only proceed is a connection profile is selected.
			if (element instanceof ConnectionProfile) {
				const isDoubleClick = origin === 'mouse' && (eventish as MouseEvent).detail === 2;
				this._connectionSource = 'recent';
				this.onConnectionClick(element, isDoubleClick);
			}
		};
		const actionProvider = this.instantiationService.createInstance(RecentConnectionActionsProvider);
		const controller = new RecentConnectionTreeController(leftClick, actionProvider, this.connectionManagementService, this.contextMenuService);
		actionProvider.onRecentConnectionRemoved(() => {
			const recentConnections: ConnectionProfile[] = this.connectionManagementService.getRecentConnections();
			this.open(recentConnections.length > 0).catch(err => this.logService.error(`Unexpected error opening connection widget after a recent connection was removed from action provider: ${err}`));
			// We're just using the connections to determine if there are connections to show, dispose them right after to clean up their handlers
			recentConnections.forEach(conn => conn.dispose());
		});
		controller.onRecentConnectionRemoved(() => {
			const recentConnections: ConnectionProfile[] = this.connectionManagementService.getRecentConnections();
			this.open(recentConnections.length > 0).catch(err => this.logService.error(`Unexpected error opening connection widget after a recent connection was removed from controller : ${err}`));
			// We're just using the connections to determine if there are connections to show, dispose them right after to clean up their handlers
			recentConnections.forEach(conn => conn.dispose());
		});
		this._recentConnectionTree = TreeCreationUtils.createConnectionTree(treeContainer, this.instantiationService, this._configurationService, localize('connectionDialog.recentConnections', "Recent Connections"), controller);
		if (this._recentConnectionTree instanceof AsyncServerTree) {
			this._recentConnectionTree.onMouseClick(e => {
				if (e.element instanceof ConnectionProfile) {
					this._connectionSource = 'recent';
					this.onConnectionClick(e.element, false);
				}
			});
			this._recentConnectionTree.onMouseDblClick(e => {
				if (e.element instanceof ConnectionProfile) {
					this._connectionSource = 'recent';
					this.onConnectionClick(e.element, true);
				}
			});
		}

		// Theme styler
		this._register(styler.attachListStyler(this._recentConnectionTree, this._themeService));
	}

	private createRecentConnections() {
		this.createRecentConnectionList();
		const noRecentConnectionContainer = DOM.append(this._noRecentConnection, DOM.$('.connection-recent-content'));
		const noRecentHistoryLabel = localize('noRecentConnections', "No recent connection");
		DOM.append(noRecentConnectionContainer, DOM.$('.no-recent-connections')).innerText = noRecentHistoryLabel;
	}

	private onConnectionClick(element: IConnectionProfile, connect: boolean = false): void {
		if (connect) {
			this.connect(element);
		} else {
			this._onFillinConnectionInputs.fire(element);
		}
	}

	/**
	 * Open the flyout dialog
	 * @param recentConnections Are there recent connections that should be shown
	 */
	public async open(recentConnections: boolean): Promise<void> {
		this._connectionSource = 'manual';
		this._panel.showTab(this._recentConnectionTabId);

		this.show();
		if (recentConnections) {
			DOM.hide(this._noRecentConnection);
			DOM.show(this._recentConnection);
		} else {
			DOM.hide(this._recentConnection);
			DOM.show(this._noRecentConnection);
		}
		await TreeUpdateUtils.structuralTreeUpdate(this._recentConnectionTree, 'recent', this.connectionManagementService, this._providers);
		this._recentConnectionTree.layout(DOM.getTotalHeight(this._recentConnectionTree.getHTMLElement()));
		// call layout with view height
		this.initDialog();
	}

	protected layout(height: number): void {
		this._panel.layout(new DOM.Dimension(this._panel.element.clientWidth, this._panel.element.clientHeight));
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
