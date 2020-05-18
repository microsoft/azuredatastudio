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

import { DuskyObjectModelsPluginSpec } from './duskyObjectModelsPluginSpec';

export class DuskyObjectModelsEngineSpec {
    'type': string;
    'version'?: number | null;
    'settings'?: { [key: string]: string; };
    'plugins'?: Array<DuskyObjectModelsPluginSpec>;

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "type",
            "baseName": "type",
            "type": "string"
        },
        {
            "name": "version",
            "baseName": "version",
            "type": "number"
        },
        {
            "name": "settings",
            "baseName": "settings",
            "type": "{ [key: string]: string; }"
        },
        {
            "name": "plugins",
            "baseName": "plugins",
            "type": "Array<DuskyObjectModelsPluginSpec>"
        }    ];

    static getAttributeTypeMap() {
        return DuskyObjectModelsEngineSpec.attributeTypeMap;
    }
}

