# Ansible Deployment Automation Plan

## Overview

Automate deployment to 23 Windows VPS servers using Ansible.

**Current state:** 5+ hours manual RDP
**Target state:** 5-10 minutes with one command

---

## Prerequisites

### On Your Local Machine (Control Node)

```bash
# Linux/Mac
pip install ansible pywinrm

# Windows (use WSL)
wsl --install
# Then in WSL:
pip install ansible pywinrm
```

### On Each Windows VPS (Managed Nodes)

WinRM must be enabled (usually already enabled on Windows Server):

```powershell
# Run this once on each VPS (or include in Ansible bootstrap)
Enable-PSRemoting -Force
winrm quickconfig -q
winrm set winrm/config/service/auth '@{Basic="true"}'
winrm set winrm/config/service '@{AllowUnencrypted="true"}'
```

---

## Directory Structure

```
mt5-monitor/
├── ansible/
│   ├── inventory/
│   │   └── hosts.yml              # All 23 VPS defined here
│   ├── group_vars/
│   │   └── all.yml                # Shared variables
│   ├── host_vars/
│   │   ├── vps2.yml               # VPS2-specific config (agents.json content)
│   │   ├── vps3.yml               # VPS3-specific config
│   │   ├── vps4.yml               # ...
│   │   └── vps23.yml
│   ├── playbooks/
│   │   ├── validate.yml           # Pre-deployment checks
│   │   ├── setup-fresh.yml        # Full setup from scratch
│   │   ├── deploy.yml             # Code update only
│   │   ├── rollback.yml           # Revert to backup
│   │   ├── start.yml              # Start agents
│   │   ├── stop.yml               # Stop agents
│   │   └── status.yml             # Check status
│   ├── templates/
│   │   └── agents.json.j2         # Template for agents.json
│   └── ansible.cfg                # Ansible configuration
└── vps-agent/                     # Existing agent code
```

---

## File 1: ansible/ansible.cfg

```ini
[defaults]
inventory = inventory/hosts.yml
host_key_checking = False
timeout = 30
forks = 10

[privilege_escalation]
become = False
```

---

## File 2: ansible/inventory/hosts.yml

```yaml
all:
  vars:
    ansible_user: administrator
    ansible_password: "20Coberturas25"
    ansible_connection: winrm
    ansible_winrm_server_cert_validation: ignore
    ansible_winrm_transport: basic
    ansible_port: 5985

  children:
    # Staged deployment groups
    stage1:
      hosts:
        vps2:
          ansible_host: 155.133.26.68

    stage2:
      hosts:
        vps3:
          ansible_host: 89.116.26.238
        vps4:
          ansible_host: 75.119.135.121

    stage3:
      hosts:
        vps5:
          ansible_host: 178.18.247.182
        vps6:
          ansible_host: 38.242.245.51
        vps7:
          ansible_host: 158.220.105.27
        vps8:
          ansible_host: 84.247.142.140
        vps9:
          ansible_host: 109.199.97.31
        vps10:
          ansible_host: 109.199.97.222

    # Add remaining VPS11-VPS23 here following same pattern
    # stage4:
    #   hosts:
    #     vps11:
    #       ansible_host: x.x.x.x
    #     ...

    # Convenience group for all VPS
    all_vps:
      children:
        stage1:
        stage2:
        stage3:
        # stage4:
```

---

## File 3: ansible/group_vars/all.yml

```yaml
# Shared variables for all VPS
vps_agent_path: 'C:\Users\Administrator\Desktop\vps-agent'
backup_path: 'C:\Users\Administrator\Desktop\backups'
python_installer_url: "https://www.python.org/ftp/python/3.11.0/python-3.11.0-amd64.exe"

# MT5 Terminal paths (shared across all VPS)
mt5_terminals:
  fundednext: 'C:\Program Files\FundedNext MT5 Terminal\terminal64.exe'
  fivepercent: 'C:\Program Files\Five Percent Online MetaTrader 5\terminal64.exe'
  ftmo: 'C:\Program Files\FTMO Global Markets MT5 Terminal\terminal64.exe'

# Ports used by agents
agent_ports:
  - 8000
  - 8001
  - 8002
```

---

## File 4: ansible/host_vars/vps2.yml (Example - Create one per VPS)

```yaml
# VPS2 specific configuration
vps_name: VPS2
account_holder: "Leandro Forero"

# Agents configuration (becomes agents.json)
agents:
  - name: "VPS2-FundedNext"
    port: 8000
    terminal_path: "{{ mt5_terminals.fundednext }}"
    display_name: "FN Account 123456"
    account_holder: "{{ account_holder }}"
    prop_firm: "FN"
    initial_balance: 100000.0

  - name: "VPS2-FivePercent"
    port: 8001
    terminal_path: "{{ mt5_terminals.fivepercent }}"
    display_name: "T5 Account 789012"
    account_holder: "{{ account_holder }}"
    prop_firm: "T5"
    initial_balance: 100000.0

  - name: "VPS2-FTMO"
    port: 8002
    terminal_path: "{{ mt5_terminals.ftmo }}"
    display_name: "FTMO Account 345678"
    account_holder: "{{ account_holder }}"
    prop_firm: "FTMO"
    initial_balance: 100000.0
```

---

## File 5: ansible/templates/agents.json.j2

```jinja2
{
  "agents": [
{% for agent in agents %}
    {
      "name": "{{ agent.name }}",
      "port": {{ agent.port }},
      "terminal_path": "{{ agent.terminal_path }}",
      "display_name": "{{ agent.display_name }}",
      "account_holder": "{{ agent.account_holder }}",
      "prop_firm": "{{ agent.prop_firm }}",
      "initial_balance": {{ agent.initial_balance }}
    }{% if not loop.last %},{% endif %}

{% endfor %}
  ]
}
```

---

## File 6: ansible/playbooks/validate.yml

```yaml
---
# Validate VPS is ready for deployment
# Usage: ansible-playbook playbooks/validate.yml
# Usage: ansible-playbook playbooks/validate.yml --limit vps2

- name: Validate VPS Environment
  hosts: all_vps
  gather_facts: no
  tasks:
    - name: Test WinRM connection
      win_ping:
      register: ping_result

    - name: Check Python installed
      win_command: python --version
      register: python_check
      ignore_errors: yes

    - name: Check pip installed
      win_command: pip --version
      register: pip_check
      ignore_errors: yes

    - name: Check vps-agent directory exists
      win_stat:
        path: "{{ vps_agent_path }}"
      register: agent_dir

    - name: Check agents.json exists
      win_stat:
        path: "{{ vps_agent_path }}\\agents.json"
      register: agents_json

    - name: Check MT5 terminal paths exist
      win_stat:
        path: "{{ item.terminal_path }}"
      loop: "{{ agents }}"
      register: terminal_checks
      when: agents is defined

    - name: Check ports are available
      win_shell: |
        $port = {{ item }}
        $connection = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
        if ($connection) { exit 1 } else { exit 0 }
      loop: "{{ agent_ports }}"
      register: port_checks
      ignore_errors: yes

    - name: Generate validation report
      debug:
        msg: |
          ═══════════════════════════════════════════════════
           {{ inventory_hostname | upper }} VALIDATION REPORT
          ═══════════════════════════════════════════════════
           Connection:    {{ '✅ OK' if ping_result.ping == 'pong' else '❌ FAILED' }}
           Python:        {{ '✅ ' + python_check.stdout | trim if python_check.rc == 0 else '❌ NOT INSTALLED' }}
           Pip:           {{ '✅ OK' if pip_check.rc == 0 else '❌ NOT INSTALLED' }}
           Agent Dir:     {{ '✅ EXISTS' if agent_dir.stat.exists else '⚠️ MISSING (will create)' }}
           agents.json:   {{ '✅ EXISTS' if agents_json.stat.exists else '⚠️ MISSING (will create)' }}

           MT5 Terminals:
          {% for check in terminal_checks.results %}
             {{ check.item.name }}: {{ '✅' if check.stat.exists else '❌ MISSING' }}
          {% endfor %}

           Ports:
          {% for check in port_checks.results %}
             Port {{ check.item }}: {{ '✅ FREE' if check.rc == 0 else '⚠️ IN USE' }}
          {% endfor %}
          ═══════════════════════════════════════════════════
```

---

## File 7: ansible/playbooks/setup-fresh.yml

```yaml
---
# Full VPS setup from scratch
# Usage: ansible-playbook playbooks/setup-fresh.yml --limit vps2

- name: Setup VPS Agent from Scratch
  hosts: all_vps
  gather_facts: yes
  vars:
    timestamp: "{{ ansible_date_time.iso8601_basic_short }}"

  tasks:
    # ========== PYTHON INSTALLATION ==========
    - name: Check if Python is installed
      win_command: python --version
      register: python_check
      ignore_errors: yes

    - name: Download Python installer
      win_get_url:
        url: "{{ python_installer_url }}"
        dest: 'C:\Temp\python-installer.exe'
      when: python_check.rc != 0

    - name: Install Python
      win_package:
        path: 'C:\Temp\python-installer.exe'
        arguments: /quiet InstallAllUsers=1 PrependPath=1 Include_pip=1
        state: present
      when: python_check.rc != 0

    - name: Verify Python installation
      win_command: python --version
      register: python_version

    - name: Display Python version
      debug:
        msg: "Python: {{ python_version.stdout }}"

    # ========== DIRECTORY SETUP ==========
    - name: Create vps-agent directory
      win_file:
        path: "{{ vps_agent_path }}"
        state: directory

    - name: Create logs directory
      win_file:
        path: "{{ vps_agent_path }}\\logs"
        state: directory

    - name: Create backup directory
      win_file:
        path: "{{ backup_path }}"
        state: directory

    # ========== COPY APPLICATION FILES ==========
    - name: Copy vps-agent application code
      win_copy:
        src: ../../vps-agent/
        dest: "{{ vps_agent_path }}\\"
      register: copy_result

    # ========== GENERATE agents.json ==========
    - name: Generate agents.json from template
      win_template:
        src: ../templates/agents.json.j2
        dest: "{{ vps_agent_path }}\\agents.json"

    # ========== INSTALL DEPENDENCIES ==========
    - name: Install Python requirements
      win_command: pip install -r requirements.txt
      args:
        chdir: "{{ vps_agent_path }}"
      register: pip_install

    - name: Show pip install result
      debug:
        msg: "{{ pip_install.stdout_lines | last }}"

    # ========== FIREWALL CONFIGURATION ==========
    - name: Configure firewall for agent ports
      win_firewall_rule:
        name: "MT5 Agent Port {{ item }}"
        localport: "{{ item }}"
        protocol: tcp
        direction: in
        action: allow
        state: present
        enabled: yes
      loop: "{{ agent_ports }}"

    # ========== SCHEDULED TASK FOR AUTO-START ==========
    - name: Create auto-start scheduled task
      win_scheduled_task:
        name: MT5AgentLauncher
        description: "Start MT5 VPS Agent on system boot"
        actions:
          - path: python.exe
            arguments: "{{ vps_agent_path }}\\launcher.py"
            working_directory: "{{ vps_agent_path }}"
        triggers:
          - type: boot
            delay: PT30S
        username: Administrator
        password: "{{ ansible_password }}"
        run_level: highest
        state: present
        enabled: yes

    # ========== START AGENT ==========
    - name: Start the agent launcher
      win_shell: |
        Start-Process python -ArgumentList "launcher.py" -WorkingDirectory "{{ vps_agent_path }}" -WindowStyle Hidden
      async: 10
      poll: 0

    - name: Wait for agents to start
      pause:
        seconds: 10

    # ========== VERIFY DEPLOYMENT ==========
    - name: Check agent health
      win_uri:
        url: "http://localhost:{{ item }}/health"
        method: GET
        status_code: 200
      loop: "{{ agent_ports }}"
      register: health_checks
      ignore_errors: yes

    - name: Deployment summary
      debug:
        msg: |
          ═══════════════════════════════════════════════════
           {{ inventory_hostname | upper }} SETUP COMPLETE
          ═══════════════════════════════════════════════════
           Python:     {{ python_version.stdout | trim }}
           Directory:  {{ vps_agent_path }}
           Config:     agents.json generated
           Firewall:   Ports {{ agent_ports | join(', ') }} opened
           Auto-start: Scheduled task created

           Agent Status:
          {% for check in health_checks.results %}
             Port {{ check.item }}: {{ '✅ RUNNING' if check.status == 200 else '❌ NOT RESPONDING' }}
          {% endfor %}
          ═══════════════════════════════════════════════════
```

---

## File 8: ansible/playbooks/deploy.yml

```yaml
---
# Deploy code updates to VPS agents
# Usage: ansible-playbook playbooks/deploy.yml
# Usage: ansible-playbook playbooks/deploy.yml --limit stage1
# Usage: ansible-playbook playbooks/deploy.yml --limit vps2

- name: Deploy VPS Agent Updates
  hosts: all_vps
  gather_facts: yes
  vars:
    timestamp: "{{ ansible_date_time.iso8601_basic_short }}"

  tasks:
    # ========== PRE-FLIGHT VALIDATION ==========
    - name: Check MT5 terminal paths exist
      win_stat:
        path: "{{ item.terminal_path }}"
      loop: "{{ agents }}"
      register: terminal_checks

    - name: Fail if any MT5 terminal missing
      fail:
        msg: "MT5 terminal missing: {{ item.item.terminal_path }}"
      when: not item.stat.exists
      loop: "{{ terminal_checks.results }}"

    # ========== BACKUP CURRENT VERSION ==========
    - name: Create backup of current deployment
      win_copy:
        src: "{{ vps_agent_path }}\\"
        dest: "{{ backup_path }}\\backup-{{ timestamp }}\\"
        remote_src: yes
      ignore_errors: yes

    # ========== STOP CURRENT AGENTS ==========
    - name: Stop running Python processes
      win_shell: |
        Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
      ignore_errors: yes

    - name: Wait for processes to stop
      pause:
        seconds: 3

    # ========== DEPLOY NEW CODE ==========
    - name: Copy updated application code
      win_copy:
        src: ../../vps-agent/app/
        dest: "{{ vps_agent_path }}\\app\\"

    - name: Copy updated launcher
      win_copy:
        src: ../../vps-agent/launcher.py
        dest: "{{ vps_agent_path }}\\launcher.py"

    - name: Copy updated requirements
      win_copy:
        src: ../../vps-agent/requirements.txt
        dest: "{{ vps_agent_path }}\\requirements.txt"

    # ========== UPDATE agents.json IF CHANGED ==========
    - name: Update agents.json from template
      win_template:
        src: ../templates/agents.json.j2
        dest: "{{ vps_agent_path }}\\agents.json"

    # ========== INSTALL ANY NEW DEPENDENCIES ==========
    - name: Install/update requirements
      win_command: pip install -r requirements.txt --quiet
      args:
        chdir: "{{ vps_agent_path }}"

    # ========== START AGENTS ==========
    - name: Start the agent launcher
      win_shell: |
        Start-Process python -ArgumentList "launcher.py" -WorkingDirectory "{{ vps_agent_path }}" -WindowStyle Hidden

    - name: Wait for agents to start
      pause:
        seconds: 10

    # ========== VERIFY DEPLOYMENT ==========
    - name: Check agent health
      win_uri:
        url: "http://localhost:{{ item }}/health"
        method: GET
        status_code: 200
      loop: "{{ agent_ports }}"
      register: health_checks
      ignore_errors: yes

    - name: Deployment result
      debug:
        msg: |
          ═══════════════════════════════════════════════════
           {{ inventory_hostname | upper }} DEPLOYMENT COMPLETE
          ═══════════════════════════════════════════════════
           Backup:  {{ backup_path }}\backup-{{ timestamp }}

           Agent Status:
          {% for check in health_checks.results %}
             Port {{ check.item }}: {{ '✅ RUNNING' if check.status == 200 else '❌ FAILED' }}
          {% endfor %}
          ═══════════════════════════════════════════════════
```

---

## File 9: ansible/playbooks/rollback.yml

```yaml
---
# Rollback to previous version
# Usage: ansible-playbook playbooks/rollback.yml --limit vps2

- name: Rollback VPS Agent
  hosts: all_vps
  gather_facts: no
  tasks:
    - name: Find latest backup
      win_shell: |
        Get-ChildItem "{{ backup_path }}" -Directory | Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
      register: latest_backup

    - name: Show backup to restore
      debug:
        msg: "Rolling back to: {{ latest_backup.stdout | trim }}"

    - name: Stop current agents
      win_shell: |
        Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
      ignore_errors: yes

    - name: Restore from backup
      win_copy:
        src: "{{ latest_backup.stdout | trim }}\\"
        dest: "{{ vps_agent_path }}\\"
        remote_src: yes

    - name: Start restored agents
      win_shell: |
        Start-Process python -ArgumentList "launcher.py" -WorkingDirectory "{{ vps_agent_path }}" -WindowStyle Hidden

    - name: Rollback complete
      debug:
        msg: "✅ Rolled back {{ inventory_hostname }} to {{ latest_backup.stdout | trim }}"
```

---

## File 10: ansible/playbooks/status.yml

```yaml
---
# Check status of all VPS agents
# Usage: ansible-playbook playbooks/status.yml

- name: Check VPS Agent Status
  hosts: all_vps
  gather_facts: no
  tasks:
    - name: Check agent processes
      win_shell: |
        Get-Process python -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count
      register: process_count
      ignore_errors: yes

    - name: Check health endpoints
      win_uri:
        url: "http://localhost:{{ item }}/health"
        method: GET
        status_code: 200
        timeout: 5
      loop: "{{ agent_ports }}"
      register: health_checks
      ignore_errors: yes

    - name: Status report
      debug:
        msg: |
          {{ inventory_hostname | upper }}: {{ '🟢' if process_count.stdout | int > 0 else '🔴' }} {{ process_count.stdout | int }} process(es) | {% for h in health_checks.results %}{{ h.item }}:{{ '✅' if h.status == 200 else '❌' }} {% endfor %}
```

---

## File 11: ansible/playbooks/stop.yml

```yaml
---
# Stop all agents on VPS
# Usage: ansible-playbook playbooks/stop.yml --limit vps2

- name: Stop VPS Agents
  hosts: all_vps
  gather_facts: no
  tasks:
    - name: Stop Python processes
      win_shell: |
        Get-Process python -ErrorAction SilentlyContinue | Stop-Process -Force
      ignore_errors: yes

    - name: Confirm stopped
      debug:
        msg: "✅ Stopped agents on {{ inventory_hostname }}"
```

---

## File 12: ansible/playbooks/start.yml

```yaml
---
# Start agents on VPS
# Usage: ansible-playbook playbooks/start.yml --limit vps2

- name: Start VPS Agents
  hosts: all_vps
  gather_facts: no
  tasks:
    - name: Start launcher
      win_shell: |
        Start-Process python -ArgumentList "launcher.py" -WorkingDirectory "{{ vps_agent_path }}" -WindowStyle Hidden

    - name: Wait for startup
      pause:
        seconds: 10

    - name: Verify running
      win_uri:
        url: "http://localhost:{{ item }}/health"
        method: GET
        status_code: 200
      loop: "{{ agent_ports }}"
      register: health_checks
      ignore_errors: yes

    - name: Start result
      debug:
        msg: "{{ inventory_hostname }}: {% for h in health_checks.results %}{{ h.item }}:{{ '✅' if h.status == 200 else '❌' }} {% endfor %}"
```

---

## Quick Start Commands

```bash
# 1. Install Ansible
pip install ansible pywinrm

# 2. Navigate to ansible directory
cd mt5-monitor/ansible

# 3. Test connection to all VPS
ansible all_vps -m win_ping

# 4. Validate all VPS are ready
ansible-playbook playbooks/validate.yml

# 5. Deploy to stage1 (VPS2) first
ansible-playbook playbooks/deploy.yml --limit stage1

# 6. Check status
ansible-playbook playbooks/status.yml

# 7. If good, deploy to stage2
ansible-playbook playbooks/deploy.yml --limit stage2

# 8. Deploy to all remaining
ansible-playbook playbooks/deploy.yml --limit stage3

# 9. Or deploy to ALL at once (after testing)
ansible-playbook playbooks/deploy.yml
```

---

## Adding New VPS

1. Add to `inventory/hosts.yml`:
```yaml
vps24:
  ansible_host: x.x.x.x
```

2. Create `host_vars/vps24.yml`:
```yaml
vps_name: VPS24
account_holder: "New Person"
agents:
  - name: "VPS24-FundedNext"
    port: 8000
    terminal_path: "{{ mt5_terminals.fundednext }}"
    # ... etc
```

3. Run setup:
```bash
ansible-playbook playbooks/setup-fresh.yml --limit vps24
```

---

## Implementation Checklist

- [ ] Install Ansible: `pip install ansible pywinrm`
- [ ] Create `ansible/` directory structure
- [ ] Create `ansible.cfg`
- [ ] Create `inventory/hosts.yml` with all 23 VPS
- [ ] Create `group_vars/all.yml`
- [ ] Create `host_vars/vpsX.yml` for each VPS (23 files)
- [ ] Create `templates/agents.json.j2`
- [ ] Create all playbooks
- [ ] Enable WinRM on all VPS (one-time)
- [ ] Test with `ansible all_vps -m win_ping`
- [ ] Run validation: `ansible-playbook playbooks/validate.yml`
- [ ] Deploy to stage1, verify, then stage2, then stage3

---

## Time Estimate

| Task | Time |
|------|------|
| Setup Ansible locally | 30 min |
| Create inventory + host_vars | 2 hrs |
| Create playbooks | 2 hrs |
| Enable WinRM on all VPS | 1 hr (one-time) |
| Test and debug | 1-2 hrs |
| **Total setup** | **~6-8 hrs** |
| **Each deployment after** | **5-10 min** |

---

*Document created for MT5 Monitor VPS deployment automation*
