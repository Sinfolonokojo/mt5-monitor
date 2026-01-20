import httpx
import asyncio
from typing import List, Dict, Tuple
import logging
from datetime import datetime
from .config import settings
from .models import AccountData, VPSAgentStatus

logger = logging.getLogger(__name__)


class DataAggregator:
    """Aggregates data from all VPS agents in parallel with auto-recovery"""

    def __init__(self):
        self.vps_agents = settings.VPS_AGENTS
        self.agent_failure_counts = {}  # Track consecutive failures per agent
        self.max_failures_before_recovery = 2  # Auto-recover after 2 consecutive failures

    async def trigger_agent_refresh(self, agent: Dict) -> bool:
        """Trigger /refresh endpoint on an agent to force MT5 reconnection"""
        agent_name = agent["name"]
        agent_url = agent["url"]

        try:
            logger.info(f"🔄 Triggering refresh for {agent_name} at {agent_url}/refresh")
            async with httpx.AsyncClient(timeout=30) as client:  # Longer timeout for refresh
                response = await client.post(f"{agent_url}/refresh")
                response.raise_for_status()
                logger.info(f"✅ Successfully triggered refresh for {agent_name}")
                return True
        except Exception as e:
            logger.error(f"❌ Failed to trigger refresh for {agent_name}: {str(e)}")
            return False

    async def fetch_agent_data(self, agent: Dict) -> Tuple[str, List[Dict], str]:
        """Fetch data from a single VPS agent with auto-recovery"""
        agent_name = agent["name"]
        agent_url = agent["url"]

        try:
            async with httpx.AsyncClient(timeout=settings.AGENT_TIMEOUT) as client:
                logger.info(f"Fetching from {agent_name} at {agent_url}")
                response = await client.get(f"{agent_url}/accounts")
                response.raise_for_status()
                account_data = response.json()

                # In multi-terminal architecture, each agent returns a single account object
                # Wrap it in a list for consistency with the aggregator
                accounts = [account_data] if isinstance(account_data, dict) else account_data

                # Check if account is disconnected (status="disconnected")
                if accounts and accounts[0].get("status") == "disconnected":
                    logger.warning(f"⚠️ {agent_name} returned disconnected status")

                    # Track failure
                    self.agent_failure_counts[agent_name] = self.agent_failure_counts.get(agent_name, 0) + 1

                    # Auto-recover if failure threshold reached
                    if self.agent_failure_counts[agent_name] >= self.max_failures_before_recovery:
                        logger.warning(f"🔧 Auto-recovery triggered for {agent_name} (failures: {self.agent_failure_counts[agent_name]})")
                        recovery_success = await self.trigger_agent_refresh(agent)

                        if recovery_success:
                            # Reset failure count after successful recovery trigger
                            self.agent_failure_counts[agent_name] = 0

                            # Retry fetching data after refresh
                            await asyncio.sleep(2)  # Wait for refresh to complete
                            retry_response = await client.get(f"{agent_url}/accounts")
                            retry_response.raise_for_status()
                            retry_data = retry_response.json()
                            accounts = [retry_data] if isinstance(retry_data, dict) else retry_data
                            logger.info(f"✅ Retry successful for {agent_name} after recovery")

                    return agent_name, accounts, "online"
                else:
                    # Success - reset failure count
                    self.agent_failure_counts[agent_name] = 0
                    logger.info(f"Successfully fetched {len(accounts)} account(s) from {agent_name}")
                    return agent_name, accounts, "online"

        except httpx.TimeoutException:
            logger.error(f"Timeout connecting to {agent_name} at {agent_url}")
            self.agent_failure_counts[agent_name] = self.agent_failure_counts.get(agent_name, 0) + 1
            return agent_name, [], "timeout"
        except httpx.ConnectError:
            logger.error(f"Connection error to {agent_name} at {agent_url}")
            self.agent_failure_counts[agent_name] = self.agent_failure_counts.get(agent_name, 0) + 1

            # Auto-recover on connection errors too
            if self.agent_failure_counts[agent_name] >= self.max_failures_before_recovery:
                logger.warning(f"🔧 Auto-recovery triggered for offline {agent_name}")
                await self.trigger_agent_refresh(agent)
                self.agent_failure_counts[agent_name] = 0  # Reset after attempt

            return agent_name, [], "offline"
        except Exception as e:
            logger.error(f"Error fetching from {agent_name}: {str(e)}")
            self.agent_failure_counts[agent_name] = self.agent_failure_counts.get(agent_name, 0) + 1
            return agent_name, [], "error"

    async def fetch_all_agents(self) -> Tuple[List[Dict], List[VPSAgentStatus]]:
        """Fetch data from all VPS agents in parallel"""
        logger.info(f"Fetching data from {len(self.vps_agents)} VPS agents in parallel")

        tasks = [self.fetch_agent_data(agent) for agent in self.vps_agents]
        results = await asyncio.gather(*tasks)

        all_accounts = []
        agent_statuses = []

        for agent_name, accounts, status in results:
            agent = next(a for a in self.vps_agents if a["name"] == agent_name)
            agent_status = VPSAgentStatus(
                agent_name=agent_name,
                agent_url=agent["url"],
                status=status,
                accounts_count=len(accounts),
                last_checked=datetime.now()
            )
            agent_statuses.append(agent_status)

            # Add accounts with source information
            for account in accounts:
                account["vps_source"] = agent_name
                all_accounts.append(account)

        logger.info(f"Fetched total of {len(all_accounts)} accounts from all agents")
        return all_accounts, agent_statuses


# Singleton instance
data_aggregator = DataAggregator()
