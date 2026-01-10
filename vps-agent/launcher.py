#!/usr/bin/env python3
"""
Multi-Process Launcher for MT5 VPS Agents

Launches multiple agent processes, each connecting to a different MT5 terminal.
Reads configuration from agents.json and monitors processes for crashes.
"""

import json
import subprocess
import os
import time
import signal
import sys
from pathlib import Path


def load_agent_configs():
    """Load terminal configurations from agents.json"""
    config_path = Path(__file__).parent / "agents.json"

    if not config_path.exists():
        print(f"❌ Error: agents.json not found at {config_path}")
        print("Please create agents.json with your terminal configurations.")
        sys.exit(1)

    try:
        with open(config_path) as f:
            data = json.load(f)
            return data.get("agents", [])
    except json.JSONDecodeError as e:
        print(f"❌ Error parsing agents.json: {e}")
        sys.exit(1)


def start_agent(config):
    """Start a single agent process"""
    env = os.environ.copy()
    env["AGENT_NAME"] = config["name"]
    env["AGENT_PORT"] = str(config["port"])
    env["MT5_TERMINAL_PATH"] = config["terminal_path"]
    env["ACCOUNT_DISPLAY_NAME"] = config["display_name"]

    cmd = [
        "python", "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", str(config["port"])
    ]

    try:
        return subprocess.Popen(
            cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=Path(__file__).parent
        )
    except Exception as e:
        print(f"❌ Error starting {config['name']}: {e}")
        return None


def main():
    """Launch all agent processes"""
    configs = load_agent_configs()

    if not configs:
        print("❌ No agents configured in agents.json")
        sys.exit(1)

    processes = []

    print(f"🚀 Starting {len(configs)} agent process(es)...")
    print("=" * 60)

    for config in configs:
        print(f"  Starting {config['name']} on port {config['port']}...")
        print(f"    Terminal: {config['terminal_path']}")
        print(f"    Account: {config['display_name']}")

        proc = start_agent(config)
        if proc:
            processes.append((config, proc))
            time.sleep(2)  # Stagger startup to avoid port conflicts
            print(f"    ✅ Started (PID: {proc.pid})")
        else:
            print(f"    ❌ Failed to start")
        print()

    if not processes:
        print("❌ No agents started successfully")
        sys.exit(1)

    print("=" * 60)
    print(f"✅ All {len(processes)} agent(s) started successfully!")
    print("\n📊 Monitoring processes... Press Ctrl+C to stop all agents.")
    print()

    def signal_handler(sig, frame):
        """Handle Ctrl+C gracefully"""
        print("\n\n🛑 Stopping all agents...")
        for config, proc in processes:
            print(f"  Stopping {config['name']} (PID: {proc.pid})...")
            proc.terminate()

        # Wait for graceful shutdown
        time.sleep(2)

        # Force kill if still running
        for config, proc in processes:
            if proc.poll() is None:
                print(f"  Force killing {config['name']}...")
                proc.kill()

        print("✅ All agents stopped.")
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        # Monitor processes
        restart_delay = 5
        while True:
            time.sleep(5)

            for i, (config, proc) in enumerate(processes):
                returncode = proc.poll()
                if returncode is not None:
                    print(f"\n⚠️  {config['name']} crashed with code {returncode}!")
                    print(f"    Restarting in {restart_delay} seconds...")
                    time.sleep(restart_delay)

                    new_proc = start_agent(config)
                    if new_proc:
                        processes[i] = (config, new_proc)
                        print(f"    ✅ Restarted (PID: {new_proc.pid})")
                    else:
                        print(f"    ❌ Failed to restart")

    except Exception as e:
        print(f"\n❌ Error in monitoring loop: {e}")
        signal_handler(None, None)


if __name__ == "__main__":
    main()
