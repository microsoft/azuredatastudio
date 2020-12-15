# Offline Migration
[Home](../readme.md)

This chapter is useful for performing an **Offline Migration** of SQL Server 2005 and above to Azure using ADS Notebooks. Offline migrations are by definition disruptive to the flow of data such as in a web application. With these notebooks, a foundation for automated offline migration can be built.

There are [many methods](https://datamigration.microsoft.com/) to consider when migrating to the cloud. The notebooks in this chapter cover the following scenarios:

## Notebooks in this Chapter
- [Migrate SQL Server Instance to Azure SQL VM](instance-to-VM.ipynb)

- [Migrate SQL Server Database to Azure SQL VM](db-to-VM.ipynb)

- [Migrate SQL Server Database to Azure SQL DB](db-to-SQLDB.ipynb)

## Why Migrate Data Offline?
There are many reasons to do an offline data migration. If the cost of losing connectivity for the duration of an offline migration can be minimized, then it often outperforms ensuring uptime when moving to the cloud from on-premise. Consider the time it takes to develop and test the deployment process, the infrastructure required to switch networking routing dynamically, and the cost of managing a migration team with the appropriate skills required for an online migration. 

## Recommendations for a Successful Migration
- Use the [Assessments](..\Assessments/readme.md) notebooks and fix all recommendations prior to migration to avoid potential problems during and after migration
- Always keep backups of the data in standard formats available to be redeployed in case of a problem
- Automate the migration in such a way that anyone can perform it, given access
- Consider creating a new notebook that contains simple data tests with known values on the new system to prove that the migration occurred (smoke tests)