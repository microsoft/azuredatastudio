export * from './clusterPatchModel';
export * from './duskyObjectModelsBackup';
export * from './duskyObjectModelsBackupCopySchedule';
export * from './duskyObjectModelsBackupRetention';
export * from './duskyObjectModelsBackupSpec';
export * from './duskyObjectModelsBackupTier';
export * from './duskyObjectModelsDatabase';
export * from './duskyObjectModelsDatabaseService';
export * from './duskyObjectModelsDatabaseServiceArcPayload';
export * from './duskyObjectModelsDatabaseServiceCondition';
export * from './duskyObjectModelsDatabaseServiceList';
export * from './duskyObjectModelsDatabaseServiceSpec';
export * from './duskyObjectModelsDatabaseServiceStatus';
export * from './duskyObjectModelsDatabaseServiceVolumeStatus';
export * from './duskyObjectModelsDockerSpec';
export * from './duskyObjectModelsDuskyValidationMessage';
export * from './duskyObjectModelsDuskyValidationResult';
export * from './duskyObjectModelsEngineSpec';
export * from './duskyObjectModelsError';
export * from './duskyObjectModelsErrorDetails';
export * from './duskyObjectModelsMonitoringSpec';
export * from './duskyObjectModelsObjectMeta';
export * from './duskyObjectModelsOperatorStatus';
export * from './duskyObjectModelsPluginSpec';
export * from './duskyObjectModelsReplicaStatus';
export * from './duskyObjectModelsResourceRequirements';
export * from './duskyObjectModelsRestoreStatus';
export * from './duskyObjectModelsRetentionSpec';
export * from './duskyObjectModelsRole';
export * from './duskyObjectModelsScaleSpec';
export * from './duskyObjectModelsSchedulingSpec';
export * from './duskyObjectModelsServiceSpec';
export * from './duskyObjectModelsStorageSpec';
export * from './duskyObjectModelsTINASpec';
export * from './duskyObjectModelsUser';
export * from './logsRequest';
export * from './v1ListMeta';
export * from './v1Status';
export * from './v1StatusCause';
export * from './v1StatusDetails';

import localVarRequest = require('request');

import { ClusterPatchModel } from './clusterPatchModel';
import { DuskyObjectModelsBackup } from './duskyObjectModelsBackup';
import { DuskyObjectModelsBackupCopySchedule } from './duskyObjectModelsBackupCopySchedule';
import { DuskyObjectModelsBackupRetention } from './duskyObjectModelsBackupRetention';
import { DuskyObjectModelsBackupSpec } from './duskyObjectModelsBackupSpec';
import { DuskyObjectModelsBackupTier } from './duskyObjectModelsBackupTier';
import { DuskyObjectModelsDatabase } from './duskyObjectModelsDatabase';
import { DuskyObjectModelsDatabaseService } from './duskyObjectModelsDatabaseService';
import { DuskyObjectModelsDatabaseServiceArcPayload } from './duskyObjectModelsDatabaseServiceArcPayload';
import { DuskyObjectModelsDatabaseServiceCondition } from './duskyObjectModelsDatabaseServiceCondition';
import { DuskyObjectModelsDatabaseServiceList } from './duskyObjectModelsDatabaseServiceList';
import { DuskyObjectModelsDatabaseServiceSpec } from './duskyObjectModelsDatabaseServiceSpec';
import { DuskyObjectModelsDatabaseServiceStatus } from './duskyObjectModelsDatabaseServiceStatus';
import { DuskyObjectModelsDatabaseServiceVolumeStatus } from './duskyObjectModelsDatabaseServiceVolumeStatus';
import { DuskyObjectModelsDockerSpec } from './duskyObjectModelsDockerSpec';
import { DuskyObjectModelsDuskyValidationMessage } from './duskyObjectModelsDuskyValidationMessage';
import { DuskyObjectModelsDuskyValidationResult } from './duskyObjectModelsDuskyValidationResult';
import { DuskyObjectModelsEngineSpec } from './duskyObjectModelsEngineSpec';
import { DuskyObjectModelsError } from './duskyObjectModelsError';
import { DuskyObjectModelsErrorDetails } from './duskyObjectModelsErrorDetails';
import { DuskyObjectModelsMonitoringSpec } from './duskyObjectModelsMonitoringSpec';
import { DuskyObjectModelsObjectMeta } from './duskyObjectModelsObjectMeta';
import { DuskyObjectModelsOperatorStatus } from './duskyObjectModelsOperatorStatus';
import { DuskyObjectModelsPluginSpec } from './duskyObjectModelsPluginSpec';
import { DuskyObjectModelsReplicaStatus } from './duskyObjectModelsReplicaStatus';
import { DuskyObjectModelsResourceRequirements } from './duskyObjectModelsResourceRequirements';
import { DuskyObjectModelsRestoreStatus } from './duskyObjectModelsRestoreStatus';
import { DuskyObjectModelsRetentionSpec } from './duskyObjectModelsRetentionSpec';
import { DuskyObjectModelsRole } from './duskyObjectModelsRole';
import { DuskyObjectModelsScaleSpec } from './duskyObjectModelsScaleSpec';
import { DuskyObjectModelsSchedulingSpec } from './duskyObjectModelsSchedulingSpec';
import { DuskyObjectModelsServiceSpec } from './duskyObjectModelsServiceSpec';
import { DuskyObjectModelsStorageSpec } from './duskyObjectModelsStorageSpec';
import { DuskyObjectModelsTINASpec } from './duskyObjectModelsTINASpec';
import { DuskyObjectModelsUser } from './duskyObjectModelsUser';
import { LogsRequest } from './logsRequest';
import { V1ListMeta } from './v1ListMeta';
import { V1Status } from './v1Status';
import { V1StatusCause } from './v1StatusCause';
import { V1StatusDetails } from './v1StatusDetails';

/* tslint:disable:no-unused-variable */
let primitives = [
                    "string",
                    "boolean",
                    "double",
                    "integer",
                    "long",
                    "float",
                    "number",
                    "any"
                 ];

let enumsMap: {[index: string]: any} = {
        "DuskyObjectModelsDatabaseServiceCondition.StatusEnum": DuskyObjectModelsDatabaseServiceCondition.StatusEnum,
        "DuskyObjectModelsDuskyValidationMessage.TypeEnum": DuskyObjectModelsDuskyValidationMessage.TypeEnum,
        "DuskyObjectModelsDuskyValidationMessage.CodeEnum": DuskyObjectModelsDuskyValidationMessage.CodeEnum,
}

let typeMap: {[index: string]: any} = {
    "ClusterPatchModel": ClusterPatchModel,
    "DuskyObjectModelsBackup": DuskyObjectModelsBackup,
    "DuskyObjectModelsBackupCopySchedule": DuskyObjectModelsBackupCopySchedule,
    "DuskyObjectModelsBackupRetention": DuskyObjectModelsBackupRetention,
    "DuskyObjectModelsBackupSpec": DuskyObjectModelsBackupSpec,
    "DuskyObjectModelsBackupTier": DuskyObjectModelsBackupTier,
    "DuskyObjectModelsDatabase": DuskyObjectModelsDatabase,
    "DuskyObjectModelsDatabaseService": DuskyObjectModelsDatabaseService,
    "DuskyObjectModelsDatabaseServiceArcPayload": DuskyObjectModelsDatabaseServiceArcPayload,
    "DuskyObjectModelsDatabaseServiceCondition": DuskyObjectModelsDatabaseServiceCondition,
    "DuskyObjectModelsDatabaseServiceList": DuskyObjectModelsDatabaseServiceList,
    "DuskyObjectModelsDatabaseServiceSpec": DuskyObjectModelsDatabaseServiceSpec,
    "DuskyObjectModelsDatabaseServiceStatus": DuskyObjectModelsDatabaseServiceStatus,
    "DuskyObjectModelsDatabaseServiceVolumeStatus": DuskyObjectModelsDatabaseServiceVolumeStatus,
    "DuskyObjectModelsDockerSpec": DuskyObjectModelsDockerSpec,
    "DuskyObjectModelsDuskyValidationMessage": DuskyObjectModelsDuskyValidationMessage,
    "DuskyObjectModelsDuskyValidationResult": DuskyObjectModelsDuskyValidationResult,
    "DuskyObjectModelsEngineSpec": DuskyObjectModelsEngineSpec,
    "DuskyObjectModelsError": DuskyObjectModelsError,
    "DuskyObjectModelsErrorDetails": DuskyObjectModelsErrorDetails,
    "DuskyObjectModelsMonitoringSpec": DuskyObjectModelsMonitoringSpec,
    "DuskyObjectModelsObjectMeta": DuskyObjectModelsObjectMeta,
    "DuskyObjectModelsOperatorStatus": DuskyObjectModelsOperatorStatus,
    "DuskyObjectModelsPluginSpec": DuskyObjectModelsPluginSpec,
    "DuskyObjectModelsReplicaStatus": DuskyObjectModelsReplicaStatus,
    "DuskyObjectModelsResourceRequirements": DuskyObjectModelsResourceRequirements,
    "DuskyObjectModelsRestoreStatus": DuskyObjectModelsRestoreStatus,
    "DuskyObjectModelsRetentionSpec": DuskyObjectModelsRetentionSpec,
    "DuskyObjectModelsRole": DuskyObjectModelsRole,
    "DuskyObjectModelsScaleSpec": DuskyObjectModelsScaleSpec,
    "DuskyObjectModelsSchedulingSpec": DuskyObjectModelsSchedulingSpec,
    "DuskyObjectModelsServiceSpec": DuskyObjectModelsServiceSpec,
    "DuskyObjectModelsStorageSpec": DuskyObjectModelsStorageSpec,
    "DuskyObjectModelsTINASpec": DuskyObjectModelsTINASpec,
    "DuskyObjectModelsUser": DuskyObjectModelsUser,
    "LogsRequest": LogsRequest,
    "V1ListMeta": V1ListMeta,
    "V1Status": V1Status,
    "V1StatusCause": V1StatusCause,
    "V1StatusDetails": V1StatusDetails,
}

export class ObjectSerializer {
    public static findCorrectType(data: any, expectedType: string) {
        if (data == undefined) {
            return expectedType;
        } else if (primitives.indexOf(expectedType.toLowerCase()) !== -1) {
            return expectedType;
        } else if (expectedType === "Date") {
            return expectedType;
        } else {
            if (enumsMap[expectedType]) {
                return expectedType;
            }

            if (!typeMap[expectedType]) {
                return expectedType; // w/e we don't know the type
            }

            // Check the discriminator
            let discriminatorProperty = typeMap[expectedType].discriminator;
            if (discriminatorProperty == null) {
                return expectedType; // the type does not have a discriminator. use it.
            } else {
                if (data[discriminatorProperty]) {
                    var discriminatorType = data[discriminatorProperty];
                    if(typeMap[discriminatorType]){
                        return discriminatorType; // use the type given in the discriminator
                    } else {
                        return expectedType; // discriminator did not map to a type
                    }
                } else {
                    return expectedType; // discriminator was not present (or an empty string)
                }
            }
        }
    }

    public static serialize(data: any, type: string) {
        if (data == undefined) {
            return data;
        } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        } else if (type.lastIndexOf("Array<", 0) === 0) { // string.startsWith pre es6
            let subType: string = type.replace("Array<", ""); // Array<Type> => Type>
            subType = subType.substring(0, subType.length - 1); // Type> => Type
            let transformedData: any[] = [];
            for (let index in data) {
                let date = data[index];
                transformedData.push(ObjectSerializer.serialize(date, subType));
            }
            return transformedData;
        } else if (type === "Date") {
            return data.toISOString();
        } else {
            if (enumsMap[type]) {
                return data;
            }
            if (!typeMap[type]) { // in case we dont know the type
                return data;
            }

            // Get the actual type of this object
            type = this.findCorrectType(data, type);

            // get the map for the correct type.
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            let instance: {[index: string]: any} = {};
            for (let index in attributeTypes) {
                let attributeType = attributeTypes[index];
                instance[attributeType.baseName] = ObjectSerializer.serialize(data[attributeType.name], attributeType.type);
            }
            return instance;
        }
    }

    public static deserialize(data: any, type: string) {
        // polymorphism may change the actual type.
        type = ObjectSerializer.findCorrectType(data, type);
        if (data == undefined) {
            return data;
        } else if (primitives.indexOf(type.toLowerCase()) !== -1) {
            return data;
        } else if (type.lastIndexOf("Array<", 0) === 0) { // string.startsWith pre es6
            let subType: string = type.replace("Array<", ""); // Array<Type> => Type>
            subType = subType.substring(0, subType.length - 1); // Type> => Type
            let transformedData: any[] = [];
            for (let index in data) {
                let date = data[index];
                transformedData.push(ObjectSerializer.deserialize(date, subType));
            }
            return transformedData;
        } else if (type === "Date") {
            return new Date(data);
        } else {
            if (enumsMap[type]) {// is Enum
                return data;
            }

            if (!typeMap[type]) { // dont know the type
                return data;
            }
            let instance = new typeMap[type]();
            let attributeTypes = typeMap[type].getAttributeTypeMap();
            for (let index in attributeTypes) {
                let attributeType = attributeTypes[index];
                instance[attributeType.name] = ObjectSerializer.deserialize(data[attributeType.baseName], attributeType.type);
            }
            return instance;
        }
    }
}

export interface Authentication {
    /**
    * Apply authentication settings to header and query params.
    */
    applyToRequest(requestOptions: localVarRequest.Options): Promise<void> | void;
}

export class HttpBasicAuth implements Authentication {
    public username: string = '';
    public password: string = '';

    applyToRequest(requestOptions: localVarRequest.Options): void {
        requestOptions.auth = {
            username: this.username, password: this.password
        }
    }
}

export class HttpBearerAuth implements Authentication {
    public accessToken: string | (() => string) = '';

    applyToRequest(requestOptions: localVarRequest.Options): void {
        if (requestOptions && requestOptions.headers) {
            const accessToken = typeof this.accessToken === 'function'
                            ? this.accessToken()
                            : this.accessToken;
            requestOptions.headers["Authorization"] = "Bearer " + accessToken;
        }
    }
}

export class ApiKeyAuth implements Authentication {
    public apiKey: string = '';

    constructor(private location: string, private paramName: string) {
    }

    applyToRequest(requestOptions: localVarRequest.Options): void {
        if (this.location == "query") {
            (<any>requestOptions.qs)[this.paramName] = this.apiKey;
        } else if (this.location == "header" && requestOptions && requestOptions.headers) {
            requestOptions.headers[this.paramName] = this.apiKey;
        } else if (this.location == 'cookie' && requestOptions && requestOptions.headers) {
            if (requestOptions.headers['Cookie']) {
                requestOptions.headers['Cookie'] += '; ' + this.paramName + '=' + encodeURIComponent(this.apiKey);
            }
            else {
                requestOptions.headers['Cookie'] = this.paramName + '=' + encodeURIComponent(this.apiKey);
            }
        }
    }
}

export class OAuth implements Authentication {
    public accessToken: string = '';

    applyToRequest(requestOptions: localVarRequest.Options): void {
        if (requestOptions && requestOptions.headers) {
            requestOptions.headers["Authorization"] = "Bearer " + this.accessToken;
        }
    }
}

export class VoidAuth implements Authentication {
    public username: string = '';
    public password: string = '';

    applyToRequest(_: localVarRequest.Options): void {
        // Do nothing
    }
}

export type Interceptor = (requestOptions: localVarRequest.Options) => (Promise<void> | void);
