from fastapi import APIRouter, HTTPException

from app.config import settings, runtime_db

router = APIRouter()


def _safe_name(ticker: str) -> str:
    """Sanitize ticker for DB key: ^GSPC -> GSPC, GLOB.AX -> GLOB_AX"""
    return ticker.upper().replace("^", "").replace(".", "_")


@router.get("/{ticker}")
async def get_predictions(ticker: str):
    """Get prediction signals for a ticker across all timeframes."""
    if ticker not in settings.tickers:
        raise HTTPException(status_code=400, detail=f"Invalid ticker: {ticker}")

    safe = _safe_name(ticker)
    signals_row = runtime_db.get_signals(safe)

    # Get current price for per-timeframe signal derivation
    current_price = 0.0
    try:
        from legacy.stock_data_fetcher import market
        current_price = market.get_current_price(ticker)
    except Exception:
        pass

    signals = {}
    high_bounds = signals_row.get("high_bound_prices", []) if signals_row else []
    low_bounds = signals_row.get("low_bound_prices", []) if signals_row else []

    for i, tf in enumerate(settings.timeframes):
        high_bound = high_bounds[i] if i < len(high_bounds) else 0.0
        low_bound = low_bounds[i] if i < len(low_bounds) else 0.0

        # Derive per-timeframe signal from bound prices vs current price
        # (mirrors pt_thinker logic: price < low_bound → long, price > high_bound → short)
        tf_long = 0
        tf_short = 0
        if current_price > 0 and high_bound > 0 and low_bound > 0:
            if current_price < low_bound:
                tf_long = 1
            elif current_price > high_bound:
                tf_short = 1

        signals[tf] = {
            "long": tf_long,
            "short": tf_short,
            "high_bound": high_bound,
            "low_bound": low_bound,
        }

    return {
        "signals": signals,
        "current_price": current_price,
    }
