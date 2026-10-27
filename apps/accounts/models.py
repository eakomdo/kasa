import uuid

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models
from django.utils import timezone


class Role(models.TextChoices):
    STUDENT = 'student', 'Student'
    TEACHER = 'teacher', 'Teacher'
    MODERATOR = 'moderator', 'Moderator'
    ADMIN = 'admin', 'Admin'


class Lang(models.TextChoices):
    TWI = 'twi', 'Twi'
    GA = 'ga', 'Ga'


LEVEL_CHOICES = [(lid, lid) for lid in ('b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'shs1', 'shs2', 'shs3')]


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Users need an email address.')
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('role', Role.ADMIN)
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        extra.setdefault('onboarded', True)
        extra.setdefault('name', 'Kasa Admin')
        return self.create_user(email, password, **extra)


class User(AbstractBaseUser, PermissionsMixin):
    """
    A learner, teacher or Kasa staff member. Other learners only ever see
    `display_name` ("Ama M."); email, full name and guardian email are private.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=60)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.STUDENT, db_index=True)
    status = models.CharField(
        max_length=10, choices=[('active', 'Active'), ('suspended', 'Suspended')], default='active', db_index=True
    )
    onboarded = models.BooleanField(default=False)
    lang = models.CharField(max_length=4, choices=Lang.choices, default=Lang.TWI)
    level_id = models.CharField(max_length=5, choices=LEVEL_CHOICES, default='b7')
    daily_goal = models.PositiveSmallIntegerField(default=10)
    voice = models.CharField(
        max_length=10,
        choices=[('female', 'Female'), ('male_low', 'Male, low'), ('male_high', 'Male, high')],
        default='female',
    )
    school = models.CharField(max_length=80, blank=True, null=True)
    region = models.CharField(max_length=30, blank=True, null=True, db_index=True)
    guardian_email = models.EmailField(blank=True, null=True)
    plan = models.CharField(max_length=6, choices=[('free', 'Free'), ('plus', 'Plus')], default='free')
    reminder_enabled = models.BooleanField(default=False)
    reminder_channel = models.CharField(
        max_length=10, choices=[('whatsapp', 'WhatsApp'), ('sms', 'SMS'), ('push', 'Push')], default='whatsapp'
    )
    reminder_time = models.CharField(max_length=5, default='18:00')
    created_at = models.DateTimeField(default=timezone.now)
    last_active_at = models.DateTimeField(null=True, blank=True)
    # Django admin access (curriculum editors, moderators)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} <{self.email}>'

    @property
    def display_name(self) -> str:
        """'Ama Mensah' -> 'Ama M.'"""
        parts = self.name.split()
        if len(parts) > 1:
            return f'{parts[0]} {parts[-1][0].upper()}.'
        return parts[0] if parts else 'Learner'

    @property
    def is_kasa_staff(self) -> bool:
        return self.role in (Role.MODERATOR, Role.ADMIN)

    @property
    def is_adult(self) -> bool:
        return self.role in (Role.TEACHER, Role.MODERATOR, Role.ADMIN)
