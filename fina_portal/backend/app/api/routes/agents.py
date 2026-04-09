"""API routes for agent registry."""

from fastapi import APIRouter

from app.config import agent_registry

router = APIRouter()


@router.get("")
async def list_agents():
    agents = agent_registry.get_all()
    return {
        "agents": [
            {
                "id": a.id,
                "name": a.name,
                "category": a.category,
                "description": a.description,
                "icon": a.icon,
                "requires_data": a.requires_data,
                "is_fina_analyst": a.is_fina_analyst,
            }
            for a in agents
        ]
    }


@router.get("/{agent_id}")
async def get_agent(agent_id: str):
    agent = agent_registry.get(agent_id)
    if not agent:
        return {"error": "Agent not found"}, 404
    return {
        "id": agent.id,
        "name": agent.name,
        "category": agent.category,
        "description": agent.description,
        "icon": agent.icon,
        "requires_data": agent.requires_data,
        "is_fina_analyst": agent.is_fina_analyst,
    }
