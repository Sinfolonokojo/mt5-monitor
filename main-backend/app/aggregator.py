import httpx
import asyncio
from typing import List, Dict, Tuple
import logging
from datetime import datetime
from .config import settings
from .models import AccountData, VPSAgentStatus

logger = logging.getLogger(__name__)


class DataAggregator:
    """Aggregates data from all VPS agents in parallel"""

    def __init__(self):
        self.vps_agents = settings.VPS_AGENTS

    async def fetch_agent_data(self, agent: Dict) -> Tuple[str, List[Dict], str]:
        """Fetch data from a single VPS agent"""
        agent_name = agent["name"]
        agent_url = agent["url"]

        try:
            async with httpx.AsyncClient(timeout=settings.AGENT_TIMEOUT) as client:
                logger.info(f"Fetching from {agent_name} at {agent_url}")
                response = await client.get(f"{agent_url}/accounts")
                response.raise_for_status()
                accounts = response.json()
                logger.info(f"Successfully fetched {len(accounts)} accounts from {agent_name}")
                return agent_name, accounts, "online"
        except httpx.TimeoutException:
            logger.error(f"Timeout connecting to {agent_name} at {agent_url}")
            return agent_name, [], "timeout"
        except httpx.ConnectError:
            logger.error(f"Connection error to {agent_name} at {agent_url}")
            return agent_name, [], "offline"
        except Exception as e:
            logger.error(f"Error fetching from {agent_name}: {str(e)}")
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
