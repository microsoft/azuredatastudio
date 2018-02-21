import * as data from 'data';
import * as proto from './protocol';
import * as types from './types';
export interface Ic2p {
    asConnectionParams(connectionUri: string, connectionInfo: data.ConnectionInfo): proto.ConnectParams;
    asExecutionPlanOptions(planOptions: data.ExecutionPlanOptions): types.ExecutionPlanOptions;
    asScriptingParams(connectionUri: string, operation: data.ScriptOperation, metadata: data.ObjectMetadata, paramDetails: data.ScriptingParamDetails): types.ScriptingParams;
}
export declare const c2p: Ic2p;
