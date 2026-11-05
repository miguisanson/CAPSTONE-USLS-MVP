# Started hidden by site-start.ps1. Asks Windows not to sleep (the same request a video player
# makes; no power setting is changed) while the site container runs, then exits.
Add-Type -Name Power -Namespace Usls -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);'
# ES_CONTINUOUS | ES_SYSTEM_REQUIRED: the screen may turn off, the PC keeps running
while ((docker inspect -f '{{.State.Running}}' capstone-usls-mvp-app-1 2>$null) -eq 'true') {
    [Usls.Power]::SetThreadExecutionState(0x80000001) | Out-Null
    Start-Sleep 60
}
