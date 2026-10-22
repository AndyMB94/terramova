from django.urls import path

from apps.analytics.api.views import SummaryView, TimelineView

urlpatterns = [
    path("analytics/summary/", SummaryView.as_view(), name="analytics-summary"),
    path("analytics/timeline/", TimelineView.as_view(), name="analytics-timeline"),
]
