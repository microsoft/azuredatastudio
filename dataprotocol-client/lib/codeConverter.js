"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types = require("./types");
function asConnectionParams(ownerUri, connInfo) {
    return {
        ownerUri,
        connection: {
            options: connInfo.options
        }
    };
}
function asExecutionPlanOptions(planOptions) {
    return {
        includeEstimatedExecutionPlanXml: planOptions ? planOptions.displayEstimatedQueryPlan : undefined,
        includeActualExecutionPlanXml: planOptions ? planOptions.displayActualQueryPlan : undefined
    };
}
function asScriptingParams(ownerURI, operation, metadata, paramDetails) {
    let scriptingObject = {
        type: metadata.metadataTypeName,
        schema: metadata.schema,
        name: metadata.name
    };
    let targetDatabaseEngineEdition = paramDetails.targetDatabaseEngineEdition;
    let targetDatabaseEngineType = paramDetails.targetDatabaseEngineType;
    let scriptCompatibilityOption = paramDetails.scriptCompatibilityOption;
    let scriptOptions = {
        scriptCreateDrop: (operation === types.ScriptOperation.Delete) ? 'ScriptDrop' :
            (operation === types.ScriptOperation.Select) ? 'ScriptSelect' : 'ScriptCreate',
        typeOfDataToScript: 'SchemaOnly',
        scriptStatistics: 'ScriptStatsNone',
        targetDatabaseEngineEdition: targetDatabaseEngineEdition ? targetDatabaseEngineEdition : 'SqlServerEnterpriseEdition',
        targetDatabaseEngineType: targetDatabaseEngineType ? targetDatabaseEngineType : 'SingleInstance',
        scriptCompatibilityOption: scriptCompatibilityOption ? scriptCompatibilityOption : 'Script140Compat'
    };
    return {
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
        scriptOptions,
        connectionDetails: null,
        selectScript: null,
        ownerURI,
        operation
    };
}
exports.c2p = {
    asConnectionParams,
    asExecutionPlanOptions,
    asScriptingParams
};
