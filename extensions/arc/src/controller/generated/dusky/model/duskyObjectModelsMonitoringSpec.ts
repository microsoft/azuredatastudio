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

import { DuskyObjectModelsTINASpec } from './duskyObjectModelsTINASpec';

export class DuskyObjectModelsMonitoringSpec {
    'tina'?: DuskyObjectModelsTINASpec;

    static discriminator: string | undefined = undefined;

    static attributeTypeMap: Array<{name: string, baseName: string, type: string}> = [
        {
            "name": "tina",
            "baseName": "tina",
            "type": "DuskyObjectModelsTINASpec"
        }    ];

    static getAttributeTypeMap() {
        return DuskyObjectModelsMonitoringSpec.attributeTypeMap;
    }
}

