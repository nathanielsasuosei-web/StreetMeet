from django.contrib import admin
from .models import Beat, Order, Video

admin.site.site_header = 'KAIRO Beats · Producer studio'
admin.site.site_title = 'KAIRO Beats admin'
admin.site.index_title = 'Catalogue, videos and orders'


@admin.register(Beat)
class BeatAdmin(admin.ModelAdmin):
    list_display = ('title', 'genre', 'price', 'bpm', 'is_published', 'created_at')
    list_filter = ('genre', 'is_published', 'created_at')
    search_fields = ('title', 'description', 'musical_key')
    readonly_fields = ('created_at',)
    fieldsets = (
        ('Beat', {'fields': ('title', 'description', 'genre', 'price', 'audio_file', 'preview_file', 'cover_image')}),
        ('Music metadata', {'fields': ('bpm', 'musical_key', 'tag')}),
        ('Storefront', {'fields': ('is_published', 'created_at')}),
    )


@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ('title', 'is_published', 'created_at')
    list_filter = ('is_published', 'created_at')
    search_fields = ('title', 'description')
    readonly_fields = ('created_at',)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('payment_reference', 'user', 'beat', 'amount', 'currency', 'payment_method', 'status', 'created_at')
    list_filter = ('status', 'payment_method', 'currency', 'created_at')
    search_fields = ('payment_reference', 'user__email', 'beat__title')
    readonly_fields = (
        'user', 'beat', 'amount', 'currency', 'status', 'payment_method',
        'payment_reference', 'gateway_transaction_id', 'payment_metadata',
        'created_at', 'paid_at', 'email_sent_at',
    )
    actions = None

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
