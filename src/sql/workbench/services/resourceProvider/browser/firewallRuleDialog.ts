/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/css!./media/firewallRuleDialog';

import * as DOM from 'vs/base/browser/dom';
import { Event, Emitter } from 'vs/base/common/event';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { localize } from 'vs/nls';
import { buttonBackground } from 'vs/platform/theme/common/colorRegistry';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { IContextKeyService } from 'vs/platform/contextkey/common/contextkey';
import { IClipboardService } from 'vs/platform/clipboard/common/clipboardService';
import { IThemeService, IColorTheme } from 'vs/platform/theme/common/themeService';
import { URI } from 'vs/base/common/uri';

import * as azdata from 'azdata';
import { Button } from 'sql/base/browser/ui/button/button';
import { Modal } from 'sql/workbench/browser/modal/modal';
import { FirewallRuleViewModel } from 'sql/platform/accounts/common/firewallRuleViewModel';
import { InputBox } from 'sql/base/browser/ui/inputBox/inputBox';
import { IAccountPickerService } from 'sql/workbench/services/accountManagement/browser/accountPicker';
import * as TelemetryKeys from 'sql/platform/telemetry/common/telemetryKeys';
import { ILogService } from 'vs/platform/log/common/log';
import { IOpenerService } from 'vs/platform/opener/common/opener';
import { IAdsTelemetryService } from 'sql/platform/telemetry/common/telemetry';
import { attachModalDialogStyler } from 'sql/workbench/common/styler';
import { ILayoutService } from 'vs/platform/layout/browser/layoutService';
import { ITextResourcePropertiesService } from 'vs/editor/common/services/textResourceConfiguration';
import { defaultInputBoxStyles } from 'vs/platform/theme/browser/defaultStyles';

// TODO: Make the help link 1) extensible (01/08/2018, https://github.com/Microsoft/azuredatastudio/issues/450)
// in case that other non-Azure sign in is to be used
const firewallHelpUri = 'https://aka.ms/sqlopsfirewallhelp';

const LocalizedStrings = {
	FROM: localize('from', "From"),
	TO: localize('to', "To"),
	OK: localize('firewall.ok', "OK"),
	Cancel: localize('firewall.cancel', "Cancel"),
	RuleName: localize('firewall.ruleName', "Rule name"),
	CreateNewFirewallRule: localize('createNewFirewallRule', "Create new firewall rule"),
	FirewallRuleLabel: localize('filewallRule', "Firewall rule"),
	FirewallRuleDescription: localize('firewallRuleDescription',
		"A firewall rule is required to access the SQL Server instance. Click the link below to create a new firewall rule."),
	FirewallRuleHelpLink: localize('firewallRuleHelpLink', "Learn more about firewall rules"),
	AddClientIPLabel: localize('addIPAddressLabel', "Add my client IP "),
	AddIPRangeLabel: localize('addIpRangeLabel', "Add my subnet IP range")
};

export class FirewallRuleDialog extends Modal {
	public viewModel: FirewallRuleViewModel;
	private _createButton?: Button;
	private _closeButton?: Button;
	private _ruleNameInpuBox?: InputBox;
	private _fromRangeinputBox?: InputBox;
	private _toRangeinputBox?: InputBox;

	private _helpLink?: HTMLElement;
	private _IPAddressInput?: HTMLElement;
	private _subnetIPRangeInput?: HTMLElement;
	private _IPAddressElement?: HTMLElement;

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
			LocalizedStrings.CreateNewFirewallRule,
			TelemetryKeys.ModalDialogName.FireWallRule,
			telemetryService,
			layoutService,
			clipboardService,
			themeService,
			logService,
			textResourcePropertiesService,
			contextKeyService,
			{
				dialogStyle: 'flyout',
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

	public override render() {
		super.render();
		attachModalDialogStyler(this, this._themeService);
		this.backButton!.onDidClick(() => this.cancel());
		this._register(this.backButton!);
		this._createButton = this.addFooterButton(LocalizedStrings.OK, () => this.createFirewallRule());
		this._closeButton = this.addFooterButton(LocalizedStrings.Cancel, () => this.cancel(), 'right', true);
		this.registerListeners();
	}

	protected renderBody(container: HTMLElement) {
		const dialogBody = DOM.append(container, DOM.$('.firewall-rule-dialog'));

		this.createFirewallRuleHeader(dialogBody);
		this.createAccountPicker(dialogBody);

		// Firewall rule section
		const firewallRuleSection = DOM.append(dialogBody, DOM.$('.firewall-rule-section.new-section'));
		this.createLabelElement(firewallRuleSection, LocalizedStrings.FirewallRuleLabel, true);
		const radioContainer = DOM.append(firewallRuleSection, DOM.$('.radio-section'));
		const form = DOM.append(radioContainer, DOM.$('form.firewall-rule'));

		// Firewall rule name inputBox
		const descriptionDiv = DOM.append(form, DOM.$('div.firewall-rulename dialog-input'));
		const descInputContainer = DOM.append(descriptionDiv, DOM.$('.dialog-input-section'));
		DOM.append(descInputContainer, DOM.$('.dialog-label')).innerText = LocalizedStrings.RuleName;
		this._ruleNameInpuBox = new InputBox(DOM.append(descInputContainer, DOM.$('.dialog-input')), this._contextViewService, {
			ariaLabel: LocalizedStrings.RuleName,
			inputBoxStyles: defaultInputBoxStyles
		});

		// Single IP Address radio button
		const IPAddressDiv = DOM.append(form, DOM.$('div.firewall-ip-address dialog-input'));
		const subnetIPRangeDiv = DOM.append(form, DOM.$('div.firewall-subnet-ip-range dialog-input'));
		const IPAddressContainer = DOM.append(IPAddressDiv, DOM.$('div.option-container'));
		this._IPAddressInput = DOM.append(IPAddressContainer, DOM.$('input.option-input'));
		this._IPAddressInput.setAttribute('type', 'radio');
		this._IPAddressInput.setAttribute('name', 'firewallRuleChoice');
		this._IPAddressInput.setAttribute('value', 'ipAddress');
		const IPAddressDescription = DOM.append(IPAddressContainer, DOM.$('div.option-description'));
		IPAddressDescription.innerText = LocalizedStrings.AddClientIPLabel;
		this._IPAddressElement = DOM.append(IPAddressContainer, DOM.$('div.option-ip-address'));

		// IP Range radio button
		const subnetIpRangeContainer = DOM.append(subnetIPRangeDiv, DOM.$('div.option-container'));
		this._subnetIPRangeInput = DOM.append(subnetIpRangeContainer, DOM.$('input.option-input'));
		this._subnetIPRangeInput.setAttribute('type', 'radio');
		this._subnetIPRangeInput.setAttribute('name', 'firewallRuleChoice');
		this._subnetIPRangeInput.setAttribute('value', 'ipRange');
		const subnetIPRangeDescription = DOM.append(subnetIpRangeContainer, DOM.$('div.option-description'));
		subnetIPRangeDescription.innerText = LocalizedStrings.AddIPRangeLabel;

		// IP Range input boxes
		const subnetIPRangeSection = DOM.append(subnetIPRangeDiv, DOM.$('.subnet-ip-range-input'));
		const inputContainer = DOM.append(subnetIPRangeSection, DOM.$('.dialog-input-section'));

		DOM.append(inputContainer, DOM.$('.dialog-label')).innerText = LocalizedStrings.FROM;
		this._fromRangeinputBox = new InputBox(DOM.append(inputContainer, DOM.$('.dialog-input')), this._contextViewService, {
			ariaLabel: LocalizedStrings.FROM,
			inputBoxStyles: defaultInputBoxStyles
		});

		DOM.append(inputContainer, DOM.$('.dialog-label')).innerText = LocalizedStrings.TO;
		this._toRangeinputBox = new InputBox(DOM.append(inputContainer, DOM.$('.dialog-input')), this._contextViewService, {
			ariaLabel: LocalizedStrings.TO,
			inputBoxStyles: defaultInputBoxStyles
		});

		// Register events
		this._register(this._themeService.onDidColorThemeChange(e => this.updateTheme(e)));
		this.updateTheme(this._themeService.getColorTheme());

		this._register(DOM.addDisposableListener(this._IPAddressInput, DOM.EventType.CLICK, () => {
			this.onFirewallRuleOptionSelected(true);
		}));

		this._register(DOM.addDisposableListener(this._subnetIPRangeInput, DOM.EventType.CLICK, () => {
			this.onFirewallRuleOptionSelected(false);
		}));
	}

	// Create firewall rule header
	private createFirewallRuleHeader(dialogBody: HTMLElement) {
		const descriptionSection = DOM.append(dialogBody, DOM.$('.firewall-rule-description-section.new-section'));
		DOM.append(descriptionSection, DOM.$('div.firewall-rule-icon'));
		const textDescriptionContainer = DOM.append(descriptionSection, DOM.$('div.firewall-rule-description'));

		this.createLabelElement(textDescriptionContainer, LocalizedStrings.FirewallRuleDescription, false);
		this._helpLink = DOM.append(textDescriptionContainer, DOM.$('a.help-link'));

		this._helpLink.setAttribute('href', firewallHelpUri);
		this._helpLink.innerHTML += LocalizedStrings.FirewallRuleHelpLink;
		this._helpLink.onclick = () => {
			this.openerService.open(URI.parse(firewallHelpUri));
		};
	}

	// Create account picker with event handling
	private createAccountPicker(dialogBody: HTMLElement) {
		this._accountPickerService.addAccountCompleteEvent(() => this.spinner = false);
		this._accountPickerService.addAccountErrorEvent((msg) => {
			this.spinner = false;
			this._onAddAccountErrorEmitter.fire(msg);
		});
		this._accountPickerService.addAccountStartEvent(() => this.spinner = true);
		this._accountPickerService.onAccountSelectionChangeEvent((account) => this.onAccountSelectionChange(account));
		this._accountPickerService.onTenantSelectionChangeEvent((tenantId) => !!tenantId && this.onTenantSelectionChange(tenantId));

		const azureAccountSection = DOM.append(dialogBody, DOM.$('.azure-account-section.new-section'));
		this._accountPickerService.renderAccountPicker(azureAccountSection);
	}

	private onFirewallRuleOptionSelected(isIPAddress: boolean) {
		this.viewModel.isIPAddressSelected = isIPAddress;
		if (isIPAddress) {
			this._fromRangeinputBox!.disable();
			this._fromRangeinputBox!.value = '';
			this._toRangeinputBox!.disable();
			this._toRangeinputBox!.value = '';
		} else {
			this._fromRangeinputBox!.enable();
			this._fromRangeinputBox!.value = this.viewModel!.defaultFromSubnetIPRange ?? '';
			this._toRangeinputBox!.enable();
			this._toRangeinputBox!.value = this.viewModel!.defaultToSubnetIPRange ?? '';
		}
	}

	protected layout(height?: number): void {
		// Nothing currently laid out statically in this class
	}

	private createLabelElement(container: HTMLElement, content: string, isHeader?: boolean) {
		let className = 'dialog-label';
		if (isHeader) {
			className += '.header';
		}
		const element = DOM.append(container, DOM.$(`.${className}`));
		element.innerText = content;
		return element;
	}

	// Update theming that is specific to firewall rule flyout body
	private updateTheme(theme: IColorTheme): void {
		const linkColor = theme.getColor(buttonBackground);
		const link = linkColor ? linkColor.toString() : '';
		if (this._helpLink) {
			this._helpLink.style.color = link;
		}
	}

	private registerListeners(): void {
		// Theme styler
		this._register(this._createButton!);
		this._register(this._closeButton!);

		// handler for firewall rule name change events
		this._register(this._ruleNameInpuBox!.onDidChange(ruleName => {
			this.firewallRuleNameChanged(ruleName);
		}));

		// handler for from subnet ip range change events
		this._register(this._fromRangeinputBox!.onDidChange(IPAddress => {
			this.fromRangeInputChanged(IPAddress);
		}));

		// handler for to subnet ip range change events
		this._register(this._toRangeinputBox!.onDidChange(IPAddress => {
			this.toRangeInputChanged(IPAddress);
		}));
	}

	private firewallRuleNameChanged(ruleName: string) {
		this.viewModel.firewallRuleName = ruleName;
	}

	private fromRangeInputChanged(IPAddress: string) {
		this.viewModel.fromSubnetIPRange = IPAddress;
	}

	private toRangeInputChanged(IPAddress: string) {
		this.viewModel.toSubnetIPRange = IPAddress;
	}

	/* Overwrite escape key behavior */
	protected override onClose() {
		this.cancel();
	}

	/* Overwrite enter key behavior */
	protected override onAccept() {
		this.createFirewallRule();
	}

	public cancel() {
		this._onCancel.fire();
		this.hide('cancel');
	}

	public close() {
		this.hide('close');
	}

	public createFirewallRule() {
		if (this._createButton!.enabled) {
			this._createButton!.enabled = false;
			this.spinner = true;
			this._onCreateFirewallRule.fire();
		}
	}

	public setInitialAccountTenant(account: string, tenant: string) {
		this._accountPickerService.setInitialAccountTenant(account, tenant);
	}

	public onAccountSelectionChange(account: azdata.Account | undefined): void {
		this.viewModel.selectedAccount = account;
		if (account && !account.isStale) {
			this._createButton!.enabled = true;
		} else {
			this._createButton!.enabled = false;
		}
	}

	public onTenantSelectionChange(tenantId: string): void {
		this.viewModel.selectedTenantId = tenantId;
	}

	public onServiceComplete() {
		this._createButton!.enabled = true;
		this.spinner = false;
	}

	public open() {
		this._IPAddressInput!.click();
		this.onAccountSelectionChange(this._accountPickerService.selectedAccount);
		this._ruleNameInpuBox!.value = this.viewModel!.defaultFirewallRuleName ?? '';
		this._fromRangeinputBox!.setPlaceHolder(this.viewModel!.defaultFromSubnetIPRange ?? '');
		this._toRangeinputBox!.setPlaceHolder(this.viewModel!.defaultToSubnetIPRange ?? '');
		this._IPAddressElement!.innerText = `(${this.viewModel.defaultIPAddress ?? ''})`;

		this.show();
	}
}
