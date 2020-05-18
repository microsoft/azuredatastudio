/**
 * SQL Server Big Data Cluster API
 * OpenAPI specification for **SQL Server Big Data Cluster**.
 *
 * The version of the OpenAPI document: 1.0.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { ResourceStatusModel } from './resourceStatusModel';

export class ServiceStatusModel {
    'serviceName'?: string;
    'state'?: string;
    'healthStatus'?: string;
    'details'?: string;
    'resources'?: Array<ResourceStatusModel>;

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "serviceName",
            "baseName": "serviceName",
            "type": "string"
        },
        {
            "name": "state",
            "baseName": "state",
            "type": "string"
        },
        {
            "name": "healthStatus",
            "baseName": "healthStatus",
            "type": "string"
        },
        {
            "name": "details",
            "baseName": "details",
            "type": "string"
        },
        {
            "name": "resources",
            "baseName": "resources",
            "type": "Array<ResourceStatusModel>"
        }    ];

    static getAttributeTypeMap() {
        return ServiceStatusModel.attributeTypeMap;
    }
}

