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

import { V1ConfigMapKeySelector } from './v1ConfigMapKeySelector';
import { V1ObjectFieldSelector } from './v1ObjectFieldSelector';
import { V1ResourceFieldSelector } from './v1ResourceFieldSelector';
import { V1SecretKeySelector } from './v1SecretKeySelector';

export class V1EnvVarSource {
    'configMapKeyRef'?: V1ConfigMapKeySelector;
    'fieldRef'?: V1ObjectFieldSelector;
    'resourceFieldRef'?: V1ResourceFieldSelector;
    'secretKeyRef'?: V1SecretKeySelector;

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "configMapKeyRef",
            "baseName": "configMapKeyRef",
            "type": "V1ConfigMapKeySelector"
        },
        {
            "name": "fieldRef",
            "baseName": "fieldRef",
            "type": "V1ObjectFieldSelector"
        },
        {
            "name": "resourceFieldRef",
            "baseName": "resourceFieldRef",
            "type": "V1ResourceFieldSelector"
        },
        {
            "name": "secretKeyRef",
            "baseName": "secretKeyRef",
            "type": "V1SecretKeySelector"
        }    ];

    static getAttributeTypeMap() {
        return V1EnvVarSource.attributeTypeMap;
    }
}

