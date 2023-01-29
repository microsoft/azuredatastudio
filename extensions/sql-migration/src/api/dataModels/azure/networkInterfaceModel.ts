/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

export class NetworkInterfaceModel {
	public static IPv4VersionType = "IPv4".toLocaleLowerCase();

	public static getPrimaryNetworkInterface(networkInterfaces: NetworkInterface[]): NetworkInterface | undefined {
		if (networkInterfaces && networkInterfaces.length > 0) {
			const primaryNetworkInterface = networkInterfaces.find(nic => nic.properties.primary === true);
			if (primaryNetworkInterface) {
				return primaryNetworkInterface;
			}
		}

		return undefined;
	}

	public static getPrimaryNetworkInterfaceIpConfiguration(networkInterface: NetworkInterface): NetworkInterfaceIpConfiguration | undefined {
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

	public static getPublicIpAddressFromId(publicIpAddressId: string): string {
		// TODO AKMA: will need to use this ip address id to get the public ip address
		return publicIpAddressId;
	}

	public static getIpAddress(networkInterfaces: NetworkInterface[]): string {
		const primaryNetworkInterface = NetworkInterfaceModel.getPrimaryNetworkInterface(networkInterfaces);

		if (!primaryNetworkInterface) {
			return "";
		}

		const ipConfig = NetworkInterfaceModel.getPrimaryNetworkInterfaceIpConfiguration(primaryNetworkInterface);
		if (ipConfig && ipConfig.properties.publicIPAddress) {
			return NetworkInterfaceModel.getPublicIpAddressFromId(ipConfig.properties.publicIPAddress.id);
		}

		if (ipConfig && ipConfig.properties.privateIPAddress) {
			return ipConfig.properties.privateIPAddress;
		}

		return "";
	}
}
