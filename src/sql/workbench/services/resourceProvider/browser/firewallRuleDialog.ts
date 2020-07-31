/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/firewallRuleDialog';

import * as DOM from 'vs/base/browser/dom';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import { buttonBackground } from 'vs/platform/theme/common/colorRegistry';
import { attachInputBoxStyler } from 'vs/platform/theme/common/styler';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { SIDE_BAR_BACKGROUND } from 'vs/workbench/common/theme';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { URI } from 'vs/base/common/uri';

import * as azdata from 'azdata';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { FirewallRuleViewModel } from 'sql/platform/accounts/common/firewallRuleViewModel';
import { attachButtonStyler } from 'sql/platform/theme/common/styler';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IAccountPickerService } from 'sql/workbench/services/accountManagement/browser/accountPicker';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { ILogService } from 'vs/platform/log/common/log';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfigurationService';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';

// TODO: Make the help link 1) extensible (01/08/2018, https://github.com/Microsoft/azuredatastudio/issues/450)
// in case that other non-Azure sign in is to be used
const firewallHelpUri = 'https://aka.ms/sqlopsfirewallhelp';

const LocalizedStrings = {
	FROM: localize('from', "From"),
	TO: localize('to', "To")
};

export class FirewallRuleDialog extends Modal {
	public viewModel: FirewallRuleViewModel;
	private _createButton: Button;
	private _closeButton: Button;
	private _fromRangeinputBox: InputBox;
	private _toRangeinputBox: InputBox;

	private _helpLink: HTMLElement;
	private _IPAddressInput: HTMLElement;
	private _subnetIPRangeInput: HTMLElement;
	private _IPAddressElement: HTMLElement;

	// EVENTING ////////////////////////////////////////////////////////////
	private _onAddAccountErrorEmitter: Emitter<string>;
	public get onAddAccountErrorEvent(): Event<string> { return this._onAddAccountErrorEmitter.event; }

	private _onCancel: Emitter<void>;
	public get onCancel(): Event<void> { return this._onCancel.event; }

	private _onCreateFirewallRule: Emitter<void>;
	public get onCreateFirewallRule(): Event<void> { return this._onCreateFirewallRule.event; }

	constructor(
		@IAccountPickerService private _accountPickerService: IAccountPickerService,
		@ILayoutService layoutService: ILayoutService,
		@IThemeService themeService: IThemeService,
		@IInstantiationService private _instantiationService: IInstantiationService,
		@IContextViewService private _contextViewService: IContextViewService,
		@IAdsTelemetryService telemetryService: IAdsTelemetryService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IClipboardService clipboardService: IClipboardService,
		@ILogService logService: ILogService,
		@ITextResourcePropertiesService textResourcePropertiesService: ITextResourcePropertiesService,
		@IOpenerService private readonly openerService: IOpenerService
	) {
		super(
			localize('createNewFirewallRule', "Create new firewall rule"),
			TelemetryKeys.FireWallRule,
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{
				isFlyout: true,
				hasBackButton: true,
				hasSpinner: true
			}
		);

		// Setup event emitters
		this._onAddAccountErrorEmitter = new Emitter<string>();
		this._onCancel = new Emitter<void>();
		this._onCreateFirewallRule = new Emitter<void>();

		this.viewModel = this._instantiationService.createInstance(FirewallRuleViewModel);
	}

	public render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		this.backButton.onDidClick(() => this.cancel());
		this._register(attachButtonStyler(this.backButton, this._themeService, { buttonBackground: SIDE_BAR_BACKGROUND, buttonHoverBackground: SIDE_BAR_BACKGROUND }));
		this._createButton = this.addFooterButton(localize('firewall.ok', "OK"), () => this.createFirewallRule());
		this._closeButton = this.addFooterButton(localize('firewall.cancel', "Cancel"), () => this.cancel());
		this.registerListeners();
	}

	protected renderBody(container: HTMLElement) {
		const body = DOM.append(container, DOM.$('.firewall-rule-dialog'));
		const descriptionSection = DOM.append(body, DOM.$('.firewall-rule-description-section.new-section'));

		DOM.append(descriptionSection, DOM.$('div.firewall-rule-icon'));

		const textDescriptionContainer = DOM.append(descriptionSection, DOM.$('div.firewall-rule-description'));
		const dialogDescription = localize('firewallRuleDialogDescription',
			"Your client IP address does not have access to the server. Sign in to an Azure account and create a new firewall rule to enable access.");
		this.createLabelElement(textDescriptionContainer, dialogDescription, false);

		this._helpLink = DOM.append(textDescriptionContainer, DOM.$('a.help-link'));
		this._helpLink.setAttribute('href', firewallHelpUri);
		this._helpLink.innerHTML += localize('firewallRuleHelpDescription', "Learn more about firewall settings");
		this._helpLink.onclick = () => {
			this.openerService.open(URI.parse(firewallHelpUri));
		};

		// Create account picker with event handling
		this._accountPickerService.addAccountCompleteEvent(() => this.spinner = false);
		this._accountPickerService.addAccountErrorEvent((msg) => {
			this.spinner = false;
			this._onAddAccountErrorEmitter.fire(msg);
		});
		this._accountPickerService.addAccountStartEvent(() => this.spinner = true);
		this._accountPickerService.onAccountSelectionChangeEvent((account) => this.onAccountSelectionChange(account));
		this._accountPickerService.onTenantSelectionChangeEvent((tenantId) => this.onTenantSelectionChange(tenantId));

		const azureAccountSection = DOM.append(body, DOM.$('.azure-account-section.new-section'));
		this._accountPickerService.renderAccountPicker(azureAccountSection);

		const firewallRuleSection = DOM.append(body, DOM.$('.firewall-rule-section.new-section'));
		const firewallRuleLabel = localize('filewallRule', "Firewall rule");
		this.createLabelElement(firewallRuleSection, firewallRuleLabel, true);
		const radioContainer = DOM.append(firewallRuleSection, DOM.$('.radio-section'));
		const form = DOM.append(radioContainer, DOM.$('form.firewall-rule'));
		const IPAddressDiv = DOM.append(form, DOM.$('div.firewall-ip-address dialog-input'));
		const subnetIPRangeDiv = DOM.append(form, DOM.$('div.firewall-subnet-ip-range dialog-input'));

		const IPAddressContainer = DOM.append(IPAddressDiv, DOM.$('div.option-container'));
		this._IPAddressInput = DOM.append(IPAddressContainer, DOM.$('input.option-input'));
		this._IPAddressInput.setAttribute('type', 'radio');
		this._IPAddressInput.setAttribute('name', 'firewallRuleChoice');
		this._IPAddressInput.setAttribute('value', 'ipAddress');
		const IPAddressDescription = DOM.append(IPAddressContainer, DOM.$('div.option-description'));
		IPAddressDescription.innerText = localize('addIPAddressLabel', "Add my client IP ");
		this._IPAddressElement = DOM.append(IPAddressContainer, DOM.$('div.option-ip-address'));

		const subnetIpRangeContainer = DOM.append(subnetIPRangeDiv, DOM.$('div.option-container'));
		this._subnetIPRangeInput = DOM.append(subnetIpRangeContainer, DOM.$('input.option-input'));
		this._subnetIPRangeInput.setAttribute('type', 'radio');
		this._subnetIPRangeInput.setAttribute('name', 'firewallRuleChoice');
		this._subnetIPRangeInput.setAttribute('value', 'ipRange');
		const subnetIPRangeDescription = DOM.append(subnetIpRangeContainer, DOM.$('div.option-description'));
		subnetIPRangeDescription.innerText = localize('addIpRangeLabel', "Add my subnet IP range");
		const subnetIPRangeSection = DOM.append(subnetIPRangeDiv, DOM.$('.subnet-ip-range-input'));

		const inputContainer = DOM.append(subnetIPRangeSection, DOM.$('.dialog-input-section'));

		DOM.append(inputContainer, DOM.$('.dialog-label')).innerText = LocalizedStrings.FROM;

		this._fromRangeinputBox = new InputBox(DOM.append(inputContainer, DOM.$('.dialog-input')), this._contextViewService, {
			ariaLabel: LocalizedStrings.FROM
		});

		DOM.append(inputContainer, DOM.$('.dialog-label')).innerText = LocalizedStrings.TO;

		this._toRangeinputBox = new InputBox(DOM.append(inputContainer, DOM.$('.dialog-input')), this._contextViewService, {
			ariaLabel: LocalizedStrings.TO
		});

		this._register(this._themeService.onDidColorThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this._themeService.getColorTheme());

		this._register(DOM.addDisposableListener(this._IPAddressElement, DOM.EventType.CLICK, () => {
			this.onFirewallRuleOptionSelected(true);
		}));

		this._register(DOM.addDisposableListener(this._subnetIPRangeInput, DOM.EventType.CLICK, () => {
			this.onFirewallRuleOptionSelected(false);
		}));
	}

	private onFirewallRuleOptionSelected(isIPAddress: boolean) {
		this.viewModel.isIPAddressSelected = isIPAddress;
		if (this._fromRangeinputBox) {
			isIPAddress ? this._fromRangeinputBox.disable() : this._fromRangeinputBox.enable();
		}
		if (this._toRangeinputBox) {
			isIPAddress ? this._toRangeinputBox.disable() : this._toRangeinputBox.enable();
		}
	}

	protected layout(height?: number): void {
		// Nothing currently laid out statically in this class
	}

	private createLabelElement(container: HTMLElement, content: string, isHeader?: boolean) {
		let className = 'dialog-label';
		if (isHeader) {
			className += ' header';
		}
		const element = DOM.append(container, DOM.$(`.${className}`));
		element.innerText = content;
		return element;
	}

	// Update theming that is specific to firewall rule flyout body
	private updateTheme(theme: IColorTheme): void {
		const linkColor = theme.getColor(buttonBackground);
		const link = linkColor ? linkColor.toString() : null;
		if (this._helpLink) {
			this._helpLink.style.color = link;
		}
	}

	private registerListeners(): void {
		// Theme styler
		this._register(attachButtonStyler(this._createButton, this._themeService));
		this._register(attachButtonStyler(this._closeButton, this._themeService));
		this._register(attachInputBoxStyler(this._fromRangeinputBox, this._themeService));
		this._register(attachInputBoxStyler(this._toRangeinputBox, this._themeService));

		// handler for from subnet ip range change events
		this._register(this._fromRangeinputBox.onDidChange(IPAddress => {
			this.fromRangeInputChanged(IPAddress);
		}));

		// handler for to subnet ip range change events
		this._register(this._toRangeinputBox.onDidChange(IPAddress => {
			this.toRangeInputChanged(IPAddress);
		}));
	}

	private fromRangeInputChanged(IPAddress: string) {
		this.viewModel.fromSubnetIPRange = IPAddress;
	}

	private toRangeInputChanged(IPAddress: string) {
		this.viewModel.toSubnetIPRange = IPAddress;
	}

	/* Overwrite esapce key behavior */
	protected onClose() {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected onAccept() {
		this.createFirewallRule();
	}

	public cancel() {
		this._onCancel.fire();
		this.close();
	}

	public close() {
		this.hide();
	}

	public createFirewallRule() {
		if (this._createButton.enabled) {
			this._createButton.enabled = false;
			this.spinner = true;
			this._onCreateFirewallRule.fire();
		}
	}

	public onAccountSelectionChange(account: azdata.Account | undefined): void {
		this.viewModel.selectedAccount = account;
		if (account && !account.isStale) {
			this._createButton.enabled = true;
		} else {
			this._createButton.enabled = false;
		}
	}

	public onTenantSelectionChange(tenantId: string): void {
		this.viewModel.selectedTenantId = tenantId;
	}

	public onServiceComplete() {
		this._createButton.enabled = true;
		this.spinner = false;
	}

	public open() {
		this._IPAddressInput.click();
		this.onAccountSelectionChange(this._accountPickerService.selectedAccount);
		this._fromRangeinputBox.setPlaceHolder(this.viewModel.defaultFromSubnetIPRange);
		this._toRangeinputBox.setPlaceHolder(this.viewModel.defaultToSubnetIPRange);
		this._IPAddressElement.innerText = '(' + this.viewModel.defaultIPAddress + ')';

		this.show();
	}
}
