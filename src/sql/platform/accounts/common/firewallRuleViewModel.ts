/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';

/**
 * View model for firewall rule dialog
 */
export class FirewallRuleViewModel {
	public isIPAddressSelected: boolean;
	public selectedAccount: azdata.Account | undefined;
	public selectedTenantId: string | undefined;

	private _defaultFirewallRuleName: string;
	private _firewallRuleName: string;
	private _defaultIPAddress?: string;
	private _defaultFromSubnetIPRange?: string;
	private _defaultToSubnetIPRange?: string;
	private _fromSubnetIPRange?: string;
	private _toSubnetIPRange?: string;

	constructor() {
		this.isIPAddressSelected = true;
	}

	public set defaultFirewallRuleName(ruleName: string) {
		this._defaultFirewallRuleName = ruleName;
	}

	public get defaultFirewallRuleName(): string | undefined {
		return this._defaultFirewallRuleName;
	}

	public set firewallRuleName(ruleName: string) {
		this._firewallRuleName = ruleName;
	}

	public get firewallRuleName(): string | undefined {
		return this._firewallRuleName;
	}

	public get defaultIPAddress(): string | undefined {
		return this._defaultIPAddress;
	}

	public get defaultFromSubnetIPRange(): string | undefined {
		return this._defaultFromSubnetIPRange;
	}

	public get defaultToSubnetIPRange(): string | undefined {
		return this._defaultToSubnetIPRange;
	}

	public set fromSubnetIPRange(IPAddress: string | undefined) {
		this._fromSubnetIPRange = IPAddress;
	}

	public get fromSubnetIPRange(): string | undefined {
		if (this._fromSubnetIPRange) {
			return this._fromSubnetIPRange;
		} else {
			return this._defaultFromSubnetIPRange;
		}
	}

	public set toSubnetIPRange(IPAddress: string | undefined) {
		this._toSubnetIPRange = IPAddress;
	}

	public get toSubnetIPRange(): string | undefined {
		if (this._toSubnetIPRange) {
			return this._toSubnetIPRange;
		} else {
			return this._defaultToSubnetIPRange;
		}
	}

	public updateDefaultValues(ipAddress: string): void {
		function padTo2Digits(num: number) {
			return num.toString().padStart(2, '0');
		}

		// format as "YYYY-MM-DD_hh-mm-ss" (default Azure rulename format)
		function formatDate(date: Date) {
			return (
				[
					date.getFullYear(),
					padTo2Digits(date.getMonth() + 1),
					padTo2Digits(date.getDate()),
				].join('-') +
				'_' +
				[
					padTo2Digits(date.getHours()),
					padTo2Digits(date.getMinutes()),
					padTo2Digits(date.getSeconds()),
				].join('-')
			);
		}

		// Use default rule name format as Azure portal.
		this._defaultFirewallRuleName = `ClientIPAddress_${formatDate(new Date())}`;
		this._defaultIPAddress = ipAddress;
		this._defaultFromSubnetIPRange = ipAddress.replace(/\.[0-9]+$/g, '.0');
		this._defaultToSubnetIPRange = ipAddress.replace(/\.[0-9]+$/g, '.255');
	}
}
