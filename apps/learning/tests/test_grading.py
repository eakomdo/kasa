from apps.core.grading import counts_as_correct, edit_distance, fold_special_letters, grade_typed, normalize_answer


def test_normalize_ignores_case_punctuation_and_spaces():
    assert normalize_answer('  Wo ho te sɛn?  ') == 'wo ho te sɛn'
    assert normalize_answer('ME  HO YƐ.') == 'me ho yɛ'


def test_fold_maps_special_letters():
    assert fold_special_letters('Ɔkyerɛkyerɛfoɔ') == 'okyerekyerefoo'
    assert fold_special_letters('Nyɔŋma') == 'nyonma'


def test_exact_answers_are_correct():
    assert grade_typed('medaase', 'Medaase') == 'correct'
    assert grade_typed('wo ho te sɛn', 'Wo ho te sɛn?') == 'correct'


def test_plain_letter_spelling_is_almost():
    assert grade_typed('mmiensa', 'Mmiɛnsa') == 'almost'
    assert grade_typed('oyiwaladonn', 'Oyiwaladɔŋŋ') == 'almost'


def test_one_typo_only_in_longer_words():
    assert grade_typed('akwaba', 'Akwaaba') == 'almost'
    assert grade_typed('tu', 'Ti') == 'wrong'


def test_wrong_and_empty():
    assert grade_typed('daabi', 'Aane') == 'wrong'
    assert grade_typed('   ', 'Aane') == 'wrong'


def test_almost_counts_as_correct():
    assert counts_as_correct('almost')
    assert not counts_as_correct('wrong')


def test_edit_distance():
    assert edit_distance('kitten', 'sitting') == 3
    assert edit_distance('', 'abc') == 3
    assert edit_distance('same', 'same') == 0
