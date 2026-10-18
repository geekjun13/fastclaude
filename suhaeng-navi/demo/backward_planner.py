"""
수행 내비 — 역산 플래너 (발표용 파이썬 버전)

마감일에서 거꾸로 세어 "지금 시작하면 여유 있게 끝나는 가장 늦은 날"을 찾고,
그날부터 하루 몫을 고르게 나눠 배치해요.

    실행:  python3 demo/backward_planner.py
"""
from collections import Counter, defaultdict
from datetime import date, timedelta

TODAY = date(2026, 10, 19)   # 월요일 (결과가 늘 같도록 고정)
WD = "월화수목금토일"

# 하루 빈 시간 = 학교 끝(16:20) ~ 공부 마감(22:00) − 학원(이동 포함), 하루 최대 90분 / 주말 150분
SCHOOL_END, DAY_END = 16 * 60 + 20, 22 * 60
ACADEMY = {0: 210, 1: 180, 2: 210, 3: 180, 4: 210}   # 요일별 학원 시간(분), 월=0
used = defaultdict(int)                               # 날마다 이미 배치한 분 (여러 과목이 나눠 씀)


def free_minutes(day: date) -> int:
    """그날 남은 빈 시간(분)."""
    if day.weekday() >= 5:                            # 주말
        cap = 150
    else:
        cap = min(90, DAY_END - SCHOOL_END - ACADEMY.get(day.weekday(), 0))
    return max(0, cap - used[day])


def monday_of(day: date) -> date:
    return day - timedelta(days=day.weekday())


def plan_backward(due: date, total: int, crunch: bool):
    """역산 플래너: 시작일과 날짜별 배치를 돌려줘요."""
    need = total * (2.0 if crunch else 1.5)           # ① 여유를 둔 필요 시간 (몰림 주면 2배)
    last_work = due - timedelta(days=2)               #    마감 전날은 비상용으로 비워 둬요

    start, acc, day = last_work, 0, last_work         # ② 마감 이틀 전부터 거꾸로 세기
    while day >= TODAY:
        acc += free_minutes(day)
        start = day
        if acc >= need:                               #    채워지는 가장 늦은 날 = 시작일
            break
        day -= timedelta(days=1)

    days = (last_work - start).days + 1               # ③ 하루 몫을 고르게 나누기
    quota = max(30, -(-total // days // 10) * 10)     #    10분 단위로 올림
    plan, left, day = [], total, start
    while left > 0 and day <= last_work:
        m = min(quota, free_minutes(day), left)
        if m >= 20:                                   #    20분보다 짧게는 쪼개지 않기
            plan.append((day, m))
            used[day] += m
            left -= m
        day += timedelta(days=1)

    tight = acc < need or left > 0                    #    시간이 모자라면 "빠듯해요"
    return start, plan, tight


def label(d: date) -> str:
    return f"{d.month}/{d.day}({WD[d.weekday()]})"


if __name__ == "__main__":
    # 1단계(Claude)가 정리한 마감일 + 단계별 시간의 합
    cards = [
        ("수학", date(2026, 10, 22), 140),
        ("국어", date(2026, 10, 27), 120),
        ("영어", date(2026, 10, 29), 80),
        ("사회", date(2026, 10, 30), 160),
    ]

    # 몰림 경보: 같은 주(월요일 기준)에 마감이 3개 이상
    weeks = Counter(monday_of(due) for _, due, _ in cards)
    crunch_weeks = {w for w, n in weeks.items() if n >= 3}
    for w in crunch_weeks:
        print(f"⚠ 몰림 경보: {label(w)} 주에 마감 {weeks[w]}개 → 여유를 2배로\n")

    for subject, due, total in sorted(cards, key=lambda c: c[1]):   # 마감이 빠른 것부터
        start, plan, tight = plan_backward(due, total, monday_of(due) in crunch_weeks)
        print(f"{subject} (마감 {label(due)}, {total}분) → {label(start)}부터 시작" + ("  ⚠ 빠듯해요" if tight else ""))
        print("   " + " · ".join(f"{label(d)} {m}분" for d, m in plan))
