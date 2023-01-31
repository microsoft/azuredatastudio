/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import { getAzureResourceGivenId, getComputeVM, SqlVMServer, Subscription } from '../../azure';

export interface NetworkResource {
	id: string,
	name: string,
	type: string,
	location: string,
	properties: any
}

export interface NetworkInterface extends NetworkResource {
	properties: {
		ipConfigurations: NetworkInterfaceIpConfiguration[],
		primary: boolean,
		provisioningState: string,
		resourceGuid: string,
		virtualMachine: {
			id: string,
		},
	},
}

export interface NetworkInterfaceIpConfiguration extends NetworkResource {
	properties: {
		primary: boolean,
		privateIPAddress: string,
		privateIPAddressVersion: string,
		provisioningState: string,
		publicIPAddress: NetworkResource
	}
}

export interface PublicIpAddress extends NetworkResource {
	properties: {
		ipAddress: string
	}
}

export class NetworkInterfaceModel {
	public static IPv4VersionType = "IPv4".toLocaleLowerCase();
	private static NETWORK_API_VERSION = '2022-09-01';

	public static getPrimaryNetworkInterface(networkInterfaces: NetworkInterface[]): NetworkInterface | undefined {
		if (networkInterfaces && networkInterfaces.length > 0) {
			const primaryNetworkInterface = networkInterfaces.find(nic => nic.properties.primary === true);
			if (primaryNetworkInterface) {
				return primaryNetworkInterface;
			}
		}

		return undefined;
	}

	public static getPrimaryIpConfiguration(networkInterface: NetworkInterface): NetworkInterfaceIpConfiguration | undefined {
		const hasIpConfigurations = networkInterface?.properties?.ipConfigurations && networkInterface.properties.ipConfigurations?.length > 0;
		if (!hasIpConfigurations) {
			return undefined;
		}

		// If the primary property exists, return the primary, otherwise, return the first ip configuration
		let primaryIpConfig = networkInterface.properties.ipConfigurations.find((ipConfig: NetworkInterfaceIpConfiguration) => ipConfig.properties.primary);
		if (primaryIpConfig) {
			return primaryIpConfig;
		}

		// Otherwise, find the first configuration with a public ip address.
		primaryIpConfig = networkInterface.properties.ipConfigurations.find(ipConfiguration => ipConfiguration.properties.publicIPAddress !== undefined);
		if (primaryIpConfig) {
			return primaryIpConfig;
		}

		// Otherwise, return the first ipv4 configuration
		primaryIpConfig = networkInterface.properties.ipConfigurations.find(ipConfiguration => ipConfiguration.properties.privateIPAddressVersion.toLocaleLowerCase() === NetworkInterfaceModel.IPv4VersionType);
		return primaryIpConfig;
	}

	public static getIpAddress(networkInterfaces: NetworkInterface[]): string {
		const primaryNetworkInterface = this.getPrimaryNetworkInterface(networkInterfaces);

		if (!primaryNetworkInterface) {
			return "";
		}

		const ipConfig = this.getPrimaryIpConfiguration(primaryNetworkInterface);
		if (ipConfig && ipConfig.properties.publicIPAddress) {
			return ipConfig.properties.publicIPAddress.properties.ipAddress;
		}

		if (ipConfig && ipConfig.properties.privateIPAddress) {
			return ipConfig.properties.privateIPAddress;
		}

		return "";
	}

	public static getPublicIpAddressId(networkInterfaces: NetworkInterface[]): string | undefined {
		const primaryNetworkInterface = this.getPrimaryNetworkInterface(networkInterfaces);

		if (!primaryNetworkInterface) {
			return undefined;
		}

		const ipConfig = this.getPrimaryIpConfiguration(primaryNetworkInterface);
		if (ipConfig && ipConfig.properties.publicIPAddress) {
			return ipConfig.properties.publicIPAddress.id;
		}

		return undefined;
	}

	public static async getNetworkInterfaces(account: azdata.Account, subscription: Subscription, nicId: string): Promise<NetworkInterface> {
		return getAzureResourceGivenId(account, subscription, nicId, this.NETWORK_API_VERSION);
	}

	public static async getPublicIpAddress(account: azdata.Account, subscription: Subscription, publicIpAddressId: string): Promise<PublicIpAddress> {
		return getAzureResourceGivenId(account, subscription, publicIpAddressId, this.NETWORK_API_VERSION);
	}

	public static async getVmNetworkInterfaces(account: azdata.Account, subscription: Subscription, sqlVm: SqlVMServer): Promise<Map<string, NetworkInterface>> {
		const computeVMs = await getComputeVM(sqlVm, account, subscription);
		const networkInterfaces = new Map<string, any>();

		if (!computeVMs?.properties?.networkProfile?.networkInterfaces) {
			return networkInterfaces;
		}

		for (const nic of computeVMs.properties.networkProfile.networkInterfaces) {
			const nicId = nic.id;
			const nicData = await this.getNetworkInterfaces(account, subscription, nicId);
			const publicIpAddressId = NetworkInterfaceModel.getPublicIpAddressId([nicData]);
			let primaryIpConfig = NetworkInterfaceModel.getPrimaryIpConfiguration(nicData);

			if (primaryIpConfig && publicIpAddressId) {
				primaryIpConfig.properties.publicIPAddress = await this.getPublicIpAddress(account, subscription, publicIpAddressId);
			}

			networkInterfaces.set(nicId, nicData);
		}

		return networkInterfaces;
	}
}
