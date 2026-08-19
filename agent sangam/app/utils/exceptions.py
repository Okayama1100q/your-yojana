"""Backward-compatibility re-export from app.core.exceptions."""
from app.core.exceptions import (
    EntityNotFoundException,
    InvalidOperationException,
    ValidationException,
    DuplicateEntityException,
    BusinessRuleValidationException,
    InvalidStateTransitionException,
    InsufficientCapacityException,
)

__all__ = [
    "EntityNotFoundException",
    "InvalidOperationException",
    "ValidationException",
    "DuplicateEntityException",
    "BusinessRuleValidationException",
    "InvalidStateTransitionException",
    "InsufficientCapacityException",
]
