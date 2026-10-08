from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from store.views import health, public_media

urlpatterns = [
    path('', health, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/', include('store.urls')),
]

if settings.DEBUG:
    # Local preview/video files only. Master beats are excluded from this route.
    urlpatterns += [path('media/<path:path>', public_media, name='public-media')]
