import * as data from 'data';
import * as types from './types';

export interface Ip2c {
	asProviderMetadata(params: types.MetadataQueryResult): data.ProviderMetadata;

	asServerCapabilities(result: types.CapabiltiesDiscoveryResult): data.DataProtocolServerCapabilities;
}

function asProviderMetadata(params: types.MetadataQueryResult): data.ProviderMetadata {
	let objectMetadata: data.ObjectMetadata[] = [];

	if (!params.metadata || !params.metadata.length) {
		return {
			objectMetadata
		};
	}

	for (let i = 0; i < params.metadata.length; ++i) {
		let metadata: data.ObjectMetadata = params.metadata[i];

		let metadataTypeName: string;
		if (metadata.metadataTypeName) {
			// Read from the provider since it's defined
			metadataTypeName = metadata.metadataTypeName;
		} else if (metadata.metadataType === types.MetadataType.View) {
			metadataTypeName = 'View';
		} else if (metadata.metadataType === types.MetadataType.SProc) {
			metadataTypeName = 'StoredProcedure';
		} else if (metadata.metadataType === types.MetadataType.Function) {
			metadataTypeName = 'Function';
		} else {
			metadataTypeName = 'Table';
		}

		objectMetadata.push({
			metadataTypeName,
			metadataType: metadata.metadataType,
			name: metadata.name,
			schema: metadata.schema,
			urn: metadata.urn
		});
	}

	return <data.ProviderMetadata>{
		objectMetadata
	};
}

function asServiceOptionType(val: string): data.ServiceOptionType {
	if (val === 'string') {
		return data.ServiceOptionType.string;
	} else if (val === 'multistring') {
		return data.ServiceOptionType.multistring;
	} else if (val === 'password') {
		return data.ServiceOptionType.password;
	} else if (val === 'number') {
		return data.ServiceOptionType.number;
	} else if (val === 'boolean') {
		return data.ServiceOptionType.boolean;
	} else if (val === 'category') {
		return data.ServiceOptionType.category;
	} else if (val === 'object') {
		return data.ServiceOptionType.object;
	}

	// assume string for unknown value types
	return data.ServiceOptionType.string;
}



function buildServiceOption(srcOption: types.ServiceOption): data.ServiceOption {
	return {
		name: srcOption.name,
		displayName: srcOption.displayName ? srcOption.displayName : srcOption.name,
		description: srcOption.description,
		groupName: srcOption.groupName,
		defaultValue: srcOption.defaultValue,
		categoryValues: srcOption.categoryValues,
		isRequired: srcOption.isRequired,
		isArray: srcOption.isArray,
		objectType: srcOption.objectType,
		valueType: asServiceOptionType(srcOption.valueType),
	};
}


function asServerCapabilities(result: types.CapabiltiesDiscoveryResult): data.DataProtocolServerCapabilities {
	let capabilities: data.DataProtocolServerCapabilities = {
		protocolVersion: result.capabilities.protocolVersion,
		providerName: result.capabilities.providerName,
		providerDisplayName: result.capabilities.providerDisplayName,
		connectionProvider: undefined,
		adminServicesProvider: undefined,
		features: []
	};

	if (result.capabilities.adminServicesProvider) {
		capabilities.adminServicesProvider = <data.AdminServicesOptions>{
			databaseInfoOptions: new Array<data.ServiceOption>(),
			databaseFileInfoOptions: new Array<data.ServiceOption>(),
			fileGroupInfoOptions: new Array<data.ServiceOption>()
		};

		if (result.capabilities.adminServicesProvider.databaseInfoOptions
			&& result.capabilities.adminServicesProvider.databaseInfoOptions.length > 0) {
			for (let i = 0; i < result.capabilities.adminServicesProvider.databaseInfoOptions.length; ++i) {
				let srcOption: any = result.capabilities.adminServicesProvider.databaseInfoOptions[i];
				let descOption: data.ServiceOption = buildServiceOption(srcOption);
				capabilities.adminServicesProvider.databaseInfoOptions.push(descOption);
			}
		}

		if (result.capabilities.adminServicesProvider.databaseFileInfoOptions
			&& result.capabilities.adminServicesProvider.databaseFileInfoOptions.length > 0) {
			for (let i = 0; i < result.capabilities.adminServicesProvider.databaseFileInfoOptions.length; ++i) {
				//let srcOption: types.ServiceOption = result.capabilities.adminServicesProvider.databaseFileInfoOptions[i];
				let srcOption: any = result.capabilities.adminServicesProvider.databaseFileInfoOptions[i];
				let descOption: data.ServiceOption = buildServiceOption(srcOption);
				capabilities.adminServicesProvider.databaseFileInfoOptions.push(descOption);
			}
		}

		if (result.capabilities.adminServicesProvider.fileGroupInfoOptions
			&& result.capabilities.adminServicesProvider.fileGroupInfoOptions.length > 0) {
			for (let i = 0; i < result.capabilities.adminServicesProvider.fileGroupInfoOptions.length; ++i) {
				//let srcOption: types.ServiceOption = result.capabilities.adminServicesProvider.fileGroupInfoOptions[i];
				let srcOption: any = result.capabilities.adminServicesProvider.fileGroupInfoOptions[i];
				let descOption: data.ServiceOption = buildServiceOption(srcOption);
				capabilities.adminServicesProvider.fileGroupInfoOptions.push(descOption);
			}
		}
	}

	if (result.capabilities.connectionProvider
		&& result.capabilities.connectionProvider.options
		&& result.capabilities.connectionProvider.options.length > 0) {
		capabilities.connectionProvider = <data.ConnectionProviderOptions>{
			options: new Array<data.ConnectionOption>()
		};
		for (let i = 0; i < result.capabilities.connectionProvider.options.length; ++i) {
			let srcOption: any = result.capabilities.connectionProvider.options[i];
			let descOption: data.ConnectionOption = {
				name: srcOption.name,
				displayName: srcOption.displayName ? srcOption.displayName : srcOption.name,
				description: srcOption.description,
				groupName: srcOption.groupName,
				defaultValue: srcOption.defaultValue,
				categoryValues: srcOption.categoryValues,
				isIdentity: srcOption.isIdentity,
				isRequired: srcOption.isRequired,
				valueType: asServiceOptionType(srcOption.valueType),
				specialValueType: undefined
			};

			if (srcOption.specialValueType === 'serverName') {
				descOption.specialValueType = data.ConnectionOptionSpecialType.serverName;
			} else if (srcOption.specialValueType === 'databaseName') {
				descOption.specialValueType = data.ConnectionOptionSpecialType.databaseName;
			} else if (srcOption.specialValueType === 'authType') {
				descOption.specialValueType = data.ConnectionOptionSpecialType.authType;
			} else if (srcOption.specialValueType === 'userName') {
				descOption.specialValueType = data.ConnectionOptionSpecialType.userName;
			} else if (srcOption.specialValueType === 'password') {
				descOption.specialValueType = data.ConnectionOptionSpecialType.password;
			} else if (srcOption.specialValueType === 'appName') {
				descOption.specialValueType = data.ConnectionOptionSpecialType.appName;
			}

			capabilities.connectionProvider.options.push(descOption);
		}
	}

	if (result.capabilities.features
		&& result.capabilities.features.length > 0) {
		result.capabilities.features.forEach(feature => {
			let descFeature: data.FeatureMetadataProvider = {
				enabled: feature.enabled,
				featureName: feature.featureName,
				optionsMetadata: []
			};
			capabilities.features.push(descFeature);
			if (feature.optionsMetadata) {
				feature.optionsMetadata.forEach(srcOption => {
					descFeature.optionsMetadata.push(buildServiceOption(<any>srcOption));
				});
			}
		});
	}

	return capabilities;
}

export const p2c: Ip2c = {
	asProviderMetadata,
	asServerCapabilities
};
