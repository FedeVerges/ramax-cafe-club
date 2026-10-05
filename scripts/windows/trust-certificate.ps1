#Requires -RunAsAdministrator
param([Parameter(Mandatory=$true)][string]$CertificateFile)
$ErrorActionPreference = "Stop"
Import-Certificate -FilePath $CertificateFile -CertStoreLocation "Cert:\LocalMachine\Root" | Out-Null
Write-Output "Certificado instalado. Usá el nombre de host incluido en el certificado."
