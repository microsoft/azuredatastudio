/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';

const localize = nls.loadMessageBundle();

export const WizardTitle = localize('bdc-create.wizardTitle', 'Create a 2019 Big Data cluster');
export const GenerateScriptsButtonText = localize('bdc-create.generateScriptsButtonText', 'Generate Scripts');
export const CreateClusterButtonText = localize('bdc-create.createClusterButtonText', 'Create');

//#region cluster profile page strings

export const ClusterProfilePageTitle: string = localize('bdc-create.clusterProfilePageTitle', 'Select a cluster profile');
export const ClusterProfilePageDescription: string = localize('bdc-create.clusterProfilePageDescription', 'Select your requirement and we will provide you a pre-defined default scaling. You can later go to cluster configuration and customize it.');

//#endregion

//#region settings page strings

export const SettingsPageTitle: string = localize('bdc-create.settingsPageTitle', 'Settings');
export const SettingsPageDescription: string = localize('bdc-create.settingsPageDescription', 'Configure the settings required for deploying SQL Server big data cluster');

//#endregion

//#region summary page strings

export const SummaryPageTitle: string = localize('bdc-create.summaryPageTitle', 'Summary');
export const SummaryPageDescription: string = '';

//#endregion

//#region target cluster page strings

export const SelectTargetClusterPageTitle: string = localize('bdc-create.selectTargetClusterPageTitle', 'Where do you want to deploy this SQL Server big data cluster?');
export const SelectTargetClusterPageDescription: string = localize('bdc-create.selectTargetClusterPageDescription', 'Select an existing Kubernetes cluster or choose a cluster type you want to deploy');

export const ExistingClusterOptionText: string = localize('bdc-create.existingK8sCluster', 'Existing Kubernetes cluster');
export const CreateLocalClusterOptionText: string = localize('bdc-create.createLocalCluster', 'Create new local cluster');
export const CreateNewAKSClusterOptionText: string = localize('bdc-create.createAksCluster', 'Create new Azure Kubernetes Service cluster');
export const ExistingClusterSectionDescription: string = localize('bdc-create.existingClusterSectionDescription', 'Select the cluster context you want to install the SQL Server Big Data cluster');
export const KubeConfigFileLabelText: string = localize('bdc-create.kubeConfigFileLabelText', 'KubeConfig File');
export const BrowseText: string = localize('bdc-browseText', 'Browse');
export const ClusterContextsLabelText: string = localize('bdc-clusterContextsLabelText', 'Cluster Contexts');
export const ErrorLoadingClustersFromConfigText: string = localize('bdc-errorLoadingClustersText', 'No cluster information is found in the config file or an error ocurred while loading the config file');
export const SelectKubeConfigFileText: string = localize('bdc-selectKubeConfigFileText', 'Select');

//#endregion
