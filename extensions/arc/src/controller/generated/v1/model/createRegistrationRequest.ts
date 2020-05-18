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

import { RegistrationSpec } from './registrationSpec';

export class CreateRegistrationRequest {
    'namespace'?: string;
    'name'?: string;
    'spec'?: RegistrationSpec;

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "namespace",
            "baseName": "namespace",
            "type": "string"
        },
        {
            "name": "name",
            "baseName": "name",
            "type": "string"
        },
        {
            "name": "spec",
            "baseName": "spec",
            "type": "RegistrationSpec"
        }    ];

    static getAttributeTypeMap() {
        return CreateRegistrationRequest.attributeTypeMap;
    }
}

