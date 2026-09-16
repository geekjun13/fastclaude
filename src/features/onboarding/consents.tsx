import type { ConsentKey } from '../../core/types.ts';
import type { ReactNode } from 'react';

/**
 * Consent notices.
 *
 * Written as data rather than prose in a component so the version string is
 * attached to the exact text the user agreed to. When a notice changes, its
 * version changes, and the stored ConsentRecord no longer matches — which is
 * what makes re-consent detectable instead of silent.
 *
 * Structured after Korea's PIPA expectations for a service with minors:
 * purpose, items, retention period and the right to refuse are stated
 * separately for each item, and the optional ones are genuinely optional —
 * refusing them never blocks sign-up.
 */

export interface ConsentSpec {
  id: ConsentKey;
  title: string;
  required: boolean;
  /** Only shown when the condition holds (e.g. Edu accounts, under-14). */
  when?: 'always' | 'edu' | 'minor';
  version: string;
  summary: string;
  notice: ReactNode;
}

const RetentionTable = ({ rows }: { rows: [string, string, string][] }) => (
  <table>
    <thead>
      <tr><th>항목</th><th>목적</th><th>보유기간</th></tr>
    </thead>
    <tbody>
      {rows.map(([a, b, c]) => (
        <tr key={a}><td>{a}</td><td>{b}</td><td>{c}</td></tr>
      ))}
    </tbody>
  </table>
);

export const CONSENTS: ConsentSpec[] = [
  {
    id: 'terms',
    title: '서비스 이용약관',
    required: true,
    when: 'always',
    version: '1.0',
    summary: 'Eidos를 이용하기 위한 기본 약관이에요.',
    notice: (
      <>
        <h5>제1조 (목적)</h5>
        <p>
          이 약관은 Eidos(이하 “서비스”)가 제공하는 일정 관리, 브리프, 학급·그룹 공유 및
          Cycle 기능의 이용 조건과 절차를 정합니다.
        </p>
        <h5>제2조 (이용자의 의무)</h5>
        <ul>
          <li>타인의 개인정보를 게시하거나 도용하지 않습니다.</li>
          <li>학급 게시판에 욕설·비방·유해 내용을 올리지 않습니다.</li>
          <li>공유된 타인의 일정을 서비스 밖으로 전파하지 않습니다.</li>
        </ul>
        <h5>제3조 (서비스의 책임 범위)</h5>
        <p>
          급식·시간표는 학교가 공시한 공공데이터를 표시하는 것으로, 실제 운영과 다를 수
          있습니다. 알레르기 정보는 참고용이며 최종 확인은 학교에 문의해야 합니다.
        </p>
        <h5>제4조 (이용 중단)</h5>
        <p>
          이용자는 언제든지 계정을 삭제할 수 있으며, 삭제 시 이 기기에 저장된 모든 데이터가
          함께 지워집니다.
        </p>
      </>
    ),
  },

  {
    id: 'privacy',
    title: '개인정보 수집·이용 동의',
    required: true,
    when: 'always',
    version: '1.0',
    summary: '이름과 일정 데이터를 서비스 제공에 사용해요.',
    notice: (
      <>
        <h5>수집·이용 내역</h5>
        <RetentionTable
          rows={[
            ['이름(표시명)', '화면 표시, 공유 시 작성자 식별', '계정 삭제 시까지'],
            ['생년월일', '만 14세 미만 여부 확인', '계정 삭제 시까지'],
            ['일정·미리알림', '캘린더 및 브리프 제공', '계정 삭제 시까지'],
            ['일기·기분 기록', '나이트 브리프의 회고 제공', '계정 삭제 시까지'],
            ['위치(도시 단위)', '날씨 제공', '조회 후 즉시 폐기'],
          ]}
        />
        <h5>저장 위치</h5>
        <p>
          위 정보는 <strong>이 기기의 브라우저 저장소에만</strong> 보관됩니다. 서비스 제공자의
          서버로 전송되지 않으며, 브라우저 데이터를 지우면 함께 삭제됩니다.
        </p>
        <h5>거부할 권리</h5>
        <p>
          동의를 거부할 수 있으나, 이 항목은 서비스의 기본 기능에 필요하므로 거부 시
          가입이 어렵습니다.
        </p>
      </>
    ),
  },

  {
    id: 'guardian',
    title: '법정대리인 동의 (만 14세 미만)',
    required: true,
    when: 'minor',
    version: '1.0',
    summary: '만 14세 미만은 보호자의 동의가 필요해요.',
    notice: (
      <>
        <h5>왜 필요한가요</h5>
        <p>
          개인정보 보호법에 따라 만 14세 미만 아동의 개인정보를 처리하려면 법정대리인의
          동의를 받아야 합니다.
        </p>
        <h5>보호자에게 알리는 내용</h5>
        <ul>
          <li>수집 항목: 아동의 표시명, 학교·학년·반, 일정 기록</li>
          <li>이용 목적: 급식·시간표 표시, 학급 공유, 브리프 제공</li>
          <li>보관 기간: 계정 삭제 시까지 (이 기기에만 저장)</li>
          <li>보호자는 언제든 열람·정정·삭제를 요구할 수 있습니다.</li>
        </ul>
        <h5>동의 방법</h5>
        <p>
          아래에 보호자 성함과 연락 수단을 입력하면 동의 기록이 남습니다. 실제 서비스
          운영 시에는 보호자에게 확인 메시지가 발송됩니다.
        </p>
      </>
    ),
  },

  {
    id: 'class-share',
    title: '학급 공유 이용 동의',
    required: false,
    when: 'edu',
    version: '1.0',
    summary: '수행평가·공지를 같은 반 친구들과 주고받아요.',
    notice: (
      <>
        <h5>공유되는 정보</h5>
        <p>
          게시한 항목의 제목·내용·날짜와 <strong>작성자 표시명</strong>이 같은 학급 구성원에게
          보입니다. 학년·반·번호는 게시글에 표시되지 않습니다.
        </p>
        <h5>게시물 검사</h5>
        <p>
          모든 게시물은 올리기 전에 자동으로 검사됩니다. 욕설, 개인정보, 시험 부정, 주류·
          담배 등 유해 주제는 게시되지 않으며, 수업과 무관한 약속은 검토 대상으로
          표시됩니다. 검사는 이 기기 안에서 이루어지며 글 내용이 외부로 전송되지 않습니다.
        </p>
        <h5>거부 시</h5>
        <p>동의하지 않아도 급식·시간표·개인 일정 기능은 모두 이용할 수 있습니다.</p>
      </>
    ),
  },

  {
    id: 'sensitive-allergy',
    title: '민감정보(알레르기) 수집 동의',
    required: false,
    when: 'edu',
    version: '1.0',
    summary: '급식에서 내 알레르기 성분을 경고하려면 필요해요.',
    notice: (
      <>
        <h5>민감정보에 해당합니다</h5>
        <p>
          알레르기 정보는 <strong>건강에 관한 정보</strong>로, 일반 개인정보와 분리해 별도로
          동의를 받아야 합니다.
        </p>
        <RetentionTable
          rows={[['알레르기 유발 성분 19종 중 선택', '급식 메뉴 경고 표시', '계정 삭제 시까지']]}
        />
        <h5>제3자 제공 없음</h5>
        <p>
          선택한 성분은 이 기기에만 저장되며, 학교·교사·다른 학생 누구에게도 공유되지
          않습니다. 급식 메뉴와의 대조도 이 기기 안에서 이루어집니다.
        </p>
        <h5>거부 시</h5>
        <p>급식 메뉴는 그대로 볼 수 있고, 알레르기 경고 표시만 제공되지 않습니다.</p>
      </>
    ),
  },

  {
    id: 'ai-processing',
    title: 'Cycle의 일정 활용 동의',
    required: false,
    when: 'always',
    version: '1.0',
    summary: 'Cycle이 브리프와 답변을 만들 때 내 일정을 참고해요.',
    notice: (
      <>
        <h5>무엇을 하나요</h5>
        <p>
          Cycle이 “오늘 뭐 있어?” 같은 질문에 답하고 모닝·나이트 브리프를 구성할 때
          일정·미리알림·일기를 읽습니다.
        </p>
        <h5>어디에서 처리되나요</h5>
        <p>
          기본값은 <strong>이 기기 안에서의 처리</strong>입니다. 외부 모델을 연결한 경우에만
          향후 7일치 일정 요약이 그 모델로 전송되며, 연결 여부는 Cycle 화면 하단에
          항상 표시됩니다.
        </p>
        <h5>거부 시</h5>
        <p>브리프는 날씨·급식·시간표만으로 구성되고, Cycle은 일정 관련 답을 하지 않습니다.</p>
      </>
    ),
  },

  {
    id: 'marketing',
    title: '소식 받기',
    required: false,
    when: 'always',
    version: '1.0',
    summary: '새로운 기능 소식을 받아볼래요. (선택)',
    notice: <p>새 기능과 업데이트 안내를 받습니다. 언제든 설정에서 해제할 수 있습니다.</p>,
  },
];

export function consentsFor(accountType: 'personal' | 'edu', isMinor: boolean): ConsentSpec[] {
  return CONSENTS.filter((c) => {
    if (c.when === 'edu') return accountType === 'edu';
    if (c.when === 'minor') return isMinor;
    return true;
  });
}
