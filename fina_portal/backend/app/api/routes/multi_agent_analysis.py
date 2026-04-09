"""API routes for multi-agent analysis."""

import asyncio
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.config import settings, agent_registry
from app.services.analysis_db import AnalysisDB
from app.services.multi_agent_engine import multi_agent_engine

router = APIRouter()

_db: AnalysisDB | None = None


def _get_db() -> AnalysisDB:
    global _db
    if _db is None:
        _db = AnalysisDB(settings.analysis_db_path)
    return _db


class MultiAgentRequest(BaseModel):
    tickers: list[str]
    agents: list[str]
    enable_risk_reasoning: bool = False
    include_portfolio_context: bool = True


@router.post("")
async def start_multi_agent_analysis(request: MultiAgentRequest):
    """Start a multi-agent analysis run."""
    if multi_agent_engine.is_running:
        raise HTTPException(
            status_code=409,
            detail="Multi-agent analysis already in progress",
        )

    valid_ids, invalid_ids = agent_registry.validate_ids(request.agents)
    if invalid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid agent IDs: {invalid_ids}",
        )

    portfolio_context: dict = {}
    if request.include_portfolio_context:
        try:
            from app.config import portfolio_db
            portfolios = portfolio_db.get_portfolios()
            if portfolios:
                portfolio_context = {"portfolios": portfolios}
        except Exception:
            pass

    async def _run():
        try:
            reports = await multi_agent_engine.run(
                tickers=request.tickers,
                agent_ids=valid_ids,
                enable_risk_reasoning=request.enable_risk_reasoning,
                portfolio_context=portfolio_context if portfolio_context else None,
            )
            db = _get_db()
            for report in reports:
                try:
                    db.insert_multi_agent_report(report)
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).error("Failed to store multi-agent report: %s", e)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            import logging
            logging.getLogger(__name__).error("Multi-agent background task failed: %s", e)

    asyncio.create_task(_run())
    return {"status": "started"}


@router.post("/cancel")
async def cancel_multi_agent_analysis():
    """Cancel the currently running multi-agent analysis."""
    if not multi_agent_engine.is_running:
        raise HTTPException(status_code=409, detail="No multi-agent analysis is currently running")

    await multi_agent_engine.cancel()
    return {"status": "cancelled"}


@router.get("/status")
async def get_multi_agent_status():
    """Check if a multi-agent analysis is currently running."""
    return {
        "running": multi_agent_engine.is_running,
        "tickers": multi_agent_engine.current_tickers,
    }


@router.get("/reports/{ticker}")
async def get_multi_agent_reports(
    ticker: str,
    limit: int = Query(default=20, le=100),
    offset: int = Query(default=0, ge=0),
):
    """Get paginated multi-agent report history for a ticker."""
    db = _get_db()
    reports, total = db.get_multi_agent_reports(ticker, limit, offset)
    return {"reports": reports, "total": total}


@router.get("/reports/{ticker}/latest")
async def get_latest_multi_agent_report(ticker: str):
    """Get the most recent multi-agent report for a ticker."""
    db = _get_db()
    report = db.get_latest_multi_agent_report(ticker)
    return {"report": report}


@router.get("/report/{report_id}")
async def get_multi_agent_report(report_id: int):
    """Get a single multi-agent report by ID."""
    db = _get_db()
    report = db.get_multi_agent_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
