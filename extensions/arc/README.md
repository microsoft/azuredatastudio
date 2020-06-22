# Microsoft Azure Arc Extension for Azure Data Studio

Welcome to Microsoft Azure Arc Extension for Azure Data Studio!

**This extension is only applicable to customers in the Azure Arc data services private preview.**

## Overview

This extension adds the following features to Azure Data Studio.

### Deployment Wizards

A gui-based experience to deploy an Azure Arc data controller as well as resources on an existing Azure Arc data controller. Current list of supported resources:
* SQL Managed Instance
* PostgreSQL server groups

### Management Dashboards

After connecting to an existing Azure Arc data controller in the *Azure Arc Controllers* view of the *Connections* viewlet a list of the active resources registered to the controller is shown, which allow launching a dashboard for further management capabilities.

## Usage Guide

### Deployment Wizards

* After installing this extension click on '...' to the right of the Connections section in the left Panel and click on 'New Deployment...'.
* This opens a dialog box that shows several deployment tiles. This extension adds tiles for the supported resources listed above.
* Click on that tile, accept any license agreements, and choose the appropriate 'Resource Type' to install
* A required tools check will run, if any required tools are missing then instructions will be given for installing those tools
* Once the check has passed successfully then click the *Select* button
* This opens up a new dialog where you can enter input parameters specific to the deployment selected and then open a notebook that does the actual deployment.
*
## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Privacy Statement

The [Microsoft Enterprise and Developer Privacy Statement](https://privacy.microsoft.com/en-us/privacystatement) describes the privacy statement of this software.

## License

Copyright (c) Microsoft Corporation. All rights reserved.

Licensed under the [Source EULA](https://raw.githubusercontent.com/Microsoft/azuredatastudio/main/LICENSE.txt).
