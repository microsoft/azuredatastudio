import * as data from 'data';
import * as types from './types';
export interface Ip2c {
    asProviderMetadata(params: types.MetadataQueryResult): data.ProviderMetadata;
    asServerCapabilities(result: types.CapabiltiesDiscoveryResult): data.DataProtocolServerCapabilities;
}
export declare const p2c: Ip2c;
