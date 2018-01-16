import * as data from 'data';
import * as types from './types';

export interface Ip2c {
	asProviderMetadata(params: types.MetadataQueryResult): data.ProviderMetadata;
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

export const p2c: Ip2c = {
	asProviderMetadata
};
