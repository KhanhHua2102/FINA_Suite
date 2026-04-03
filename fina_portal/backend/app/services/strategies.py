"""Trading strategy definitions loaded from YAML files."""

import logging
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)

_STRATEGIES_DIR = Path(__file__).resolve().parent.parent.parent / "strategies"
_cache: Optional[dict] = None


def _load_strategies() -> dict:
    global _cache
    if _cache is not None:
        return _cache

    strategies = {}
    if not _STRATEGIES_DIR.is_dir():
        logger.warning(f"Strategies directory not found: {_STRATEGIES_DIR}")
        _cache = strategies
        return strategies

    for yaml_file in sorted(_STRATEGIES_DIR.glob("*.yaml")):
        try:
            data = yaml.safe_load(yaml_file.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                continue
            key = yaml_file.stem
            strategies[key] = {
                "name": data.get("name", key),
                "description": data.get("description", ""),
                "prompt_instructions": data.get("prompt_instructions", ""),
                "priority": data.get("priority", 99),
                "market_regimes": data.get("market_regimes", []),
                "aliases": data.get("aliases", []),
            }
        except Exception as e:
            logger.warning(f"Failed to load strategy {yaml_file.name}: {e}")

    _cache = dict(sorted(strategies.items(), key=lambda x: x[1].get("priority", 99)))
    logger.info(f"Loaded {len(_cache)} strategies from {_STRATEGIES_DIR}")
    return _cache


def reload_strategies() -> None:
    """Force reload strategies from disk."""
    global _cache
    _cache = None
    _load_strategies()


def get_strategy(key: str) -> dict:
    """Return a strategy by key, falling back to default."""
    strategies = _load_strategies()
    return strategies.get(key, strategies.get("default", {
        "name": "Balanced Analysis",
        "description": "Default analysis.",
        "prompt_instructions": "",
    }))


def get_strategy_list() -> list:
    """Return list of strategies with key, name, description, and metadata."""
    strategies = _load_strategies()
    return [
        {
            "key": k,
            "name": v["name"],
            "description": v["description"],
            "market_regimes": v.get("market_regimes", []),
        }
        for k, v in strategies.items()
    ]
