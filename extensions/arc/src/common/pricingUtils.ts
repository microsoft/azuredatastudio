import { InputValueType } from '../../../resource-deployment/src/ui/modelViewUtils';
import * as loc from '../localizedConstants';

export class SqlManagedInstanceGeneralPurpose {
	public static tierName: string = loc.generalPurpose;
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
	public static tierName: string = loc.businessCritical;

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
// if is Dev use, price = 0
// else if service tier is General Purpose, price = 80
// 		if service tier is Business Critical, price = 0
export function estimatedBasePriceForOneVCore(mapping: { [key: string]: InputValueType }): number {
	let price = 0;
	if (!mapping[loc.devUseFieldLabel]) {
		if (mapping[loc.serviceTierFieldLabel] === SqlManagedInstanceGeneralPurpose.tierName) {
			price = SqlManagedInstanceGeneralPurpose.basePricePerCore;
		} else if (mapping[loc.serviceTierFieldLabel] === SqlManagedInstanceBusinessCritical.tierName) {
			price = SqlManagedInstanceBusinessCritical.basePricePerCore;
		}
	}
	return price;
}

// Estimated SQL server license price for one vCore.
// if is Dev use, price = 0
// else if service tier is General Purpose, price = 153 - 80
// 		if service tier is Business Critical, price = 0 - 0
export function estimatedSqlServerLicensePriceForOneVCore(mapping: { [key: string]: InputValueType }): number {
	let price = 0;
	if (!mapping[loc.devUseFieldLabel]) {
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
	return estimatedBasePriceForOneVCore(mapping) - estimatedSqlServerLicensePriceForOneVCore(mapping);
}

// Gets number of vCores limit specified
export function numCores(mapping: { [key: string]: InputValueType }): number {
	// if a vCores limit is specified, return that limit. Else return 0. I think default is 4
	return estimatedBasePriceForOneVCore(mapping) - estimatedSqlServerLicensePriceForOneVCore(mapping);
}

// Full price for all selected vCores.
export function vCoreFullPriceForAllCores(mapping: { [key: string]: InputValueType }): number {
	return fullPriceForOneVCore(mapping) * numCores(mapping);
}

// SQL Server License price for all vCores. This is shown on the cost summary card if customer has SQL server license.
export function vCoreSqlServerLicensePriceForAllCores(mapping: { [key: string]: InputValueType }): number {
	return estimatedSqlServerLicensePriceForOneVCore(mapping) * numCores(mapping);
}

// If customer doesn't have SQL server license AHB discount is set to zero. This is shown on the cost summary card.
export function azureHybridBenefitDiscount(mapping: { [key: string]: InputValueType }): number {
	// If licensetype is LicenseIncluded, then the price is 0.
	// Else (if type is BasePrice) it costs:
	return vCoreSqlServerLicensePriceForAllCores(mapping);
}

// Total price that will be charged to a customer. Is shown on the cost summary card.
export function total(mapping: { [key: string]: InputValueType }): number {
	return vCoreFullPriceForAllCores(mapping) - azureHybridBenefitDiscount(mapping);
}
