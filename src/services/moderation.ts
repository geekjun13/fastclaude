import type { ModerationResult, ModerationVerdict, SharedKind } from '../core/types.ts';

/**
 * Moderation for anything a student posts to a class board.
 *
 * Two stages, and the order matters:
 *
 *   1. A deterministic pre-filter that runs on-device, instantly, offline, and
 *      never sends a minor's text anywhere. It catches the categories a school
 *      board must never carry, and it is the only stage that can *block*.
 *   2. An optional model pass (Cycle) that re-reads anything the pre-filter
 *      merely flagged, to cut false positives on ordinary school language.
 *
 * Design position: the model is allowed to *clear* a flag, never to create a
 * block on its own. A classifier that silently blocks a child's homework post
 * because of a phrasing quirk is worse than one that lets a teacher see it.
 * Blocks come from explicit rules a human can read and appeal.
 */

export interface ModerationRule {
  id: string;
  label: string;
  /** blocked = never posts. flagged = posts, but held for review and marked. */
  severity: 'blocked' | 'flagged';
  patterns: RegExp[];
  /** Shown to the author so they know what to change. */
  message: string;
}

/* The rule table is intentionally readable and auditable, not a black box.
   Korean and English both, because school chat mixes them. */
export const RULES: ModerationRule[] = [
  {
    id: 'harassment',
    label: '비방·욕설',
    severity: 'blocked',
    patterns: [
      /(씨발|시발|ㅅㅂ|병신|ㅄ|지랄|개새|새끼|좆|꺼져|닥쳐|엿먹)/i,
      /\b(fuck|shit|bitch|bastard|stfu|kys)\b/i,
      /(못생|찐따|왕따|재수없|죽어버려|자살해)/,
    ],
    message: '욕설이나 비방으로 읽힐 수 있는 표현이 있어요. 같은 반 친구들이 모두 보는 글이에요.',
  },
  {
    id: 'targeting',
    label: '특정인 지목',
    severity: 'flagged',
    patterns: [
      /\d+번\s*(걔|쟤|그놈|그년)/,
      /(걔|쟤)\s*(진짜|완전)?\s*(짜증|극혐|싫어)/,
    ],
    message: '특정한 친구를 가리키는 표현으로 보여요. 이름이나 번호는 빼고 올려 주세요.',
  },
  {
    id: 'adult',
    label: '성인·유해물',
    severity: 'blocked',
    patterns: [
      /(야동|음란|19금|성인용품|조건만남)/,
      /\b(porn|nsfw|nude)\b/i,
    ],
    message: '학급 게시판에 올릴 수 없는 내용이에요.',
  },
  {
    id: 'substance',
    label: '술·담배·약물',
    severity: 'blocked',
    patterns: [
      /(술자리|음주|소주|맥주|담배|전자담배|액상|대마|마약|도박|토토|배팅)/,
    ],
    message: '미성년 학급 게시판에서는 다룰 수 없는 주제예요.',
  },
  {
    id: 'off-topic-play',
    label: '학사 외 놀거리',
    severity: 'flagged',
    patterns: [
      /(PC방|피시방|노래방|클럽|헌팅|롤\s*같이|겜\s*할\s*사람|밤샘|몰래)/,
      /(땡땡이|째고|조퇴하고|야자\s*빼고)/,
    ],
    message: '수업·평가와 관련 없는 약속으로 보여요. 그룹 탭에서 친구들과 따로 공유해 보세요.',
  },
  {
    id: 'commercial',
    label: '홍보·판매',
    severity: 'flagged',
    patterns: [
      /(판매|삽니다|팝니다|계좌|입금|송금|링크\s*클릭|초대\s*코드|무료\s*나눔\s*이벤트)/,
      /https?:\/\/(?!(?:www\.)?(?:neis|edunet|moe)\.go\.kr)/i,
    ],
    message: '외부 링크나 거래로 보이는 내용이 있어요. 선생님 확인이 필요해요.',
  },
  {
    id: 'privacy',
    label: '개인정보 노출',
    severity: 'blocked',
    patterns: [
      /\d{6}\s*-\s*[1-4]\d{6}/,                       // 주민등록번호
      /01[016-9][-.\s]?\d{3,4}[-.\s]?\d{4}/,          // 휴대폰 번호
      /[\w.+-]+@[\w-]+\.[\w.]{2,}/,                   // 이메일
      /(비밀번호|패스워드)\s*[:=]/i,
    ],
    message: '전화번호·이메일 같은 개인정보는 올릴 수 없어요. 준비물과 일정만 적어 주세요.',
  },
  {
    id: 'exam-integrity',
    label: '시험 부정',
    severity: 'blocked',
    patterns: [
      /(족보\s*(공유|삽니다|팝니다)|답안\s*유출|시험지\s*유출|컨닝|커닝)/,
    ],
    message: '평가의 공정성을 해칠 수 있는 내용이에요.',
  },
];

export interface ModerationInput {
  title: string;
  detail?: string;
  kind: SharedKind;
  authorRole: 'student' | 'parent' | 'teacher' | 'member';
}

/** Stage 1. Synchronous, on-device, never leaves the browser. */
export function prefilter(input: ModerationInput): ModerationResult {
  const text = `${input.title}\n${input.detail ?? ''}`;
  const reasons: string[] = [];
  let verdict: ModerationVerdict = 'approved';
  let message: string | undefined;
  let score = 0;

  for (const rule of RULES) {
    if (!rule.patterns.some((p) => p.test(text))) continue;
    reasons.push(rule.id);
    score += rule.severity === 'blocked' ? 0.6 : 0.25;
    if (rule.severity === 'blocked') {
      verdict = 'blocked';
      message ??= rule.message;
    } else if (verdict !== 'blocked') {
      verdict = 'flagged';
      message ??= rule.message;
    }
  }

  // A post with no school content at all is off-topic by definition, but a
  // teacher's notice is authoritative — never second-guess it.
  if (
    verdict === 'approved' &&
    input.authorRole === 'student' &&
    input.kind !== 'notice' &&
    !/(수행|평가|시험|과제|숙제|준비물|제출|발표|실험|보고서|공지|체험|행사|모둠|조별)/.test(text) &&
    text.trim().length < 6
  ) {
    verdict = 'flagged';
    reasons.push('too-thin');
    score = 0.2;
    message = '내용이 너무 짧아요. 과목과 준비물을 적으면 친구들이 바로 알아볼 수 있어요.';
  }

  if (input.authorRole === 'teacher' && verdict === 'flagged') {
    // Teachers post school business; flag-level heuristics don't apply to them.
    verdict = 'approved';
    reasons.push('teacher-override');
  }

  return {
    verdict,
    reasons,
    score: Math.min(1, score),
    message,
    at: new Date().toISOString(),
  };
}

/**
 * Stage 2. Ask Cycle to re-read a flagged post. Only ever downgrades to
 * 'approved'; a 'blocked' verdict from stage 1 is returned untouched and the
 * text is never sent.
 */
export async function review(
  input: ModerationInput,
  pre: ModerationResult,
  ask?: (prompt: string) => Promise<string>,
): Promise<ModerationResult> {
  if (pre.verdict !== 'flagged' || !ask) return pre;

  try {
    const answer = await ask(
      [
        '너는 학급 게시판 모더레이터야. 아래 글이 학교 일정·평가·과제 공유로서 적절한지 판단해.',
        '적절하면 정확히 OK 한 단어만, 부적절하면 REVIEW 와 한 문장 이유를 써.',
        '---',
        `종류: ${input.kind}`,
        `제목: ${input.title}`,
        `내용: ${input.detail ?? '(없음)'}`,
      ].join('\n'),
    );
    if (/^\s*OK\b/i.test(answer)) {
      return { ...pre, verdict: 'approved', reasons: [...pre.reasons, 'ai-cleared'], score: 0 };
    }
    return { ...pre, reasons: [...pre.reasons, 'ai-held'], message: answer.slice(0, 160) || pre.message };
  } catch {
    // Model unavailable — keep the deterministic verdict. Never fail open past it.
    return pre;
  }
}

export function moderate(
  input: ModerationInput,
  ask?: (prompt: string) => Promise<string>,
): Promise<ModerationResult> {
  return review(input, prefilter(input), ask);
}

export function verdictLabel(v: ModerationVerdict): string {
  return v === 'approved' ? '게시됨' : v === 'flagged' ? '검토 중' : '게시 불가';
}
