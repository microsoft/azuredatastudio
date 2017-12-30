import * as data from 'data';
import * as proto from './protocol';

export interface Ic2p {
	asConnectionParams(connectionUri: string, connectionInfo: data.ConnectionInfo): proto.ConnectParams;
	asCapabilitiesParams(client: data.DataProtocolClientCapabilities): proto.CapabiltiesDiscoveryParams;
}

function asCapabilitiesParams(client: data.DataProtocolClientCapabilities): proto.CapabiltiesDiscoveryParams {
	let params: proto.CapabiltiesDiscoveryParams = {
		hostName: client.hostName,
		hostVersion: client.hostVersion
	};
	return params;
}

function asConnectionParams(connUri: string, connInfo: data.ConnectionInfo): proto.ConnectParams {
	return {
		ownerUri: connUri,
		connection: {
			options: connInfo.options
		}
	};
}

export const c2p: Ic2p = {
	asConnectionParams,
	asCapabilitiesParams
};
