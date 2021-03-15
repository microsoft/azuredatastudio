# Welcome to the Azure SQL Hybrid Toolkit

## About

The **Azure SQL Hybrid Toolkit** is a [Jupyter Book](https://jupyterbook.org/intro.html) extension of [Azure Data Studio](https://docs.microsoft.com/en-us/sql/azure-data-studio/download-azure-data-studio) (ADS) designed to help [Azure SQL Database](https://azure.microsoft.com/en-us/services/sql-database/) and ADS users deploy, migrate and configure for a hybrid cloud environment. The toolkit was designed with and intended to be executed within ADS. This is to ensure the best possible user experience for those without vast knowledge of Azure services while adhering closely to the software _best practices_ standards required by experienced cloud users.

## Chapters
* [Prerequisites and Initial Setup](prereqs.ipynb) - Notebook installation of required modules.

* [Assessments](Assessments/readme.md) - Notebooks that contain examples to determine whether a given database or SQL Server instance is ready to migrate by utilizing SQL Assessments. SQL instances are scanned based on a "best practices" set of rules.

* [Networking](networking/readme.md) - Setup secure Point-to-Site (P2S) or Site-to-Site (S2S) network connectivity to Microsoft Azure using a Virtual Private Network (VPN). This notebook serves as a building block for other notebooks as communicating securely between on-premise and Azure is essential for many tasks.

* [Provisioning](provisioning/readme.md) - Creating and communicating with SQL Resources in Microsoft Azure. Includes common tasks such as creating SQL Virtual Machines or SQL Managed Instances in the cloud.

* [Data Portability](data-portability/readme.md) - Install a custom Azure function to facilitate importing and exporting cloud resources. The solution uses parallel tasks in Azure Batch to perform data storage work. Azure Batch is a process that runs large-scale parallel and high-performance computing jobs efficiently in Azure.

* [High Availability and Disaster Recovery](hadr/readme.md) - Notebooks to leverage Azure SQL for business continuity in a hybrid cloud environment.

* [Offline Migration](offline-migration/readme.md) - Notebooks to manage SQL migration tasks to the cloud

* [Glossary](glossary.md) - set of defined terms.

* [Appendices](Appendices.ipynb) - misc info.

## Goals and Methodology
The toolkit better positions a customer with regards to planning, migrating, and thriving in a hybrid cloud environment by:

* Providing SQL Azure users with reliable free software and content that is well-written and executable
* Greatly simplifying the integration of Azure Data services into an existing environment
* Positioning Azure to be the natural cloud services choice with a low-friction experience
* Notebooks are executable by a normal user (unless otherwise specificed) on minimal hardware
* Most notebooks require some configuration. If so, the proper configurations should be clearly located towards the top of the notebook or cell, whichever is most appropriate
* By design, Notebooks are written to be executed from top-to-bottom. Therefore, each notebook has a specific task to perform and should focus only on that task. It may contain several cells to execute but it will adhere to the one-task per notebook paradigm

**NOTE:** Executing notebooks could potentially create new Azure Resources which may incur charges to the Azure Subscription. Make sure the repercussions of executing any cells are understood.

## General Guidelines
1. Read notebooks carefully to understand their use
2. Execute the Prerequisites and Initial Setup notebook once per setup
3. Configure individual notebooks by modifying the cells tagged as "Parameters" 
4. Execute notebook from top-to-bottom to complete a task
5. Save the executed notebook as a different notebook, if desired

The resulting output is displayed as text underneath each cell when executed. The notebook can be shared or archived easily. Furthermore, the toolkit's tasks are building blocks for a more advanced automation framework. Hopefully, this toolkit will enable greater understanding for the Azure SQL Hybrid user, especially when it comes to automation.