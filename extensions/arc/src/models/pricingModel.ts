/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class PricingModel {
	private serviceTier: string;
	private isDevUseOnly: boolean;
	private vcoresLimit: number;
	private licenseType: string;

	// private readonly _azApi: azExt.IExtension;

	constructor(serviceTier: string, isDevUseOnly: boolean, vcoresLimit: number, licenseType: string) {
		this.serviceTier = serviceTier;
		this.isDevUseOnly = isDevUseOnly;
		this.vcoresLimit = vcoresLimit;
		this.licenseType = licenseType;
	}

	public getServiceTier(): string {
		return this.serviceTier;
	}

	public setServiceTier(serviceTier: string): void {
		this.serviceTier = serviceTier;
	}

	public getIsDevUseOnly(): boolean {
		return this.isDevUseOnly;
	}

	public setIsDevUseOnly(isDevUseOnly: boolean): void {
		this.isDevUseOnly = isDevUseOnly;
	}

	public getVcoresLimit(): number {
		return this.vcoresLimit;
	}

	public setVcoresLimit(vcoresLimit: number): void {
		this.vcoresLimit = vcoresLimit;
	}

	public getLicenseType(): string {
		return this.licenseType;
	}

	public setLicenseType(licenseType: string): void {
		this.licenseType = licenseType;
	}

}
