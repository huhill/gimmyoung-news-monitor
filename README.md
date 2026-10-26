# 김영사 미디어 모니터

팀 내부용 Cloudflare Workers 웹앱 베이스입니다. 예약 실행, 이메일 발송, 도서·저자 DB 없이 필요할 때 수집합니다.

## 구현 범위

- 한국시간 기준 기간 선택 (기본 지난주, 최대 31일), 수집 / 다시 수집
- 네이버 뉴스 API: 김영사, 주니어김영사, 주니어 김영사 검색, 날짜 필터, 동일 URL 중복 제거
- 김영사 / 주니어김영사 / 공통 / 분류 확인 필요 분류
- 항목 선택, 제목·출처 수정, 복사, UTF-8 BOM TXT 다운로드
- 예시 보기: 명시적으로 표시된 가상 데이터이며 실제 뉴스가 아닙니다.
- Cloudflare Access JWT 서명·발급자·대상·만료 검증 및 팀원 이메일 허용 목록
- 전체 화면/정적 파일/API 인증, noindex, robots.txt, no-store, CSP

## 아직 연결되지 않은 부분

- 기관 공고 자동 수집기는 아직 없습니다. 세 기관 게시판 링크와 상태를 표시합니다. 화면과 TXT에도 이 사실을 표시하며, 수집 실패를 0건으로 숨기지 않습니다.
- 네이버 인증키가 없어 실 API 연동 검증은 수행하지 않았습니다. 검색 API의 제공 시간으로 기간을 필터링하므로 원문 최초 발행일과 다를 수 있습니다.
- 제목·검색 설명과 검색어 기준 분류이며 기사 본문을 읽지 않습니다. 불확실한 기사는 확인 필요로 표시합니다.
- 네이버 API에는 매체명 필드가 없어 출처는 원문 도메인으로 표시하며 사용자가 수정할 수 있습니다.
- 최신순 최대 1,000개 검색 결과를 확인합니다. 한도에 도달하면 일부 수집으로 표시합니다. 오래된 기간의 완전한 검색은 보장하지 않습니다.
- 결과는 현재 브라우저 메모리에만 존재합니다. 새로고침/재수집 시 편집이 사라지며, 영구 저장이나 공유 DB는 없습니다.

## 로컬 확인

Node.js 22 이상을 사용합니다.

```sh
npm install
npm test
npm run check
npm run preview
```

`http://127.0.0.1:4173`은 화면 전용 미리보기입니다. 실제 검색이나 인증 우회 기능이 없고 loopback에만 바인딩됩니다. `npm run dev`의 Worker는 인증 설정이 없으면 차단되는 것이 정상입니다.

## Cloudflare 배포

1. Cloudflare Workers & Pages에서 GitHub 저장소를 연결합니다. Worker 이름은 `gimmyoung-news-monitor`, 루트 디렉터리는 저장소 루트, 배포 명령은 `npx wrangler deploy`로 지정합니다. 별도 프런트엔드 빌드는 없습니다. 배포 전 `npm test && npm run check`를 실행하도록 설정할 수 있습니다.
2. Cloudflare에 연결된 도메인의 전용 서브도메인(예: 실제 소유한 도메인의 monitor)을 Worker Custom Domain으로 지정합니다. `workers_dev: false`, `preview_urls: false`를 유지하여 기본·미리보기 주소를 통한 우회를 막습니다.
3. Cloudflare Zero Trust → Access → Applications에서 해당 호스트 **전체 경로**를 보호하는 Self-hosted 애플리케이션을 만듭니다. Allow에는 실제 팀원 이메일만 지정하고 One-time PIN 또는 회사 로그인 공급자를 연결합니다. Everyone, Bypass, Service Auth 정책은 추가하지 않습니다.
4. 해당 Access 애플리케이션의 AUD와 조직 Team domain을 확인하고 아래 변수/Secret을 Worker Settings에 등록합니다. `.env.example`은 이름 안내용이며 자동 적용되지 않습니다.

| 이름 | 값 |
|---|---|
| ACCESS_TEAM_DOMAIN | `조직이름.cloudflareaccess.com` (https 없이) |
| ACCESS_AUD | 해당 Access 애플리케이션 AUD |
| ALLOWED_EMAILS | 실제 팀원 이메일을 쉼표로 구분 |
| NAVER_CLIENT_ID | 네이버 검색 API Client ID (Secret) |
| NAVER_CLIENT_SECRET | 네이버 검색 API Client Secret (Secret) |

5. 배포 후 로그아웃 상태와 외부 계정에서 화면 및 `/api/collect`가 차단되는지, 팀원 로그인 후 접근 가능한지 확인합니다. 네이버 키 등록 후 실제 기사 검색·복사·TXT 다운로드를 검증합니다.

필수 접근 설정이 누락되면 모든 화면/API는 503으로 차단합니다. robots.txt만 공개되며 `Disallow: /`를 반환합니다. 비밀키는 코드·GitHub·브라우저에 넣지 않습니다. GitHub 저장소도 팀 전용 관리가 필요하면 Private으로 설정하세요.

인증되지 않은 검색 봇/외부 수집기를 막는 구조입니다. 허용된 팀원의 계정·세션을 이용한 자동화나 수동 복사까지 원천 차단한다는 의미는 아닙니다. 검색 제외 헤더만으로 접근 제어가 되지 않으므로 Access 설정을 반드시 완료해야 합니다.

## 다음 개발 단계

기관별 접근 방식·이용 조건을 확인해 게시판 전용 수집기를 연결하고 실제 HTML로 날짜/페이지 넘김/구조 변경을 검증합니다. 보안 확인 화면을 우회하지 않습니다. 필요해질 때만 결과 저장을 추가합니다.

## 공식 참고 문서

- [Cloudflare GitHub 연동](https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/github-integration/)
- [정적 파일보다 Worker 먼저 실행](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Access JWT 검증](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [네이버 뉴스 검색 API](https://developers.naver.com/docs/serviceapi/search/news/news.md)
