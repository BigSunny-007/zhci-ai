from decimal import Decimal

from pydantic import BaseModel


class AnalyticsPoint(BaseModel):
    date: str
    portfolio: Decimal
    benchmark: Decimal


class AnalyticsOverview(BaseModel):
    period: str
    portfolio_return: Decimal
    benchmark_return: Decimal
    excess_return: Decimal
    max_drawdown: Decimal
    win_rate: Decimal
    profit_loss_ratio: Decimal
    recommendation_accuracy: Decimal
    data_status: str
    series: list[AnalyticsPoint]


class RecommendationEvaluationPoint(BaseModel):
    date: str
    symbol: str
    realized_return: Decimal
    cumulative_return: Decimal


class RecommendationHorizonSummary(BaseModel):
    horizon: str
    evaluated_count: int
    win_rate: Decimal
    max_drawdown: Decimal
    profit_loss_ratio: Decimal
    recommendation_accuracy: Decimal


class RecommendationEvaluationOverview(BaseModel):
    period: str
    evaluated_count: int
    win_rate: Decimal
    max_drawdown: Decimal
    profit_loss_ratio: Decimal
    recommendation_accuracy: Decimal
    data_status: str
    series: list[RecommendationEvaluationPoint]
    by_horizon: list[RecommendationHorizonSummary] = []
