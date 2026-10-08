from django.urls import path
from . import views

app_name = 'store'

urlpatterns = [
    path('health/', views.health, name='health'),
    path('csrf/', views.csrf_token, name='csrf'),
    path('beats/', views.beat_list, name='beats'),
    path('videos/', views.video_list, name='videos'),
    path('auth/me/', views.current_artist, name='current-artist'),
    path('auth/signup/', views.artist_signup, name='signup'),
    path('auth/login/', views.artist_login, name='login'),
    path('auth/logout/', views.artist_logout, name='logout'),
    path('orders/', views.my_orders, name='orders'),
    path('checkout/initialize/', views.initialize_checkout, name='checkout-initialize'),
    path('payments/verify/', views.verify_checkout, name='payment-verify'),
    path('payments/paystack/webhook/', views.paystack_webhook, name='paystack-webhook'),
    path('download/<str:token>/', views.download_beat, name='download-beat'),
    path('admin/beats/', views.admin_create_beat, name='admin-create-beat'),
    path('admin/beats/<int:beat_id>/unpublish/', views.admin_unpublish_beat, name='admin-unpublish-beat'),
    path('admin/videos/', views.admin_create_video, name='admin-create-video'),
    path('admin/videos/<int:video_id>/unpublish/', views.admin_unpublish_video, name='admin-unpublish-video'),
    path('admin/email-updates/', views.admin_send_update, name='admin-email-update'),
]
