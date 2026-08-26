#!/usr/bin/env python3
"""
지문(passages) 난이도 재라벨링 — Flesch-Kincaid + Coleman-Liau 블렌드로 ar_min/ar_max 재계산.

기존 라벨링(docs/passage-difficulty-labeling-2026-08-11.md)은 Flesch-Kincaid 단독으로
계산했는데, 문장을 짧게 끊어 쓴 서사문(예: "Grace turned eight years old. It was a warm
day in June. ...")처럼 분량은 있어도 문장 구조가 단순한 글을 과소평가하는 맹점이 있었다.

처음에는 Dale-Chall(상용어 목록 기반)을 보완 지표로 쓰려 했으나, textstat의 Dale-Chall
구현이 "고유명사는 전부 어려운 단어로 카운트한다"고 문서에 명시돼 있어(단어 목록에 등재된
것과 무관하게) 실측해보니 폐기해야 했다 — 이 앱의 지문은 전부 "Grace", "Mia", "Noah" 같은
등장인물 이름이 반복되는 서사문이라, 이름이 나올 때마다 어려운 단어로 잘못 집계되어 거의
모든 지문이 6~14학년 수준으로 튀는 결과가 나왔다(regex로 이름을 대명사로 치환해 우회를
시도했으나 대체어 자체도 고유명사 판정을 피하지 못해 근본적으로 안 맞았음).

대신 **Coleman-Liau Index**를 썼다 — 단어 목록 조회나 음절 카운팅 없이 순수하게 "단어당
평균 글자수 + 문장당 평균 단어수"만으로 계산되는 공식이라 고유명사 편향이 구조적으로 없고,
SMOG처럼 30문장 이상을 전제하는 공식도 아니라 이 앱의 80~180단어짜리 짧은 지문에도 안전하다.
FK(음절수 기반)와 계산 방식이 근본적으로 달라 서로의 맹점을 보완하는 독립적인 신호가 된다.

기본은 dry-run(리포트만 출력, DB 변경 없음). 실제 반영은 --apply 필요.

사용법:
  pip install textstat requests
  python3 scripts/relabel_passages.py                    # 리포트만 출력
  python3 scripts/relabel_passages.py --apply             # 크게 바뀌는 지문만 실제 반영
  python3 scripts/relabel_passages.py --apply --all       # 전수 반영
  python3 scripts/relabel_passages.py --threshold 0.3     # "요검토" 판정 임계값 조정(기본 0.5)

.env.local에서 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 읽는다.
"""
import os
import sys
import argparse

try:
    import requests
    import textstat
except ImportError:
    print("필요 패키지가 없습니다: pip install textstat requests", file=sys.stderr)
    sys.exit(1)

ENV_PATH = os.path.join(os.path.dirname(__file__), "..", ".env.local")
DEFAULT_THRESHOLD = 0.5  # 기존 center와 새 center 차이가 이보다 크면 "요검토"


def load_env():
    env = {}
    with open(ENV_PATH) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"')
    return env


# 길이 하한: FK/CLI는 "문장당 평균 단어수" 기반이라, 짧고 단순한 문장을 여러 개 이어붙인 긴
# 지문(예: 13문장·83단어짜리 금붕어 이야기가 AR1.4로 나온 사례)을 구조적으로 못 잡아낸다.
# 실제 쉬운 지문 집단은 최대 35단어/5문장을 넘지 않으므로, 그 이상 길면 계산된 center와
# 무관하게 다음 밴드(AR2.0) 이상으로 끌어올린다.
LENGTH_FLOOR_WORDS = 40
LENGTH_FLOOR_SENTENCES = 6
LENGTH_FLOOR_CENTER = 1.8


# 아주 짧은 지문(20~35단어, 문장 3~4개)은 FK/CLI가 문장 하나, 단어 하나만 살짝 길어도
# 평균이 크게 흔들린다 — 실측 결과, 내용·어휘 난이도가 사실상 동일한 27~30단어 지문들이
# (예: "We visit a big apple orchard..." vs "Look at the small yellow duck...") 단어 하나
# 차이로 center가 0.5~1.9까지 벌어졌다. 기존 word_count/15 상한(30단어 기준 cap 2.0)은 이
# 노이즈를 다 못 걸러내 "2.0 레벨을 선택했는데 체감 1.0짜리 4문장 지문이 나온다"는 문제로
# 이어졌다. 20~35단어 구간에는 더 촘촘한 상한(word_count/25, 30단어 기준 cap 1.2)을 따로
# 적용해 이 구간 지문들이 실제 체감 난이도(대체로 AR1.0 근방)에 더 가깝게 수렴하도록 한다.
SHORT_WORD_CEILING = 35
SHORT_CAP_DIVISOR = 25
DEFAULT_CAP_DIVISOR = 15


def estimate_center(content: str, word_count: int):
    fk = textstat.flesch_kincaid_grade(content)
    cli = textstat.coleman_liau_index(content)
    blended = (fk + cli) / 2
    cap_divisor = SHORT_CAP_DIVISOR if word_count <= SHORT_WORD_CEILING else DEFAULT_CAP_DIVISOR
    capped = min(blended, word_count / cap_divisor)
    center = max(0.5, round(capped, 1))

    sentence_count = textstat.sentence_count(content)
    if word_count > LENGTH_FLOOR_WORDS or sentence_count > LENGTH_FLOOR_SENTENCES:
        center = max(center, LENGTH_FLOOR_CENTER)

    return center, fk, cli


def fetch_passages(env):
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    resp = requests.get(
        f"{url}/rest/v1/passages",
        params={"select": "id,content,word_count,ar_min,ar_max", "order": "id"},
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
    )
    resp.raise_for_status()
    return resp.json()


def update_passage(env, passage_id, ar_min, ar_max):
    url = env["NEXT_PUBLIC_SUPABASE_URL"]
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    resp = requests.patch(
        f"{url}/rest/v1/passages",
        params={"id": f"eq.{passage_id}"},
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json={"ar_min": ar_min, "ar_max": ar_max},
    )
    resp.raise_for_status()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="실제로 DB에 반영 (기본은 리포트만 출력)")
    parser.add_argument("--all", action="store_true", help="--apply와 함께: 임계값 무시하고 전수 반영")
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD, help="요검토 판정 임계값(center 차이, 기본 0.5)")
    args = parser.parse_args()

    threshold = 0.0 if args.all else args.threshold

    env = load_env()
    passages = fetch_passages(env)
    print(f"총 {len(passages)}개 지문 조회됨\n")

    flagged = []
    for p in passages:
        old_center = round((p["ar_min"] + p["ar_max"]) / 2, 2)
        center, fk, cli = estimate_center(p["content"], p["word_count"])
        diff = round(center - old_center, 2)
        disagreement = round(abs(fk - cli), 2)
        new_ar_min = max(0.1, round(center - 0.2, 1))
        new_ar_max = round(center + 0.2, 1)

        if abs(diff) >= threshold or disagreement >= 2.0:
            flagged.append(
                {
                    "id": p["id"],
                    "snippet": p["content"][:70].replace("\n", " "),
                    "word_count": p["word_count"],
                    "old_ar_min": p["ar_min"],
                    "old_ar_max": p["ar_max"],
                    "fk": round(fk, 2),
                    "cli": round(cli, 2),
                    "new_ar_min": new_ar_min,
                    "new_ar_max": new_ar_max,
                    "diff": diff,
                    "disagreement": disagreement,
                }
            )

    flagged.sort(key=lambda r: -abs(r["diff"]))

    header = f"{'ID':<10}{'단어수':>6} {'기존라벨':>11} {'FK':>6} {'C-L':>6} {'신규라벨':>11} {'차이':>7}  지문 미리보기"
    print(header)
    print("-" * len(header))
    for r in flagged:
        print(
            f"{r['id'][:8]:<10}{r['word_count']:>6} "
            f"{r['old_ar_min']:>4.1f}-{r['old_ar_max']:<5.1f} "
            f"{r['fk']:>6.1f} {r['cli']:>6.1f} "
            f"{r['new_ar_min']:>4.1f}-{r['new_ar_max']:<5.1f} {r['diff']:>+7.2f}  {r['snippet']}"
        )

    print(f"\n요검토 대상: {len(flagged)}개 / 전체 {len(passages)}개 (threshold={threshold}, FK·Coleman-Liau 불일치 >= 2.0 학년 포함)")

    if args.apply:
        print(f"\n--apply 지정됨: 위 {len(flagged)}개 지문에 새 ar_min/ar_max 반영 중...")
        failed = []
        for r in flagged:
            try:
                update_passage(env, r["id"], r["new_ar_min"], r["new_ar_max"])
            except Exception as e:
                failed.append((r["id"], str(e)))
        print(f"완료: {len(flagged) - len(failed)}개 성공, {len(failed)}개 실패")
        for pid, err in failed:
            print(f"  실패 {pid}: {err}")
    else:
        print("\n(dry-run — DB에는 아무 것도 반영되지 않았습니다. 반영하려면 --apply를 추가하세요.)")


if __name__ == "__main__":
    main()
