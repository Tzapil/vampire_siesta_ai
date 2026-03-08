import json
import re
import html
from pathlib import Path

ROOT = Path('.')


def clean_title(title: str) -> str:
    # Remove trailing "(cost, ...)" and trailing dots/spaces
    title = re.sub(r'\s*\(.*?\)\s*\.?\s*$', '', title).strip()
    title = title.rstrip(' .')
    return title


def parse_wod(path: Path) -> dict:
    text = path.read_text(encoding='utf-8')
    pattern = re.compile(r'<h4>\s*(.*?)\s*</h4>\s*<p>(.*?)</p>', re.S | re.I)
    items = {}
    for m in pattern.finditer(text):
        raw_title = html.unescape(m.group(1))
        raw_desc = html.unescape(m.group(2))
        title = re.sub(r'<[^>]+>', '', raw_title)
        desc = re.sub(r'<[^>]+>', '', raw_desc)
        title = re.sub(r'\s+', ' ', title).strip()
        desc = re.sub(r'\s+', ' ', desc).strip()
        title_clean = clean_title(title)
        if title_clean:
            items[title_clean] = desc
    return items


def parse_mf(path: Path) -> dict:
    text = path.read_text(encoding='utf-8')
    # Match table rows with name, short, long description
    pattern = re.compile(
        r'<td class="column-1">(.*?)</td>\s*'
        r'<td class="column-2">.*?</td>\s*'
        r'<td class="column-3">.*?</td>\s*'
        r'<td class="column-4">(.*?)</td>\s*'
        r'<td class="column-5">(.*?)</td>',
        re.S | re.I,
    )
    items = {}
    for m in pattern.finditer(text):
        name = re.sub(r'<[^>]+>', '', html.unescape(m.group(1))).strip()
        desc1 = re.sub(r'<[^>]+>', '', html.unescape(m.group(2))).strip()
        desc2 = re.sub(r'<[^>]+>', '', html.unescape(m.group(3))).strip()
        desc = ' '.join([d for d in [desc1, desc2] if d])
        desc = re.sub(r'\s+', ' ', desc).strip()
        if name:
            items[name] = desc
    return items


merits_all = parse_wod(ROOT / 'temp_merits_all.html')
merits_3ed = parse_wod(ROOT / 'temp_merits_3ed.html')
flaws_3ed = parse_wod(ROOT / 'temp_flaws_3ed.html')
mf = parse_mf(ROOT / 'temp_mf.html')

sources = {
    'merits_all': merits_all,
    'merits_3ed': merits_3ed,
    'flaws_3ed': flaws_3ed,
    'mf': mf,
}

# Manual translations for LiberationMUSH items
mf_translations = {
    'Cast-Iron Stomach': (
        'Вы способны проглатывать почти любую пищу или субстанции и не давиться. '
        'Это не защищает от отравления или вредных эффектов, но позволяет удержать то, '
        'от чего обычного человека стошнило бы.'
    ),
    'Inbred': (
        'Инбридинг приводит к физическим, психическим или эмоциональным дефектам. '
        'Небольшие проявления дают незначимые внешние изъяны, более серьёзные — '
        'врождённые проблемы со здоровьем или тяжёлые деформации, влияющие на проверки.'
    ),
    'Shadow Walker': (
        'Вы настолько связаны с Теневыми Землями, что их объекты ощущаются вам реальными. '
        'Призрачные преграды мешают передвижению, а воздействия духов работают по вам так, '
        'будто вы по ту сторону Пелены. При этом вы не видите Теневые Земли напрямую.'
    ),
}

merit_alias = {
    'ambidextrous': ('merits_all', 'Амибекстер'),
    'iron_stomach': ('mf', 'Cast-Iron Stomach'),
    'catlike_balance': ('merits_all', 'Кошачье равновесие'),
    'bruiser': ('merits_all', 'Внушительный тип'),
    'early_riser': ('merits_all', 'Жаворонок'),
    'acute_sense': ('merits_all', 'Обострённые чувства'),
    'blush_of_health': ('merits_all', 'Пышущий здоровьем'),
    'daredevil': ('merits_all', 'Сорвиголова'),
    'efficient_digestion': ('merits_all', 'Эффективное усвоение'),
    'huge_size': ('merits_all', 'Огромный размер'),
    'useful_knowledge': ('merits_all', 'Полезные знания'),
    'introspection': ('merits_all', 'Самоанализ'),
    'light_sleeper': ('merits_3ed', 'Чуткий сон'),
    'natural_aptitude': ('merits_all', 'Развитый не по годам'),
    'calm': ('merits_all', 'Холодное сердце'),
    'harmless': ('merits_all', 'Безвредный'),
    'reputation': ('merits_all', 'Знаменитость'),
    'sabbat_survivor': ('merits_all', 'Столкнувшийся с Шабашем'),
    'natural_leader': ('merits_all', 'Прирожденный лидер'),
    'boon': ('merits_all', 'Долг'),
    'seasoned_traveler': ('merits_all', 'Свободная дорога'),
    'other_lore': ('merits_all', 'Знаток других'),
    'saint': ('merits_all', 'Святость'),
    'clan_friendship': ('merits_all', 'Дружба клана'),
    'animal_affinity': ('merits_all', 'Безобидность для животных'),
    'sealing_touch': ('merits_all', 'Исцеляющее касание'),
    'deceptive_aura': ('merits_all', 'Дезориентирующая аура'),
    'magic_resistance': ('merits_all', 'Магическая сопротивляемость'),
    'oracle': ('merits_all', 'Способности предсказателя'),
    'lucky': ('merits_all', 'Удачливость'),
  'hidden_diablerie': ('merits_all', 'Сокрытое диаблери'),
  'unbondable': ('merits_all', 'Иммунитет к узам'),
  'additional_discipline': ('merits_all', 'Дополнительная дисциплина'),
  'true_faith': ('merits_all', 'Истинная вера'),
}

flaw_alias = {
    'short': ('flaws_3ed', 'Низкий рост'),
    'smell_of_grave': ('flaws_3ed', 'Запах могилы'),
    'tic': ('flaws_3ed', 'Подергивание'),
    'bad_sight_minor': ('flaws_3ed', 'Плохое зрение'),
    'bad_sight_major': ('flaws_3ed', 'Плохое зрение'),
    'vulnerability_silver': ('flaws_3ed', 'Уязвимость от серебра'),
    'open_wound_minor': ('flaws_3ed', 'Открытая рана'),
    'open_wound_major': ('flaws_3ed', 'Открытая рана'),
    'lazy': ('flaws_3ed', 'Лентяй'),
    'slow_healing': ('flaws_3ed', 'Медленное лечение'),
    'permanent_wound': ('flaws_3ed', 'Постоянная рана'),
    'addiction': ('flaws_3ed', 'Пагубное пристрастие'),
    'child': ('flaws_3ed', 'Ребенок'),
    'protruding_fangs': ('flaws_3ed', 'Постоянные клыки'),
    'deformity': ('flaws_3ed', 'Дефект'),
    'disease_carrier': ('flaws_3ed', 'Разносчик болезни'),
    'thin_blood': ('flaws_3ed', 'Слабая кровь'),
    'fourteenth_generation': ('flaws_3ed', '14-ое Поколение'),
    'sterile_vitae': ('flaws_3ed', 'Бесплодное вите'),
    'flesh_of_corpse': ('flaws_3ed', 'Мертвая плоть'),
    'inbred': ('mf', 'Inbred'),
    'deep_sleeper': ('flaws_3ed', 'Крепкий сон'),
    'speech_impediment': ('flaws_3ed', 'Нарушение речи'),
    'soft_hearted': ('flaws_3ed', 'Мягкосердечие'),
    'unreliable': ('flaws_3ed', 'Неуверенный'),
    'impatient': ('flaws_3ed', 'Нетерпеливый'),
    'prey_exclusion': ('flaws_3ed', 'Разборчивость в добыче'),
    'lunacy': ('flaws_3ed', 'Лунатизм'),
    'stereotype': ('flaws_3ed', 'Стереотип'),
    'weak_willed': ('flaws_3ed', 'Слабая воля'),
    'flesh_eater': ('flaws_3ed', 'Полное потребление'),
    'flashbacks': ('flaws_3ed', 'Воспоминания'),
    'mistaken_identity': ('flaws_3ed', 'Ошибочное опознание'),
    'infamous_sire': ('flaws_3ed', 'Постыдный сир'),
    'enemy_3pt': ('flaws_3ed', 'Враг'),
    'enemy_4pt': ('flaws_3ed', 'Враг'),
    'enemy_5pt': ('flaws_3ed', 'Враг'),
    'clan_enemy': ('flaws_3ed', 'Враждебность клана'),
    'repulsive_touch': ('flaws_3ed', 'Прикосновение холода'),
    'repelled_by_garlic': ('flaws_3ed', 'Восприимчивость к чесноку'),
    'eerie_presence': ('flaws_3ed', 'Холодный бриз'),
    'cursed_1pt': ('flaws_3ed', 'Проклятие'),
    'cursed_2pt': ('flaws_3ed', 'Проклятие'),
    'cursed_3pt': ('flaws_3ed', 'Проклятие'),
    'cursed_4pt': ('flaws_3ed', 'Проклятие'),
    'cursed_5pt': ('flaws_3ed', 'Проклятие'),
    'haunted': ('flaws_3ed', 'Зрение смерти'),
    'beacon_darkness': ('flaws_3ed', 'Маяк нечестивости'),
    'repelled_by_crosses': ('flaws_3ed', 'Восприимчивость к крестам'),
    'cant_cross_running_water': ('flaws_3ed', 'Неспособность пересекать текущую воду'),
    'haunted_by_ghost': ('flaws_3ed', 'Преследование духами'),
    'grip_damned': ('flaws_3ed', 'Хватка Проклятого'),
    'doomed': ('flaws_3ed', 'Злой рок'),
    'light_sensitive': ('flaws_3ed', 'Чувствительность к свету'),
    'shadowwalker': ('mf', 'Shadow Walker'),
}


def fill_items(items, default_source, alias_map, kind_label):
    missing = []
    for item in items:
        if item.get('description'):
            continue
        desc = None
        if item['id'] in alias_map:
            src_key, title = alias_map[item['id']]
            if src_key == 'mf':
                if title in mf_translations:
                    # Ensure source exists in parsed mf list
                    if title not in sources['mf']:
                        missing.append((item['id'], f"mf missing: {title}"))
                        continue
                    desc = mf_translations[title]
                else:
                    missing.append((item['id'], f"mf translation missing: {title}"))
                    continue
            else:
                desc = sources[src_key].get(title)
        else:
            desc = sources[default_source].get(item['name'])

        if not desc:
            missing.append((item['id'], item.get('name')))
            continue

        item['description'] = desc

    if missing:
        print(f"Missing {kind_label} descriptions:")
        for mid, name in missing:
            print('-', mid, name)
    else:
        print(f"All {kind_label} descriptions filled.")


# Update merits (skip clanSpecific)
merits_path = ROOT / 'data' / 'merits.json'
merits = json.loads(merits_path.read_text(encoding='utf-8'))
for cat in ['physical', 'mental', 'social', 'supernatural']:
    fill_items(merits.get(cat, []), 'merits_all', merit_alias, f"merits.{cat}")

merits_path.write_text(json.dumps(merits, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# Update flaws (skip clanSpecific)
flaws_path = ROOT / 'data' / 'flaws.json'
flaws = json.loads(flaws_path.read_text(encoding='utf-8'))
for cat in ['physical', 'mental', 'social', 'supernatural']:
    fill_items(flaws.get(cat, []), 'flaws_3ed', flaw_alias, f"flaws.{cat}")

flaws_path.write_text(json.dumps(flaws, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('Done')
