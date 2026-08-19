import enum


class RegistrationStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SUSPENDED = "SUSPENDED"


class EstimatedDurationUnit(str, enum.Enum):
    HOURS = "HOURS"
    DAYS = "DAYS"
    WEEKS = "WEEKS"
    MONTHS = "MONTHS"


class RequestOverallStatus(str, enum.Enum):
    OPEN = "OPEN"
    PARTIALLY_SUPPORTED = "PARTIALLY_SUPPORTED"
    FULLY_SUPPORTED = "FULLY_SUPPORTED"
    CLOSED = "CLOSED"


class CollaborationStatus(str, enum.Enum):
    REQUESTED = "REQUESTED"
    SENT_TO_NGO = "SENT_TO_NGO"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    PREPARING = "PREPARING"
    DISPATCHED = "DISPATCHED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"
    RECEIVED = "RECEIVED"
    COMPLETED = "COMPLETED"


# Allowed state transitions for status advancement
VALID_STATUS_TRANSITIONS = {
    CollaborationStatus.REQUESTED: {CollaborationStatus.ACCEPTED, CollaborationStatus.REJECTED},
    CollaborationStatus.SENT_TO_NGO: {CollaborationStatus.ACCEPTED, CollaborationStatus.REJECTED},
    CollaborationStatus.ACCEPTED: {CollaborationStatus.PREPARING, CollaborationStatus.DISPATCHED, CollaborationStatus.DELIVERED, CollaborationStatus.RECEIVED},
    CollaborationStatus.PREPARING: {CollaborationStatus.DISPATCHED, CollaborationStatus.DELIVERED, CollaborationStatus.RECEIVED},
    CollaborationStatus.DISPATCHED: {CollaborationStatus.IN_TRANSIT, CollaborationStatus.DELIVERED},
    CollaborationStatus.IN_TRANSIT: {CollaborationStatus.DELIVERED},
    CollaborationStatus.DELIVERED: {CollaborationStatus.RECEIVED},
    CollaborationStatus.RECEIVED: {CollaborationStatus.COMPLETED},
    CollaborationStatus.REJECTED: set(),
    CollaborationStatus.COMPLETED: set(),
}
