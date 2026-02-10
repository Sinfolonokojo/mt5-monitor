@echo off
REM Helper script to run Ansible commands from Windows
REM Usage: ansible.bat <playbook> [--limit vpsX]
REM Example: ansible.bat status
REM Example: ansible.bat deploy --limit vps2

if "%1"=="" (
    echo Usage: ansible.bat ^<playbook^> [ansible options]
    echo.
    echo Available playbooks:
    echo   status    - Check agent status on all VPS
    echo   validate  - Validate VPS environment
    echo   deploy    - Deploy code updates
    echo   start     - Start agents
    echo   stop      - Stop agents
    echo   rollback  - Rollback to previous version
    echo.
    echo Options:
    echo   --limit vps2    - Run only on vps2
    echo   --limit stage1  - Run only on stage1 group
    exit /b 1
)

wsl -e bash -c "source ~/ansible-env/bin/activate && cd /mnt/c/Users/Admin/Projects/Programar_Dia/ansible && ansible-playbook playbooks/%1.yml -i inventory/hosts.yml %2 %3 %4 %5"
