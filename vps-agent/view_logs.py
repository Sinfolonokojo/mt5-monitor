"""
Simple log viewer for VPS agents
Usage: python view_logs.py [agent_name]

If no agent_name is provided, shows all agents' logs.
"""

import sys
import time
from pathlib import Path


def tail_file(filepath, lines=20):
    """Print last N lines of a file"""
    try:
        with open(filepath, 'r') as f:
            all_lines = f.readlines()
            for line in all_lines[-lines:]:
                print(line, end='')
    except FileNotFoundError:
        print(f"Log file not found: {filepath}")
    except Exception as e:
        print(f"Error reading log: {e}")


def watch_file(filepath):
    """Continuously watch and display new lines from a file"""
    print(f"\n{'=' * 80}")
    print(f"Watching: {filepath}")
    print(f"Press Ctrl+C to stop")
    print(f"{'=' * 80}\n")

    try:
        with open(filepath, 'r') as f:
            # Go to end of file
            f.seek(0, 2)

            while True:
                line = f.readline()
                if line:
                    print(line, end='')
                else:
                    time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n\nStopped watching logs.")
    except FileNotFoundError:
        print(f"Log file not found: {filepath}")
    except Exception as e:
        print(f"Error: {e}")


def main():
    log_dir = Path(__file__).parent / "logs"

    if not log_dir.exists():
        print("No logs directory found. Agents may not have been started yet.")
        return

    # Get all log files
    log_files = list(log_dir.glob("*.log"))

    if not log_files:
        print("No log files found. Agents may not have been started yet.")
        return

    # If agent name provided, watch that specific log
    if len(sys.argv) > 1:
        agent_name = sys.argv[1]
        log_file = log_dir / f"{agent_name}.log"

        if log_file.exists():
            # Show last 50 lines first
            print(f"\n{'=' * 80}")
            print(f"Last 50 lines from {agent_name}:")
            print(f"{'=' * 80}\n")
            tail_file(log_file, 50)

            # Then watch for new lines
            watch_file(log_file)
        else:
            print(f"Log file not found for agent: {agent_name}")
            print(f"\nAvailable agents:")
            for lf in log_files:
                print(f"  - {lf.stem}")
    else:
        # Show all logs (last 20 lines each)
        for log_file in sorted(log_files):
            print(f"\n{'=' * 80}")
            print(f"{log_file.stem}")
            print(f"{'=' * 80}")
            tail_file(log_file, 20)
            print()

        print("\nTip: To watch a specific agent's log in real-time:")
        print("  python view_logs.py VPS1-FundedNext")


if __name__ == "__main__":
    main()
