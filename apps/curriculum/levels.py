"""GES school levels. JHS 1–3 are Basic 7–9. Mirrors the frontend's shared/config/levels.ts."""

LEVELS = {
    'b1': ('Basic 1', 'B1', None, 'lp'),
    'b2': ('Basic 2', 'B2', None, 'lp'),
    'b3': ('Basic 3', 'B3', None, 'lp'),
    'b4': ('Basic 4', 'B4', None, 'up'),
    'b5': ('Basic 5', 'B5', None, 'up'),
    'b6': ('Basic 6', 'B6', None, 'up'),
    'b7': ('JHS 1', 'JHS 1', 'Basic 7', 'jhs'),
    'b8': ('JHS 2', 'JHS 2', 'Basic 8', 'jhs'),
    'b9': ('JHS 3', 'JHS 3', 'Basic 9', 'jhs'),
    'shs1': ('SHS 1', 'SHS 1', None, 'shs'),
    'shs2': ('SHS 2', 'SHS 2', None, 'shs'),
    'shs3': ('SHS 3', 'SHS 3', None, 'shs'),
}
BANDS = ('lp', 'up', 'jhs', 'shs')
REGIONS = (
    'Ahafo',
    'Ashanti',
    'Bono',
    'Bono East',
    'Central',
    'Eastern',
    'Greater Accra',
    'North East',
    'Northern',
    'Oti',
    'Savannah',
    'Upper East',
    'Upper West',
    'Volta',
    'Western',
    'Western North',
)


def band_of(level_id: str) -> str:
    return LEVELS.get(level_id, LEVELS['b7'])[3]


def short_label(level_id: str) -> str:
    return LEVELS.get(level_id, LEVELS['b7'])[1]


def level_label(level_id: str) -> str:
    name, _short, ges, _band = LEVELS.get(level_id, LEVELS['b7'])
    return f'{name} ({ges})' if ges else name


def needs_guardian(level_id: str) -> bool:
    return band_of(level_id) in ('lp', 'up')
