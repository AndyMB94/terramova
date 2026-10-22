from django.apps import AppConfig


class AnalyticsConfig(AppConfig):
    """Agregaciones de solo lectura sobre los eventos. Sin modelos propios."""

    name = "apps.analytics"
    label = "analytics"
    verbose_name = "Analítica"
    default_auto_field = "django.db.models.BigAutoField"
