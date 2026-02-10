#!/bin/bash
# Helper script to run Ansible commands from WSL
# Usage from Windows: wsl -e ./ansible/run.sh <playbook> [--limit vpsX]
# Example: wsl -e ./ansible/run.sh status
# Example: wsl -e ./ansible/run.sh deploy --limit vps2

source ~/ansible-env/bin/activate
cd /mnt/c/Users/Admin/Projects/Programar_Dia/ansible

PLAYBOOK=$1
shift

if [ -z "$PLAYBOOK" ]; then
    echo "Usage: ./run.sh <playbook> [ansible options]"
    echo ""
    echo "Available playbooks:"
    echo "  status    - Check agent status on all VPS"
    echo "  validate  - Validate VPS environment"
    echo "  deploy    - Deploy code updates"
    echo "  start     - Start agents"
    echo "  stop      - Stop agents"
    echo "  rollback  - Rollback to previous version"
    echo ""
    echo "Options:"
    echo "  --limit vps2    - Run only on vps2"
    echo "  --limit stage1  - Run only on stage1 group"
    exit 1
fi

ansible-playbook "playbooks/${PLAYBOOK}.yml" -i inventory/hosts.yml "$@"
