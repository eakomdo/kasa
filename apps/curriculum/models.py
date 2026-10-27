from django.db import models


class Unit(models.Model):
    """A curriculum unit, e.g. "Nkyia: Greetings and introductions". Entered by the curriculum team in Django admin."""

    id = models.SlugField(primary_key=True, max_length=40)  # "tw-greet": stable content key
    lang = models.CharField(max_length=4, choices=[('twi', 'Twi'), ('ga', 'Ga')], db_index=True)
    bands = models.JSONField(default=list, help_text='Level bands this unit is taught in: lp, up, jhs, shs')
    order = models.PositiveSmallIntegerField(default=0)
    title_local = models.CharField(max_length=60, blank=True, null=True)
    title_en = models.CharField(max_length=80)
    strand = models.CharField(max_length=40)
    note = models.TextField(help_text='Culture or usage note shown at the top of the unit')
    content_status = models.CharField(
        max_length=10,
        choices=[('verified', 'Verified by native-speaking teachers'), ('review', 'In review')],
        default='review',
    )

    class Meta:
        ordering = ['lang', 'order']

    def __str__(self):
        return f'{self.title_local or self.title_en} ({self.lang})'


class Item(models.Model):
    """A word or phrase. `audio` is a native-speaker recording; without one the API voices it with Khaya TTS."""

    id = models.SlugField(primary_key=True, max_length=60)  # "tw-greet-w1"
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE, related_name='items', null=True, blank=True)
    lang = models.CharField(max_length=4, choices=[('twi', 'Twi'), ('ga', 'Ga')], db_index=True)
    kind = models.CharField(max_length=6, choices=[('word', 'Word'), ('phrase', 'Phrase')], db_index=True)
    english = models.CharField(max_length=200)
    translation = models.CharField(max_length=200)
    audio = models.FileField(upload_to='recordings/', blank=True, null=True)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['unit', 'kind', 'position']
        indexes = [models.Index(fields=['lang', 'english']), models.Index(fields=['lang', 'translation'])]

    def __str__(self):
        return f'{self.translation} — {self.english}'


class DailyFeature(models.Model):
    """Proverb or cultural note shown on the Today screen, rotating daily."""

    lang = models.CharField(max_length=4, choices=[('twi', 'Twi'), ('ga', 'Ga')])
    kicker = models.CharField(max_length=60)
    local = models.CharField(max_length=200)
    english = models.CharField(max_length=240)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['lang', 'order']

    def __str__(self):
        return self.local
