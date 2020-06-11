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
export * from './duskyObjectModelsEngineSettings';
export * from './duskyObjectModelsEngineSpec';
export * from './duskyObjectModelsError';
export * from './duskyObjectModelsErrorDetails';
export * from './duskyObjectModelsMonitoringSpec';
export * from './duskyObjectModelsOperatorStatus';
export * from './duskyObjectModelsPluginSpec';
export * from './duskyObjectModelsReplicaStatus';
export * from './duskyObjectModelsRestoreStatus';
export * from './duskyObjectModelsRetentionSpec';
export * from './duskyObjectModelsRole';
export * from './duskyObjectModelsScaleSpec';
export * from './duskyObjectModelsSchedulingOptions';
export * from './duskyObjectModelsSchedulingSpec';
export * from './duskyObjectModelsSecuritySpec';
export * from './duskyObjectModelsServiceSpec';
export * from './duskyObjectModelsStorageSpec';
export * from './duskyObjectModelsTINASpec';
export * from './duskyObjectModelsUser';
export * from './intstrIntOrString';
export * from './logsRequest';
export * from './v1Affinity';
export * from './v1AWSElasticBlockStoreVolumeSource';
export * from './v1AzureDiskVolumeSource';
export * from './v1AzureFileVolumeSource';
export * from './v1Capabilities';
export * from './v1CephFSVolumeSource';
export * from './v1CinderVolumeSource';
export * from './v1ConfigMapEnvSource';
export * from './v1ConfigMapKeySelector';
export * from './v1ConfigMapProjection';
export * from './v1ConfigMapVolumeSource';
export * from './v1Container';
export * from './v1ContainerPort';
export * from './v1ContainerState';
export * from './v1ContainerStateRunning';
export * from './v1ContainerStateTerminated';
export * from './v1ContainerStateWaiting';
export * from './v1ContainerStatus';
export * from './v1CSIVolumeSource';
export * from './v1DownwardAPIProjection';
export * from './v1DownwardAPIVolumeFile';
export * from './v1DownwardAPIVolumeSource';
export * from './v1EmptyDirVolumeSource';
export * from './v1EnvFromSource';
export * from './v1EnvVar';
export * from './v1EnvVarSource';
export * from './v1EphemeralContainer';
export * from './v1ExecAction';
export * from './v1FCVolumeSource';
export * from './v1FlexVolumeSource';
export * from './v1FlockerVolumeSource';
export * from './v1GCEPersistentDiskVolumeSource';
export * from './v1GitRepoVolumeSource';
export * from './v1GlusterfsVolumeSource';
export * from './v1Handler';
export * from './v1HostAlias';
export * from './v1HostPathVolumeSource';
export * from './v1HTTPGetAction';
export * from './v1HTTPHeader';
export * from './v1ISCSIVolumeSource';
export * from './v1KeyToPath';
export * from './v1LabelSelector';
export * from './v1LabelSelectorRequirement';
export * from './v1Lifecycle';
export * from './v1ListMeta';
export * from './v1LocalObjectReference';
export * from './v1ManagedFieldsEntry';
export * from './v1NFSVolumeSource';
export * from './v1NodeAffinity';
export * from './v1NodeSelector';
export * from './v1NodeSelectorRequirement';
export * from './v1NodeSelectorTerm';
export * from './v1ObjectFieldSelector';
export * from './v1ObjectMeta';
export * from './v1OwnerReference';
export * from './v1PersistentVolumeClaimVolumeSource';
export * from './v1PhotonPersistentDiskVolumeSource';
export * from './v1Pod';
export * from './v1PodAffinity';
export * from './v1PodAffinityTerm';
export * from './v1PodAntiAffinity';
export * from './v1PodCondition';
export * from './v1PodDNSConfig';
export * from './v1PodDNSConfigOption';
export * from './v1PodIP';
export * from './v1PodReadinessGate';
export * from './v1PodSecurityContext';
export * from './v1PodSpec';
export * from './v1PodStatus';
export * from './v1PortworxVolumeSource';
export * from './v1PreferredSchedulingTerm';
export * from './v1Probe';
export * from './v1ProjectedVolumeSource';
export * from './v1QuobyteVolumeSource';
export * from './v1RBDVolumeSource';
export * from './v1ResourceFieldSelector';
export * from './v1ResourceRequirements';
export * from './v1ScaleIOVolumeSource';
export * from './v1SecretEnvSource';
export * from './v1SecretKeySelector';
export * from './v1SecretProjection';
export * from './v1SecretVolumeSource';
export * from './v1SecurityContext';
export * from './v1SELinuxOptions';
export * from './v1ServiceAccountTokenProjection';
export * from './v1Status';
export * from './v1StatusCause';
export * from './v1StatusDetails';
export * from './v1StorageOSVolumeSource';
export * from './v1Sysctl';
export * from './v1TCPSocketAction';
export * from './v1Toleration';
export * from './v1TopologySpreadConstraint';
export * from './v1Volume';
export * from './v1VolumeDevice';
export * from './v1VolumeMount';
export * from './v1VolumeProjection';
export * from './v1VsphereVirtualDiskVolumeSource';
export * from './v1WeightedPodAffinityTerm';
export * from './v1WindowsSecurityContextOptions';

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
import { DuskyObjectModelsEngineSettings } from './duskyObjectModelsEngineSettings';
import { DuskyObjectModelsEngineSpec } from './duskyObjectModelsEngineSpec';
import { DuskyObjectModelsError } from './duskyObjectModelsError';
import { DuskyObjectModelsErrorDetails } from './duskyObjectModelsErrorDetails';
import { DuskyObjectModelsMonitoringSpec } from './duskyObjectModelsMonitoringSpec';
import { DuskyObjectModelsOperatorStatus } from './duskyObjectModelsOperatorStatus';
import { DuskyObjectModelsPluginSpec } from './duskyObjectModelsPluginSpec';
import { DuskyObjectModelsReplicaStatus } from './duskyObjectModelsReplicaStatus';
import { DuskyObjectModelsRestoreStatus } from './duskyObjectModelsRestoreStatus';
import { DuskyObjectModelsRetentionSpec } from './duskyObjectModelsRetentionSpec';
import { DuskyObjectModelsRole } from './duskyObjectModelsRole';
import { DuskyObjectModelsScaleSpec } from './duskyObjectModelsScaleSpec';
import { DuskyObjectModelsSchedulingOptions } from './duskyObjectModelsSchedulingOptions';
import { DuskyObjectModelsSchedulingSpec } from './duskyObjectModelsSchedulingSpec';
import { DuskyObjectModelsSecuritySpec } from './duskyObjectModelsSecuritySpec';
import { DuskyObjectModelsServiceSpec } from './duskyObjectModelsServiceSpec';
import { DuskyObjectModelsStorageSpec } from './duskyObjectModelsStorageSpec';
import { DuskyObjectModelsTINASpec } from './duskyObjectModelsTINASpec';
import { DuskyObjectModelsUser } from './duskyObjectModelsUser';
import { IntstrIntOrString } from './intstrIntOrString';
import { LogsRequest } from './logsRequest';
import { V1Affinity } from './v1Affinity';
import { V1AWSElasticBlockStoreVolumeSource } from './v1AWSElasticBlockStoreVolumeSource';
import { V1AzureDiskVolumeSource } from './v1AzureDiskVolumeSource';
import { V1AzureFileVolumeSource } from './v1AzureFileVolumeSource';
import { V1Capabilities } from './v1Capabilities';
import { V1CephFSVolumeSource } from './v1CephFSVolumeSource';
import { V1CinderVolumeSource } from './v1CinderVolumeSource';
import { V1ConfigMapEnvSource } from './v1ConfigMapEnvSource';
import { V1ConfigMapKeySelector } from './v1ConfigMapKeySelector';
import { V1ConfigMapProjection } from './v1ConfigMapProjection';
import { V1ConfigMapVolumeSource } from './v1ConfigMapVolumeSource';
import { V1Container } from './v1Container';
import { V1ContainerPort } from './v1ContainerPort';
import { V1ContainerState } from './v1ContainerState';
import { V1ContainerStateRunning } from './v1ContainerStateRunning';
import { V1ContainerStateTerminated } from './v1ContainerStateTerminated';
import { V1ContainerStateWaiting } from './v1ContainerStateWaiting';
import { V1ContainerStatus } from './v1ContainerStatus';
import { V1CSIVolumeSource } from './v1CSIVolumeSource';
import { V1DownwardAPIProjection } from './v1DownwardAPIProjection';
import { V1DownwardAPIVolumeFile } from './v1DownwardAPIVolumeFile';
import { V1DownwardAPIVolumeSource } from './v1DownwardAPIVolumeSource';
import { V1EmptyDirVolumeSource } from './v1EmptyDirVolumeSource';
import { V1EnvFromSource } from './v1EnvFromSource';
import { V1EnvVar } from './v1EnvVar';
import { V1EnvVarSource } from './v1EnvVarSource';
import { V1EphemeralContainer } from './v1EphemeralContainer';
import { V1ExecAction } from './v1ExecAction';
import { V1FCVolumeSource } from './v1FCVolumeSource';
import { V1FlexVolumeSource } from './v1FlexVolumeSource';
import { V1FlockerVolumeSource } from './v1FlockerVolumeSource';
import { V1GCEPersistentDiskVolumeSource } from './v1GCEPersistentDiskVolumeSource';
import { V1GitRepoVolumeSource } from './v1GitRepoVolumeSource';
import { V1GlusterfsVolumeSource } from './v1GlusterfsVolumeSource';
import { V1Handler } from './v1Handler';
import { V1HostAlias } from './v1HostAlias';
import { V1HostPathVolumeSource } from './v1HostPathVolumeSource';
import { V1HTTPGetAction } from './v1HTTPGetAction';
import { V1HTTPHeader } from './v1HTTPHeader';
import { V1ISCSIVolumeSource } from './v1ISCSIVolumeSource';
import { V1KeyToPath } from './v1KeyToPath';
import { V1LabelSelector } from './v1LabelSelector';
import { V1LabelSelectorRequirement } from './v1LabelSelectorRequirement';
import { V1Lifecycle } from './v1Lifecycle';
import { V1ListMeta } from './v1ListMeta';
import { V1LocalObjectReference } from './v1LocalObjectReference';
import { V1ManagedFieldsEntry } from './v1ManagedFieldsEntry';
import { V1NFSVolumeSource } from './v1NFSVolumeSource';
import { V1NodeAffinity } from './v1NodeAffinity';
import { V1NodeSelector } from './v1NodeSelector';
import { V1NodeSelectorRequirement } from './v1NodeSelectorRequirement';
import { V1NodeSelectorTerm } from './v1NodeSelectorTerm';
import { V1ObjectFieldSelector } from './v1ObjectFieldSelector';
import { V1ObjectMeta } from './v1ObjectMeta';
import { V1OwnerReference } from './v1OwnerReference';
import { V1PersistentVolumeClaimVolumeSource } from './v1PersistentVolumeClaimVolumeSource';
import { V1PhotonPersistentDiskVolumeSource } from './v1PhotonPersistentDiskVolumeSource';
import { V1Pod } from './v1Pod';
import { V1PodAffinity } from './v1PodAffinity';
import { V1PodAffinityTerm } from './v1PodAffinityTerm';
import { V1PodAntiAffinity } from './v1PodAntiAffinity';
import { V1PodCondition } from './v1PodCondition';
import { V1PodDNSConfig } from './v1PodDNSConfig';
import { V1PodDNSConfigOption } from './v1PodDNSConfigOption';
import { V1PodIP } from './v1PodIP';
import { V1PodReadinessGate } from './v1PodReadinessGate';
import { V1PodSecurityContext } from './v1PodSecurityContext';
import { V1PodSpec } from './v1PodSpec';
import { V1PodStatus } from './v1PodStatus';
import { V1PortworxVolumeSource } from './v1PortworxVolumeSource';
import { V1PreferredSchedulingTerm } from './v1PreferredSchedulingTerm';
import { V1Probe } from './v1Probe';
import { V1ProjectedVolumeSource } from './v1ProjectedVolumeSource';
import { V1QuobyteVolumeSource } from './v1QuobyteVolumeSource';
import { V1RBDVolumeSource } from './v1RBDVolumeSource';
import { V1ResourceFieldSelector } from './v1ResourceFieldSelector';
import { V1ResourceRequirements } from './v1ResourceRequirements';
import { V1ScaleIOVolumeSource } from './v1ScaleIOVolumeSource';
import { V1SecretEnvSource } from './v1SecretEnvSource';
import { V1SecretKeySelector } from './v1SecretKeySelector';
import { V1SecretProjection } from './v1SecretProjection';
import { V1SecretVolumeSource } from './v1SecretVolumeSource';
import { V1SecurityContext } from './v1SecurityContext';
import { V1SELinuxOptions } from './v1SELinuxOptions';
import { V1ServiceAccountTokenProjection } from './v1ServiceAccountTokenProjection';
import { V1Status } from './v1Status';
import { V1StatusCause } from './v1StatusCause';
import { V1StatusDetails } from './v1StatusDetails';
import { V1StorageOSVolumeSource } from './v1StorageOSVolumeSource';
import { V1Sysctl } from './v1Sysctl';
import { V1TCPSocketAction } from './v1TCPSocketAction';
import { V1Toleration } from './v1Toleration';
import { V1TopologySpreadConstraint } from './v1TopologySpreadConstraint';
import { V1Volume } from './v1Volume';
import { V1VolumeDevice } from './v1VolumeDevice';
import { V1VolumeMount } from './v1VolumeMount';
import { V1VolumeProjection } from './v1VolumeProjection';
import { V1VsphereVirtualDiskVolumeSource } from './v1VsphereVirtualDiskVolumeSource';
import { V1WeightedPodAffinityTerm } from './v1WeightedPodAffinityTerm';
import { V1WindowsSecurityContextOptions } from './v1WindowsSecurityContextOptions';

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
        "DuskyObjectModelsDockerSpec.ImagePullPolicyEnum": DuskyObjectModelsDockerSpec.ImagePullPolicyEnum,
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
    "DuskyObjectModelsEngineSettings": DuskyObjectModelsEngineSettings,
    "DuskyObjectModelsEngineSpec": DuskyObjectModelsEngineSpec,
    "DuskyObjectModelsError": DuskyObjectModelsError,
    "DuskyObjectModelsErrorDetails": DuskyObjectModelsErrorDetails,
    "DuskyObjectModelsMonitoringSpec": DuskyObjectModelsMonitoringSpec,
    "DuskyObjectModelsOperatorStatus": DuskyObjectModelsOperatorStatus,
    "DuskyObjectModelsPluginSpec": DuskyObjectModelsPluginSpec,
    "DuskyObjectModelsReplicaStatus": DuskyObjectModelsReplicaStatus,
    "DuskyObjectModelsRestoreStatus": DuskyObjectModelsRestoreStatus,
    "DuskyObjectModelsRetentionSpec": DuskyObjectModelsRetentionSpec,
    "DuskyObjectModelsRole": DuskyObjectModelsRole,
    "DuskyObjectModelsScaleSpec": DuskyObjectModelsScaleSpec,
    "DuskyObjectModelsSchedulingOptions": DuskyObjectModelsSchedulingOptions,
    "DuskyObjectModelsSchedulingSpec": DuskyObjectModelsSchedulingSpec,
    "DuskyObjectModelsSecuritySpec": DuskyObjectModelsSecuritySpec,
    "DuskyObjectModelsServiceSpec": DuskyObjectModelsServiceSpec,
    "DuskyObjectModelsStorageSpec": DuskyObjectModelsStorageSpec,
    "DuskyObjectModelsTINASpec": DuskyObjectModelsTINASpec,
    "DuskyObjectModelsUser": DuskyObjectModelsUser,
    "IntstrIntOrString": IntstrIntOrString,
    "LogsRequest": LogsRequest,
    "V1AWSElasticBlockStoreVolumeSource": V1AWSElasticBlockStoreVolumeSource,
    "V1Affinity": V1Affinity,
    "V1AzureDiskVolumeSource": V1AzureDiskVolumeSource,
    "V1AzureFileVolumeSource": V1AzureFileVolumeSource,
    "V1CSIVolumeSource": V1CSIVolumeSource,
    "V1Capabilities": V1Capabilities,
    "V1CephFSVolumeSource": V1CephFSVolumeSource,
    "V1CinderVolumeSource": V1CinderVolumeSource,
    "V1ConfigMapEnvSource": V1ConfigMapEnvSource,
    "V1ConfigMapKeySelector": V1ConfigMapKeySelector,
    "V1ConfigMapProjection": V1ConfigMapProjection,
    "V1ConfigMapVolumeSource": V1ConfigMapVolumeSource,
    "V1Container": V1Container,
    "V1ContainerPort": V1ContainerPort,
    "V1ContainerState": V1ContainerState,
    "V1ContainerStateRunning": V1ContainerStateRunning,
    "V1ContainerStateTerminated": V1ContainerStateTerminated,
    "V1ContainerStateWaiting": V1ContainerStateWaiting,
    "V1ContainerStatus": V1ContainerStatus,
    "V1DownwardAPIProjection": V1DownwardAPIProjection,
    "V1DownwardAPIVolumeFile": V1DownwardAPIVolumeFile,
    "V1DownwardAPIVolumeSource": V1DownwardAPIVolumeSource,
    "V1EmptyDirVolumeSource": V1EmptyDirVolumeSource,
    "V1EnvFromSource": V1EnvFromSource,
    "V1EnvVar": V1EnvVar,
    "V1EnvVarSource": V1EnvVarSource,
    "V1EphemeralContainer": V1EphemeralContainer,
    "V1ExecAction": V1ExecAction,
    "V1FCVolumeSource": V1FCVolumeSource,
    "V1FlexVolumeSource": V1FlexVolumeSource,
    "V1FlockerVolumeSource": V1FlockerVolumeSource,
    "V1GCEPersistentDiskVolumeSource": V1GCEPersistentDiskVolumeSource,
    "V1GitRepoVolumeSource": V1GitRepoVolumeSource,
    "V1GlusterfsVolumeSource": V1GlusterfsVolumeSource,
    "V1HTTPGetAction": V1HTTPGetAction,
    "V1HTTPHeader": V1HTTPHeader,
    "V1Handler": V1Handler,
    "V1HostAlias": V1HostAlias,
    "V1HostPathVolumeSource": V1HostPathVolumeSource,
    "V1ISCSIVolumeSource": V1ISCSIVolumeSource,
    "V1KeyToPath": V1KeyToPath,
    "V1LabelSelector": V1LabelSelector,
    "V1LabelSelectorRequirement": V1LabelSelectorRequirement,
    "V1Lifecycle": V1Lifecycle,
    "V1ListMeta": V1ListMeta,
    "V1LocalObjectReference": V1LocalObjectReference,
    "V1ManagedFieldsEntry": V1ManagedFieldsEntry,
    "V1NFSVolumeSource": V1NFSVolumeSource,
    "V1NodeAffinity": V1NodeAffinity,
    "V1NodeSelector": V1NodeSelector,
    "V1NodeSelectorRequirement": V1NodeSelectorRequirement,
    "V1NodeSelectorTerm": V1NodeSelectorTerm,
    "V1ObjectFieldSelector": V1ObjectFieldSelector,
    "V1ObjectMeta": V1ObjectMeta,
    "V1OwnerReference": V1OwnerReference,
    "V1PersistentVolumeClaimVolumeSource": V1PersistentVolumeClaimVolumeSource,
    "V1PhotonPersistentDiskVolumeSource": V1PhotonPersistentDiskVolumeSource,
    "V1Pod": V1Pod,
    "V1PodAffinity": V1PodAffinity,
    "V1PodAffinityTerm": V1PodAffinityTerm,
    "V1PodAntiAffinity": V1PodAntiAffinity,
    "V1PodCondition": V1PodCondition,
    "V1PodDNSConfig": V1PodDNSConfig,
    "V1PodDNSConfigOption": V1PodDNSConfigOption,
    "V1PodIP": V1PodIP,
    "V1PodReadinessGate": V1PodReadinessGate,
    "V1PodSecurityContext": V1PodSecurityContext,
    "V1PodSpec": V1PodSpec,
    "V1PodStatus": V1PodStatus,
    "V1PortworxVolumeSource": V1PortworxVolumeSource,
    "V1PreferredSchedulingTerm": V1PreferredSchedulingTerm,
    "V1Probe": V1Probe,
    "V1ProjectedVolumeSource": V1ProjectedVolumeSource,
    "V1QuobyteVolumeSource": V1QuobyteVolumeSource,
    "V1RBDVolumeSource": V1RBDVolumeSource,
    "V1ResourceFieldSelector": V1ResourceFieldSelector,
    "V1ResourceRequirements": V1ResourceRequirements,
    "V1SELinuxOptions": V1SELinuxOptions,
    "V1ScaleIOVolumeSource": V1ScaleIOVolumeSource,
    "V1SecretEnvSource": V1SecretEnvSource,
    "V1SecretKeySelector": V1SecretKeySelector,
    "V1SecretProjection": V1SecretProjection,
    "V1SecretVolumeSource": V1SecretVolumeSource,
    "V1SecurityContext": V1SecurityContext,
    "V1ServiceAccountTokenProjection": V1ServiceAccountTokenProjection,
    "V1Status": V1Status,
    "V1StatusCause": V1StatusCause,
    "V1StatusDetails": V1StatusDetails,
    "V1StorageOSVolumeSource": V1StorageOSVolumeSource,
    "V1Sysctl": V1Sysctl,
    "V1TCPSocketAction": V1TCPSocketAction,
    "V1Toleration": V1Toleration,
    "V1TopologySpreadConstraint": V1TopologySpreadConstraint,
    "V1Volume": V1Volume,
    "V1VolumeDevice": V1VolumeDevice,
    "V1VolumeMount": V1VolumeMount,
    "V1VolumeProjection": V1VolumeProjection,
    "V1VsphereVirtualDiskVolumeSource": V1VsphereVirtualDiskVolumeSource,
    "V1WeightedPodAffinityTerm": V1WeightedPodAffinityTerm,
    "V1WindowsSecurityContextOptions": V1WindowsSecurityContextOptions,
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
