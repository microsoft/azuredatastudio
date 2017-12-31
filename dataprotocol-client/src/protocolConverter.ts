import * as data from 'data';
import * as types from './types';

export interface Ip2c {
	asProviderMetadata(params: types.MetadataQueryResult): data.ProviderMetadata;
	asRestorePlanResponse(params: types.RestorePlanResponse): data.RestorePlanResponse;
	asRestoreResponse(params: types.RestoreResponse): data.RestoreResponse;
	asRestoreConfigInfo(params: types.RestoreConfigInfoResponse): data.RestoreConfigInfo;
	asObjectExplorerCreateSessionResponse(params: types.CreateSessionResponse): data.ObjectExplorerSessionResponse;
	asObjectExplorerCloseSessionResponse(params: types.CloseSessionResponse): data.ObjectExplorerCloseSessionResponse;
	asScriptingResult(params: types.ScriptingResult): data.ScriptingResult;
	asListTasksResponse(response: types.ListTasksResponse): data.ListTasksResponse;
	asTaskInfo(params: types.TaskInfo): data.TaskInfo;
}

function asProviderMetadata(params: types.MetadataQueryResult): data.ProviderMetadata {
	let objectMetadata: data.ObjectMetadata[] = [];

	if (!params.metadata || !params.metadata.length) {
		return {
			objectMetadata: objectMetadata
		};
	}

	for (let i = 0; i < params.metadata.length; ++i) {
		let metadata: types.ObjectMetadata = params.metadata[i];

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
			metadataTypeName: metadataTypeName,
			metadataType: metadata.metadataType,
			name: metadata.name,
			schema: metadata.schema,
			urn: metadata.urn
		});
	}

	return <data.ProviderMetadata>{
		objectMetadata: objectMetadata
	};
}

function asRestorePlanResponse(params: types.RestorePlanResponse): data.RestorePlanResponse {
	return <data.RestorePlanResponse>{
		backupSetsToRestore: params.backupSetsToRestore,
		canRestore: params.canRestore,
		databaseNamesFromBackupSets: params.databaseNamesFromBackupSets,
		dbFiles: params.dbFiles,
		errorMessage: params.errorMessage,
		planDetails: params.planDetails,
		sessionId: params.sessionId
	};
}

function asRestoreResponse(params: types.RestoreResponse): data.RestoreResponse {
	return <data.RestoreResponse>{
		result: params.result,
		errorMessage: params.errorMessage,
		taskId: params.taskId
	};
}

function asRestoreConfigInfo(params: types.RestoreConfigInfoResponse): data.RestoreConfigInfo {
	return <data.RestoreConfigInfo>{
		configInfo: params.configInfo
	};
}

function asObjectExplorerCreateSessionResponse(params: types.CreateSessionResponse): data.ObjectExplorerSessionResponse {
	return <data.ObjectExplorerSessionResponse>{
		sessionId: params.sessionId
	};
}

function asObjectExplorerCloseSessionResponse(params: types.CloseSessionResponse): data.ObjectExplorerCloseSessionResponse {
	return <data.ObjectExplorerCloseSessionResponse>{
		sessionId: params.sessionId,
		success: params.success
	};
}

function asScriptingResult(params: types.ScriptingResult): data.ScriptingResult {
	return <data.ScriptingResult>{
		operationId: params.operationId,
		script: params.script
	};
}

function asListTasksResponse(response: types.ListTasksResponse): data.ListTasksResponse {
	return <data.ListTasksResponse>{
		tasks: response.tasks
	};
}

function asTaskInfo(params: types.TaskInfo): data.TaskInfo {
	return <data.TaskInfo>{
		taskId: params.taskId,
		status: params.status,
		taskExecutionMode: params.taskExecutionMode,
		serverName: params.serverName,
		name: params.name,
		databaseName: params.databaseName,
		description: params.description,
		providerName: params.providerName,
		isCancelable: params.isCancelable,
	};
}

export const p2c: Ip2c = {
	asProviderMetadata,
	asRestorePlanResponse,
	asRestoreResponse,
	asRestoreConfigInfo,
	asObjectExplorerCreateSessionResponse,
	asObjectExplorerCloseSessionResponse,
	asScriptingResult,
	asListTasksResponse,
	asTaskInfo
};
