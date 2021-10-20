import { InputValueType } from 'resource-deployment';
import * as loc from '../localizedConstants';

export class SqlManagedInstanceGeneralPurpose {
	public static tierName: string = loc.generalPurposeLabel;
	public static basePricePerCore: number = 80;
	public static licenseIncludedPricePerCore: number = 153;
	public static maxMemorySize: number = 128;
	public static maxVCores: number = 24;

	public static replicaOptions = [
		{
			text: loc.replicaOne,
			value: 1,
		}
	];

	public static defaultReplicaValue = 1;
}

export class SqlManagedInstanceBusinessCritical {
	public static tierName: string = loc.businessCriticalLabel;

	// Set to real values when BC is ready
	public static basePricePerCore: number = 0;
	public static licenseIncludedPricePerCore: number = 0;

	public static replicaOptions = [
		{
			text: loc.replicaTwo,
			value: 2,
		},
		{
			text: loc.replicaThree,
			value: 3,
		}
	];

	public static defaultReplicaValue = 3;
}

export class AzureHybridLicenseTypes {
	public static licenseIncluded: string = loc.licenseIncluded;
	public static basePrice: string = loc.basePrice;
}

export const SqlManagedInstancePricingLink: string = loc.sqlManagedInstancePricingLink;

// Estimated base price for one vCore.
export function estimatedBasePriceForOneVCore(mapping: { [key: string]: InputValueType }): number {
	let price = 0;
	if (mapping[loc.devUseFieldLabel] === 'true') {
		price = 0;
	} else if (mapping[loc.devUseFieldLabel] === 'false') {
		if (mapping[loc.serviceTierFieldLabel] === SqlManagedInstanceGeneralPurpose.tierName) {
			price = SqlManagedInstanceGeneralPurpose.basePricePerCore;
		} else if (mapping[loc.serviceTierFieldLabel] === SqlManagedInstanceBusinessCritical.tierName) {
			price = SqlManagedInstanceBusinessCritical.basePricePerCore;
		}
	}
	return price;
}

// Estimated SQL server license price for one vCore.
export function estimatedSqlServerLicensePriceForOneVCore(mapping: { [key: string]: InputValueType }): number {
	let price = 0;
	if (mapping[loc.devUseFieldLabel] === 'true') {
		price = 0;
	} else if (mapping[loc.devUseFieldLabel] === 'false') {
		if (mapping[loc.serviceTierFieldLabel] === SqlManagedInstanceGeneralPurpose.tierName) {
			price = SqlManagedInstanceGeneralPurpose.licenseIncludedPricePerCore - SqlManagedInstanceGeneralPurpose.basePricePerCore;
		} else if (mapping[loc.serviceTierFieldLabel] === SqlManagedInstanceBusinessCritical.tierName) {
			price = SqlManagedInstanceBusinessCritical.licenseIncludedPricePerCore - SqlManagedInstanceBusinessCritical.basePricePerCore;
		}
	}
	return price;
}

// Full price for one vCore. This is shown on the cost summary card.
export function fullPriceForOneVCore(mapping: { [key: string]: InputValueType }): number {
	return estimatedBasePriceForOneVCore(mapping) + estimatedSqlServerLicensePriceForOneVCore(mapping);
}

// Gets number of vCores limit specified
export function numCores(mapping: { [key: string]: InputValueType }): number {
	return mapping[loc.vcoresLimitFieldLabel] ? <number>mapping[loc.vcoresLimitFieldLabel] : 0;
}

// Full price for all selected vCores.
export function vCoreFullPriceForAllCores(mapping: { [key: string]: InputValueType }): number {
	return fullPriceForOneVCore(mapping) * numCores(mapping);
}

// SQL Server License price for all vCores. This is shown on the cost summary card if customer has SQL server license.
export function vCoreSqlServerLicensePriceForAllCores(mapping: { [key: string]: InputValueType }): number {
	return estimatedSqlServerLicensePriceForOneVCore(mapping) * numCores(mapping);
}

// If the customer doesn't already have SQL Server License, AHB discount is set to zero because the price will be included
// in the total cost. If they already have it (they checked the box), then a discount will be applied.
export function azureHybridBenefitDiscount(mapping: { [key: string]: InputValueType }): number {
	if (mapping[loc.licenseTypeFieldLabel] === 'true') {
		return vCoreSqlServerLicensePriceForAllCores(mapping);
	} else {
		return 0;
	}
}

// Total price that will be charged to a customer. Is shown on the cost summary card.
export function total(mapping: { [key: string]: InputValueType }): number {
	return vCoreFullPriceForAllCores(mapping) - azureHybridBenefitDiscount(mapping);
}
