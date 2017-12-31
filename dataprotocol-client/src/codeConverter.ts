import * as data from 'data';
import * as proto from './protocol';
import * as types from './types';

export interface Ic2p {
	asConnectionParams(connectionUri: string, connectionInfo: data.ConnectionInfo): proto.ConnectParams;
	asCapabilitiesParams(client: data.DataProtocolClientCapabilities): proto.CapabiltiesDiscoveryParams;
	asExecutionPlanOptions(planOptions: data.ExecutionPlanOptions): proto.ExecutionPlanOptions;
	asMetadataQueryParams(connectionUri: string): types.MetadataQueryParams;
	asListDatabasesParams(connectionUri: string): proto.ListDatabasesParams;
	asTableMetadataParams(connectionUri: string, metadata: data.ObjectMetadata): proto.TableMetadataParams;
	asRestoreParams(ownerUri: string, params: data.RestoreInfo): types.RestoreParams;
	asRestoreConfigInfoParams(ownerUri: string): types.RestoreConfigInfoRequestParams;
	asConnectionDetail(connInfo: data.ConnectionInfo): types.ConnectionDetails;
	asExpandInfo(nodeInfo: data.ExpandNodeInfo): types.ExpandParams;
	asCloseSessionInfo(nodeInfo: data.ObjectExplorerCloseSessionInfo): types.CloseSessionParams;
	asScriptingParams(connectionUri: string, operation: types.ScriptOperation, metadata: data.ObjectMetadata, paramDetails: data.ScriptingParamDetails): types.ScriptingParams;
	asListTasksParams(params: data.ListTasksParams): types.ListTasksParams;
	asCancelTaskParams(params: data.CancelTaskParams): types.CancelTaskParams;
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

function asListDatabasesParams(connectionUri: string): proto.ListDatabasesParams {
	return <proto.ListDatabasesParams>{
		ownerUri: connectionUri
	};
}

function asExecutionPlanOptions(planOptions: data.ExecutionPlanOptions): proto.ExecutionPlanOptions {
	return <proto.ExecutionPlanOptions>{
		includeEstimatedExecutionPlanXml: planOptions ? planOptions.displayEstimatedQueryPlan : undefined,
		includeActualExecutionPlanXml: planOptions ? planOptions.displayActualQueryPlan : undefined
	};
}

function asMetadataQueryParams(connectionUri: string): types.MetadataQueryParams {
	return <types.MetadataQueryParams>{
		ownerUri: connectionUri
	};
}

function asTableMetadataParams(connectionUri: string, metadata: data.ObjectMetadata): proto.TableMetadataParams {
	return <proto.TableMetadataParams>{
		ownerUri: connectionUri,
		schema: metadata.schema,
		objectName: metadata.name
	};
}

function asRestoreParams(ownerUri: string, params: data.RestoreInfo): types.RestoreParams {
	return <types.RestoreParams>{
		ownerUri: ownerUri,
		options: params.options,
		taskExecutionMode: params.taskExecutionMode
	};
}

function asRestoreConfigInfoParams(ownerUri: string): types.RestoreConfigInfoRequestParams {
	return <types.RestoreConfigInfoRequestParams>{
		ownerUri: ownerUri
	};
}

function asConnectionDetail(connInfo: data.ConnectionInfo): types.ConnectionDetails {
	return <types.ConnectionDetails>{
		options: connInfo.options
	};
}

function asExpandInfo(nodeInfo: data.ExpandNodeInfo): types.ExpandParams {
	return <types.ExpandParams>{
		sessionId: nodeInfo.sessionId,
		nodePath: nodeInfo.nodePath
	};
}

function asCloseSessionInfo(nodeInfo: data.ObjectExplorerCloseSessionInfo): types.CloseSessionParams {
	return <types.CloseSessionParams>{
		sessionId: nodeInfo.sessionId
	};
}

function asScriptingParams(connectionUri: string, operation: types.ScriptOperation, metadata: data.ObjectMetadata, paramDetails: data.ScriptingParamDetails): types.ScriptingParams {
	let scriptingObject: types.ScriptingObject = {
		type: metadata.metadataTypeName,
		schema: metadata.schema,
		name: metadata.name
	}
	let targetDatabaseEngineEdition = paramDetails.targetDatabaseEngineEdition;
	let targetDatabaseEngineType = paramDetails.targetDatabaseEngineType;
	let scriptCompatibilityOption = paramDetails.scriptCompatibilityOption;
	let options: types.ScriptOptions = {
		scriptCreateDrop: (operation === types.ScriptOperation.Delete) ? 'ScriptDrop' :
						  (operation === types.ScriptOperation.Select) ? 'ScriptSelect' : 'ScriptCreate',
		typeOfDataToScript: 'SchemaOnly',
		scriptStatistics: 'ScriptStatsNone',
		targetDatabaseEngineEdition: targetDatabaseEngineEdition ? targetDatabaseEngineEdition : 'SqlServerEnterpriseEdition',
		targetDatabaseEngineType: targetDatabaseEngineType ? targetDatabaseEngineType : 'SingleInstance',
		scriptCompatibilityOption: scriptCompatibilityOption ? scriptCompatibilityOption : 'Script140Compat'
	}
	return <types.ScriptingParams> {
		connectionString: null,
		filePath: paramDetails.filePath,
		scriptingObjects: [scriptingObject],
		scriptDestination: 'ToEditor',
		includeObjectCriteria: null,
		excludeObjectCriteria: null,
		includeSchemas: null,
		excludeSchemas: null,
		includeTypes: null,
		excludeTypes: null,
		scriptOptions: options,
		connectionDetails: null,
		ownerURI: connectionUri,
		operation: operation
	};
}

function asListTasksParams(params: data.ListTasksParams): types.ListTasksParams {
	return <types.ListTasksParams>{
		listActiveTasksOnly: params.listActiveTasksOnly
	};
}

function asCancelTaskParams(params: data.CancelTaskParams): types.CancelTaskParams {
	return <types.CancelTaskParams>{
		taskId: params.taskId
	};
}

export const c2p: Ic2p = {
	asConnectionParams,
	asCapabilitiesParams,
	asExecutionPlanOptions,
	asMetadataQueryParams,
	asListDatabasesParams,
	asTableMetadataParams,
	asRestoreParams,
	asRestoreConfigInfoParams,
	asConnectionDetail,
	asExpandInfo,
	asCloseSessionInfo,
	asScriptingParams,
	asListTasksParams,
	asCancelTaskParams
};
