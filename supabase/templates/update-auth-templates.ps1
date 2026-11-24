param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z0-9]{20}$')]
  [string]$ProjectRef
)

$ErrorActionPreference = 'Stop'
$templateDirectory = $PSScriptRoot
$secureToken = Read-Host 'Supabase personal access token (input is hidden)' -AsSecureString
$tokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)

try {
  $accessToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($tokenPointer)
  $templateFiles = @{
    confirmation = 'confirmation.html'
    invite = 'invite.html'
    recovery = 'recovery.html'
    magic_link = 'magic-link.html'
    email_change = 'email-change.html'
    reauthentication = 'reauthentication.html'
  }
  $templateSubjects = @{
    confirmation = 'Confirm your Bedrock account'
    invite = 'Your Bedrock staff invitation'
    recovery = 'Reset your Bedrock password'
    magic_link = 'Your secure Bedrock sign-in link'
    email_change = 'Confirm your new Bedrock email'
    reauthentication = '{{ .Token }} is your Bedrock verification code'
  }

  $payload = @{}
  foreach ($name in $templateFiles.Keys) {
    $html = Get-Content -LiteralPath (Join-Path $templateDirectory $templateFiles[$name]) -Raw
    $payload["mailer_subjects_$name"] = $templateSubjects[$name]
    $payload["mailer_templates_${name}_content"] = $html
  }

  $notificationFile = Join-Path $templateDirectory 'security-notification.html'
  $notificationHtml = Get-Content -LiteralPath $notificationFile -Raw
  $notificationNames = @{
    password_changed_notification = 'Your Bedrock password was changed'
    email_changed_notification = 'Your Bedrock email address was changed'
    phone_changed_notification = 'Your Bedrock phone number was changed'
    mfa_factor_enrolled_notification = 'A Bedrock verification method was added'
    mfa_factor_unenrolled_notification = 'A Bedrock verification method was removed'
    identity_linked_notification = 'A sign-in method was linked to Bedrock'
    identity_unlinked_notification = 'A sign-in method was removed from Bedrock'
  }

  foreach ($name in $notificationNames.Keys) {
    $payload["mailer_subjects_$name"] = $notificationNames[$name]
    $payload["mailer_templates_${name}_content"] = $notificationHtml
  }

  $body = $payload | ConvertTo-Json -Depth 5
  $uri = "https://api.supabase.com/v1/projects/$ProjectRef/config/auth"
  Invoke-RestMethod -Method Patch -Uri $uri `
    -Headers @{ Authorization = "Bearer $accessToken" } `
    -ContentType 'application/json' `
    -Body $body | Out-Null

  Write-Output 'Bedrock Auth email templates updated.'
}
finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($tokenPointer)
  $accessToken = $null
}
