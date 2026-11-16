<#
.SYNOPSIS
  Inicializa a organizacao HGeSM, unidades e contas Firebase para a Cozinha Dietetica.
.DESCRIPTION
  Executar uma vez no computador de um administrador do projeto.
  Usa Google OAuth do gcloud, Firebase Auth e Firestore REST, sem credenciais de
  service account em arquivo. Senhas sao solicitadas localmente e jamais
  gravadas, exibidas nem inseridas no GitHub. Registros existentes sao preservados.
  Nao altera o EMPROVEX, o Cloud Run QA ou dados clinicos existentes.
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[^@\s]+@[^@\s]+\.[^@\s]+$')][string]$AdminEmail
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$project='cozinha-dietetica'
$hospital='hgesm'
$ug='160416'
$web=Join-Path (Resolve-Path (Join-Path $PSScriptRoot '..')).Path 'apps\hospital-web'
$envFile=Join-Path $web '.env.local'
if(-not(Test-Path -LiteralPath $envFile)){throw 'Configure o Firebase Web antes: hospital-f0-configure-web.ps1.'}
$config=Get-Content -LiteralPath $envFile -Raw -Encoding UTF8
$m=[regex]::Match($config,'(?m)^VITE_HOSPITAL_FIREBASE_API_KEY=(\S+)\s*$')
if(-not $m.Success){throw 'API key publica do Firebase Web ausente no .env.local.'}
$apiKey=$m.Groups[1].Value
$token=(& gcloud.cmd auth print-access-token)
if($LASTEXITCODE -ne 0 -or -not $token){throw 'Nao foi possivel autenticar no Google Cloud.'}
$headers=@{Authorization='Bearer '+($token | Out-String).Trim()}
$authLookup='https://identitytoolkit.googleapis.com/v1/projects/'+$project+'/accounts:lookup'
$authCreate='https://identitytoolkit.googleapis.com/v1/projects/'+$project+'/accounts?key='+[uri]::EscapeDataString($apiKey)
$fsRoot='https://firestore.googleapis.com/v1/projects/'+$project+'/databases/(default)/documents'
$writes=New-Object 'System.Collections.Generic.List[object]'
$existingPaths=New-Object 'System.Collections.Generic.List[string]'

function Invoke-JsonPost([string]$url,[object]$obj) {
  $json=ConvertTo-Json -InputObject $obj -Depth 30 -Compress
  try {
    return Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json)) -ErrorAction Stop
  } finally { $json=$null }
}
function Find-AuthUser([string]$email) {
  $result=Invoke-JsonPost $authLookup @{email=@($email)}
  $property=$result.PSObject.Properties['users']
  if($null -eq $property){return $null}
  $users=@($property.Value)
  $found=@($users | Where-Object {$null -ne $_ -and $_.email -eq $email})
  if($found.Count -eq 0){return $null}
  return $found[0]
}
function Get-FirestoreDocument([string]$path) {
  try {
    return Invoke-RestMethod -Uri ($fsRoot+'/'+$path) -Headers $headers -Method Get -ErrorAction Stop
  }catch{
    if($null -ne $_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 404){return $null}
    throw
  }
}
function Queue-FirestoreDocument([string]$path,[object]$value,[string]$kind='') {
  $prior=Get-FirestoreDocument $path
  if($null -ne $prior){
    $stored=$null
    try {$stored=$prior.fields.json.stringValue | ConvertFrom-Json}catch{throw "Registro existente com estrutura inesperada: $path"}
    $orgProp=$stored.PSObject.Properties['organizationId']
    if($null -ne $orgProp -and $orgProp.Value -ne $hospital){throw "Organizacao divergente: $path"}
    $activeProp=$stored.PSObject.Properties['active']
    if($null -ne $activeProp -and $activeProp.Value -eq $false){throw "Registro existente desativado: $path"}
    if($path -like '*/memberships/*' -and $stored.uid -ne $value.uid){throw "UID divergente: $path"}
    if($path -like '*/memberships/*'){
      $rolesOld=@($stored.roles) | Sort-Object
      $rolesNew=@($value.roles) | Sort-Object
      $unitsOld=@($stored.unitIds) | Sort-Object
      $unitsNew=@($value.unitIds) | Sort-Object
      if(($rolesOld -join ',') -ne ($rolesNew -join ',') -or ($unitsOld -join ',') -ne ($unitsNew -join ',')){
        throw "Vinculo existente difere do perfil solicitado: $path. Atualize pela administracao, sem sobrescrever."
      }
    }
    if($path -like '*/unitsDirectory/*' -and
        ($stored.code -ne $value.code -or $stored.type -ne $value.type)){
      throw "Unidade existente com definicao divergente: $path"
    }
    $existingPaths.Add($path)
    return
  }
  $fields=@{json=@{stringValue=(ConvertTo-Json -InputObject $value -Depth 30 -Compress)}}
  if($kind){$fields.kind=@{stringValue=$kind}}
  $writes.Add(@{
    update=@{name=('projects/'+$project+'/databases/(default)/documents/'+$path);fields=$fields}
    currentDocument=@{exists=$false}
  })
}

$units=@(
  @{id='upi';code='UPI';name='Unidade de Pacientes Internados';type='CARE'}
  @{id='uti';code='UTI';name='Unidade de Terapia Intensiva';type='CARE'}
  @{id='pam';code='PAM';name='Pronto Atendimento Medico';type='CARE'}
  @{id='onco';code='ONCO';name='Oncologia';type='CARE'}
  @{id='bloco';code='BLOCO';name='Bloco Cirurgico';type='CARE'}
  @{id='copa';code='COPA';name='Cozinha Dietetica';type='KITCHEN'}
  @{id='nutricao';code='NUTR';name='Nutricao';type='NUTRITION'}
)
$clinical=@('upi','uti','pam','onco','bloco')
$allUnits=@('upi','uti','pam','onco','bloco','copa','nutricao')
$functional=@(
  @{prefix='upi';unitId='upi';name='Unidade UPI';roles=@('UNIT');units=@('upi')}
  @{prefix='uti';unitId='uti';name='Unidade UTI';roles=@('UNIT');units=@('uti')}
  @{prefix='pam';unitId='pam';name='Unidade PAM';roles=@('UNIT');units=@('pam')}
  @{prefix='onco';unitId='onco';name='Oncologia';roles=@('UNIT');units=@('onco')}
  @{prefix='bloco';unitId='bloco';name='Bloco Cirurgico';roles=@('UNIT');units=@('bloco')}
  @{prefix='copa';unitId='copa';name='Cozinha Dietetica';roles=@('KITCHEN');units=@('upi','uti','pam','onco','bloco','copa')}
)
$users=@(@{email=$AdminEmail.Trim().ToLowerInvariant();name='Administrador HGeSM';
  roles=@('HOSPITAL_ADMIN','UNIT','KITCHEN','NUTRITION');units=$allUnits})
foreach($entry in $functional){
  $users+=@{email=('funcional'+$entry.prefix+'@hgesm.eb.mil.br');
    name=$entry.name;roles=$entry.roles;units=$entry.units}
}

Write-Host 'Projeto Firebase: cozinha-dietetica | Organizacao: hgesm | UG: 160416' -ForegroundColor Cyan
Write-Host 'Contas existentes serao preservadas. Senhas de novos usuarios serao digitadas sem eco no terminal.'
Write-Warning 'Senhas compartilhadas/fracas servem somente para acesso inicial de teste. Troque-as antes de utilizar dados reais.'
$accounts=@()
foreach($user in $users){
  $account=Find-AuthUser $user.email
  if($null -eq $account){
    Write-Host ('Criar conta: '+$user.email) -ForegroundColor Cyan
    $secure=Read-Host ('Senha inicial para '+$user.email) -AsSecureString
    $ptr=[IntPtr]::Zero
    $password=$null
    try{
      $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
      $password=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
      if($password.Length -lt 6){throw 'O Firebase exige pelo menos 6 caracteres de senha.'}
      $body=@{email=$user.email;password=$password;displayName=$user.name}
      $account=Invoke-JsonPost $authCreate $body
      if(-not $account.localId){throw ('Firebase nao retornou UID para '+$user.email)}
      Write-Host ('PASS: nova conta '+$user.email) -ForegroundColor Green
    } finally {
      $password=$null;$body=$null
      if($ptr -ne [IntPtr]::Zero){[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}
      $secure.Dispose()
    }
  }else{
    Write-Host ('JA EXISTE: '+$user.email+' (senha preservada)') -ForegroundColor Yellow
  }
  if(-not $account.localId){throw ('UID Firebase ausente para '+$user.email)}
  $accounts+=@{uid=[string]$account.localId;email=$user.email;roles=@($user.roles);units=@($user.units)}
}

# Firestore usa campos json StringValue, exatamente como o HospitalFirestoreStore.
Queue-FirestoreDocument ('organizations/'+$hospital+'/config/meta') @{
  id=$hospital;name='Hospital Geral de Santa Maria';ug=$ug;active=$true
}
foreach($unit in $units){
  $id=$unit.id
  $doc=@{id=$id;organizationId=$hospital;unitId=$id;code=$unit.code;
    name=$unit.name;type=$unit.type;active=$true;revision=1}
  Queue-FirestoreDocument ('organizations/'+$hospital+'/units/'+$id+'/records/unit__'+$id) $doc 'unit'
  Queue-FirestoreDocument ('organizations/'+$hospital+'/recordPointers/unit__'+$id) @{
    unitId=$id;revision=1
  }
  Queue-FirestoreDocument ('organizations/'+$hospital+'/unitsDirectory/'+$id) $doc
}
foreach($account in $accounts){
  $uid=$account.uid
  $membership=@{id=('member_'+[guid]::NewGuid().ToString('N'));uid=$uid;
    organizationId=$hospital;ug=$ug;active=$true;revision=1;
    roles=$account.roles;unitIds=$account.units}
  Queue-FirestoreDocument ('organizations/'+$hospital+'/memberships/'+$uid) $membership
}
if($writes.Count -gt 0){
  Write-Host ('Gravando '+$writes.Count+' documentos novos na organizacao hospitalar...') -ForegroundColor Cyan
  $null=Invoke-JsonPost ('https://firestore.googleapis.com/v1/projects/'+$project+'/databases/(default)/documents:commit') @{
    writes=@($writes.ToArray())
  }
}
Write-Host ('PASS: perfis e unidades configurados. Novos registros: '+$writes.Count) -ForegroundColor Green

# Predefinir hospital evita uma tela de codigo no login.
if($config -match '(?m)^VITE_HOSPITAL_ORGANIZATION_ID='){
  $config=[regex]::Replace($config,'(?m)^VITE_HOSPITAL_ORGANIZATION_ID=.*$','VITE_HOSPITAL_ORGANIZATION_ID='+$hospital)
}else{
  $config=$config.TrimEnd()+"`nVITE_HOSPITAL_ORGANIZATION_ID=$hospital`n"
}
[IO.File]::WriteAllText($envFile,$config,[Text.UTF8Encoding]::new($false))
Write-Host 'PASS: hospital predefinido no frontend: hgesm' -ForegroundColor Green
Write-Host 'PROXIMO: publicar o frontend atualizado; depois testar o login.' -ForegroundColor Cyan
Write-Host 'Nao utilize dados reais de pacientes antes dos testes de permissao e fluxo clinico.' -ForegroundColor Yellow
