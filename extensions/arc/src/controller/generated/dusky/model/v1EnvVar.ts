/**
 * Dusky API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v1
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { V1EnvVarSource } from './v1EnvVarSource';

export class V1EnvVar {
    'name'?: string;
    'value'?: string;
    'valueFrom'?: V1EnvVarSource;

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "name",
            "baseName": "name",
            "type": "string"
        },
        {
            "name": "value",
            "baseName": "value",
            "type": "string"
        },
        {
            "name": "valueFrom",
            "baseName": "valueFrom",
            "type": "V1EnvVarSource"
        }    ];

    static getAttributeTypeMap() {
        return V1EnvVar.attributeTypeMap;
    }
}

